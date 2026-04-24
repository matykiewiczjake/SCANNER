import { fetchJson } from "@/lib/http";
import type { CheckResult } from "./types";

type LunarCoin = {
  galaxy_score?: number;
  alt_rank?: number;
  sentiment?: number;
  social_volume_24h?: number;
  interactions_24h?: number;
  percent_change_24h?: number;
  social_dominance?: number;
};

type LunarResponse = { data?: LunarCoin };

export type SocialDetails = {
  galaxyScore: number | null;
  altRank: number | null;
  sentiment: number | null;
  mentions24h: number | null;
  error?: string;
};

/**
 * LunarCrush 24h mentions + sentiment + growth.
 * Spec: rising+positive=PASS, flat=WARN, falling/empty=FAIL or UNKNOWN.
 * Free-tier usually returns UNKNOWN (README calls this out explicitly).
 */
export async function checkSocial(
  ticker: string
): Promise<CheckResult<SocialDetails>> {
  const empty: SocialDetails = {
    galaxyScore: null,
    altRank: null,
    sentiment: null,
    mentions24h: null,
  };

  const key = process.env.LUNARCRUSH_API_KEY;
  if (!key) {
    return {
      status: "UNKNOWN",
      details: { ...empty, error: "LUNARCRUSH_API_KEY not set" },
    };
  }

  const symbol = ticker.replace(/^\$/, "").trim().toUpperCase();
  if (!symbol) {
    return { status: "UNKNOWN", details: { ...empty, error: "Empty ticker" } };
  }

  try {
    const data = await fetchJson<LunarResponse>(
      `https://lunarcrush.com/api4/public/coins/${encodeURIComponent(symbol)}/v1`,
      { headers: { authorization: `Bearer ${key}` } }
    );
    const coin = data.data;
    if (!coin) {
      return {
        status: "UNKNOWN",
        details: { ...empty, error: "No data (likely free-tier gate)" },
      };
    }

    const galaxyScore = coin.galaxy_score ?? null;
    const altRank = coin.alt_rank ?? null;
    const sentiment = coin.sentiment ?? null;
    const mentions24h = coin.interactions_24h ?? coin.social_volume_24h ?? null;
    const details: SocialDetails = { galaxyScore, altRank, sentiment, mentions24h };

    if (sentiment == null && mentions24h == null && galaxyScore == null) {
      return { status: "UNKNOWN", details: { ...details, error: "All fields empty" } };
    }

    // Normalize sentiment: LunarCrush has historically used 0–100.
    const positive = sentiment != null ? sentiment >= 60 : galaxyScore != null && galaxyScore >= 60;
    const negative = sentiment != null ? sentiment < 40 : false;
    const hasMentions = (mentions24h ?? 0) > 0;

    if (positive && hasMentions) return { status: "PASS", details };
    if (negative || (mentions24h != null && mentions24h === 0)) {
      return { status: "FAIL", details };
    }
    return { status: "WARN", details };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "UNKNOWN", details: { ...empty, error: msg } };
  }
}
