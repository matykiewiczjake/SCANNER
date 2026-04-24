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
