const LC_BASE = "https://lunarcrush.com/api4/public";

export type LunarCoinListItem = {
  id?: number;
  symbol: string;
  name: string;
  price: number | null;
  marketCap: number | null;
  galaxyScore: number | null;
  altRank: number | null;
  sentiment: number | null;
  interactions24h: number | null;
  socialVolume24h: number | null;
  socialDominance: number | null;
  percentChange24h: number | null;
};

type RawCoin = {
  id?: number;
  symbol?: string;
  name?: string;
  price?: number | null;
  market_cap?: number | null;
  galaxy_score?: number | null;
  alt_rank?: number | null;
  sentiment?: number | null;
  interactions_24h?: number | null;
  social_volume_24h?: number | null;
  social_dominance?: number | null;
  percent_change_24h?: number | null;
};

type CoinsListResponse = { data?: RawCoin[] };

function num(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function normalize(c: RawCoin): LunarCoinListItem {
  return {
    id: c.id,
    symbol: (c.symbol ?? "").toUpperCase(),
    name: c.name ?? "",
    price: num(c.price),
    marketCap: num(c.market_cap),
    galaxyScore: num(c.galaxy_score),
    altRank: num(c.alt_rank),
    sentiment: num(c.sentiment),
    interactions24h: num(c.interactions_24h),
    socialVolume24h: num(c.social_volume_24h),
    socialDominance: num(c.social_dominance),
    percentChange24h: num(c.percent_change_24h),
  };
}

export type TrendingFetchResult =
  | { ok: true; coins: LunarCoinListItem[]; fetchedAt: string }
  | { ok: false; error: string; fetchedAt: string };

/**
 * Top trending coins by 24h interactions (proxy for "most talked about on X").
 *
 * Uses Next.js Data Cache via fetch + `next.revalidate` so the upstream is
 * hit at most every 12h regardless of how many users hit /trending.
 *
 * On any failure (gated tier, network, malformed payload) returns
 * `{ ok: false }` — the page renders an empty state, never crashes.
 */
export async function fetchTopTrending(
  limit: number,
  revalidateSeconds: number
): Promise<TrendingFetchResult> {
  const fetchedAt = new Date().toISOString();
  const key = process.env.LUNARCRUSH_API_KEY;
  if (!key) {
    return { ok: false, error: "LUNARCRUSH_API_KEY not set", fetchedAt };
  }

  const url =
    `${LC_BASE}/coins/list/v1` +
    `?sort=interactions_24h&desc=true&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${key}`,
        accept: "application/json",
      },
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `LunarCrush HTTP ${res.status}`,
        fetchedAt,
      };
    }
    const json = (await res.json()) as CoinsListResponse;
    const raw = json.data ?? [];
    const coins = raw
      .map(normalize)
      .filter((c) => c.symbol)
      .slice(0, limit);
    if (coins.length === 0) {
      return { ok: false, error: "Empty list (likely free-tier gate)", fetchedAt };
    }
    return { ok: true, coins, fetchedAt };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, fetchedAt };
  }
}

export function lunarCoinUrl(symbol: string): string {
  return `https://lunarcrush.com/coins/${encodeURIComponent(symbol.toLowerCase())}`;
}
