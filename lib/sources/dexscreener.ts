import { fetchJson } from "@/lib/http";

export type DexPair = {
  chainId: string;
  dexId?: string;
  url?: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken?: { address: string; name: string; symbol: string };
  priceUsd?: string;
  priceNative?: string;
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
};

export type DexTokensResponse = { pairs: DexPair[] | null };

export type DexProfile = {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
};

const DS = "https://api.dexscreener.com";

/**
 * Tiny per-scan cache so multiple checks can share the same pair fetch.
 */
export class DexCache {
  private pairs = new Map<string, DexPair | null>();

  async getPair(mint: string): Promise<DexPair | null> {
    const cached = this.pairs.get(mint);
    if (cached !== undefined) return cached;
    try {
      const data = await fetchJson<DexTokensResponse>(
        `${DS}/latest/dex/tokens/${mint}`
      );
      const pair = pickBestPair(data.pairs ?? [], mint);
      this.pairs.set(mint, pair);
      return pair;
    } catch {
      this.pairs.set(mint, null);
      return null;
    }
  }

  async getPairsBatch(mints: string[]): Promise<Map<string, DexPair | null>> {
    const out = new Map<string, DexPair | null>();
    const uncached: string[] = [];
    for (const m of mints) {
      const cached = this.pairs.get(m);
      if (cached !== undefined) out.set(m, cached);
      else uncached.push(m);
    }
    // DexScreener accepts up to 30 comma-separated addresses.
    for (let i = 0; i < uncached.length; i += 30) {
      const chunk = uncached.slice(i, i + 30);
      try {
        const data = await fetchJson<DexTokensResponse>(
          `${DS}/latest/dex/tokens/${chunk.join(",")}`
        );
        const byMint = new Map<string, DexPair[]>();
        for (const p of data.pairs ?? []) {
          if (!p.baseToken?.address) continue;
          const key = p.baseToken.address;
          const list = byMint.get(key) ?? [];
          list.push(p);
          byMint.set(key, list);
        }
        for (const mint of chunk) {
          const best = pickBestPair(byMint.get(mint) ?? [], mint);
          this.pairs.set(mint, best);
          out.set(mint, best);
        }
      } catch {
        for (const mint of chunk) {
          this.pairs.set(mint, null);
          out.set(mint, null);
        }
      }
    }
    return out;
  }

  setPair(mint: string, pair: DexPair | null): void {
    this.pairs.set(mint, pair);
  }
}

function pickBestPair(pairs: DexPair[], mint: string): DexPair | null {
  const mine = pairs.filter(
    (p) => p.chainId === "solana" && p.baseToken?.address === mint
  );
  if (mine.length === 0) return null;
  // Highest liquidity wins.
  return mine.reduce((best, p) => {
    const a = best.liquidity?.usd ?? 0;
    const b = p.liquidity?.usd ?? 0;
    return b > a ? p : best;
  });
}

export async function fetchLatestProfiles(): Promise<DexProfile[]> {
  try {
    const data = await fetchJson<DexProfile[]>(
      `${DS}/token-profiles/latest/v1`
    );
    return data ?? [];
  } catch {
    return [];
  }
}

export async function searchPairsByQuery(query: string): Promise<DexPair[]> {
  try {
    const data = await fetchJson<DexTokensResponse>(
      `${DS}/latest/dex/search?q=${encodeURIComponent(query)}`
    );
    return (data.pairs ?? []).filter((p) => p.chainId === "solana");
  } catch {
    return [];
  }
}

// ---------- Trending by 24h volume (Solana) ----------

export type TrendingByVolumeItem = {
  address: string;
  ticker: string;
  name: string;
  priceUsd: number | null;
  marketCap: number | null;
  volume24h: number | null;
  liquidity: number | null;
  priceChange24h: number | null;
  ageDays: number | null;
  dexUrl: string;
  imageUrl: string | null;
};

export type TrendingByVolumeResult =
  | { ok: true; coins: TrendingByVolumeItem[]; fetchedAt: string }
  | { ok: false; error: string; fetchedAt: string };

type BoostedToken = {
  url?: string;
  chainId?: string;
  tokenAddress?: string;
  icon?: string;
};

/**
 * Top Solana tokens ranked by 24h trade volume.
 *
 * Source: Dexscreener `/token-boosts/top/v1` (the "trending" surface — paid
 * promotions) filtered to Solana, then enriched via batch pair lookup so we
 * can sort by actual h24 volume. Fully free tier, no key required.
 *
 * Cached via Next.js Data Cache (`next.revalidate`) so we hit upstream at
 * most every `revalidateSeconds`.
 */
export async function fetchTrendingByVolume(
  limit: number,
  revalidateSeconds: number
): Promise<TrendingByVolumeResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const boostsRes = await fetch(`${DS}/token-boosts/top/v1`, {
      headers: { accept: "application/json" },
      next: { revalidate: revalidateSeconds },
    });
    if (!boostsRes.ok) {
      return {
        ok: false,
        error: `Dexscreener HTTP ${boostsRes.status}`,
        fetchedAt,
      };
    }
    const boosts = (await boostsRes.json()) as BoostedToken[];
    const solanaAddresses = Array.from(
      new Set(
        boosts
          .filter((b) => b.chainId === "solana" && b.tokenAddress)
          .map((b) => b.tokenAddress as string)
      )
    );
    if (solanaAddresses.length === 0) {
      return { ok: false, error: "No Solana boosts in feed", fetchedAt };
    }

    const allPairs: DexPair[] = [];
    for (let i = 0; i < solanaAddresses.length; i += 30) {
      const chunk = solanaAddresses.slice(i, i + 30);
      const url = `${DS}/latest/dex/tokens/${chunk.join(",")}`;
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        next: { revalidate: revalidateSeconds },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as DexTokensResponse;
      for (const p of data.pairs ?? []) {
        if (p.chainId === "solana") allPairs.push(p);
      }
    }

    // Pick highest-liquidity pair per token mint.
    const bestByMint = new Map<string, DexPair>();
    for (const p of allPairs) {
      const mint = p.baseToken?.address;
      if (!mint) continue;
      const existing = bestByMint.get(mint);
      const existingLiq = existing?.liquidity?.usd ?? 0;
      const newLiq = p.liquidity?.usd ?? 0;
      if (!existing || newLiq > existingLiq) bestByMint.set(mint, p);
    }

    const items = Array.from(bestByMint.values())
      .map(toTrendingItem)
      .filter((c) => (c.volume24h ?? 0) > 0)
      .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
      .slice(0, limit);

    if (items.length === 0) {
      return { ok: false, error: "No tradable Solana pairs", fetchedAt };
    }
    return { ok: true, coins: items, fetchedAt };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, fetchedAt };
  }
}

function toTrendingItem(p: DexPair): TrendingByVolumeItem {
  const priceRaw = p.priceUsd != null ? Number(p.priceUsd) : null;
  const priceUsd =
    priceRaw != null && Number.isFinite(priceRaw) ? priceRaw : null;
  const ageDays = p.pairCreatedAt
    ? (Date.now() - p.pairCreatedAt) / 86_400_000
    : null;
  return {
    address: p.baseToken.address,
    ticker: (p.baseToken.symbol ?? "").toUpperCase(),
    name: p.baseToken.name ?? "",
    priceUsd,
    marketCap: p.marketCap ?? p.fdv ?? null,
    volume24h: p.volume?.h24 ?? null,
    liquidity: p.liquidity?.usd ?? null,
    priceChange24h: p.priceChange?.h24 ?? null,
    ageDays,
    dexUrl: p.url ?? `https://dexscreener.com/solana/${p.pairAddress}`,
    imageUrl: p.info?.imageUrl ?? null,
  };
}
