import { fetchJson } from "@/lib/http";
import type { CheckResult } from "./types";

const BIRDEYE = "https://public-api.birdeye.so";

type BirdeyeTrader = {
  tokenAddress?: string;
  owner?: string;
  tags?: string[];
  type?: string;
  volume?: number;
  trade?: number;
  tradeBuy?: number;
  tradeSell?: number;
  volumeBuy?: number;
  volumeSell?: number;
};

type BirdeyeTopTradersResponse = {
  success?: boolean;
  data?: { items?: BirdeyeTrader[] };
};

export type WhaleTrader = {
  owner: string;
  netUsd: number;
  volumeBuyUsd: number;
  volumeSellUsd: number;
  trade: number;
  tradeBuy: number;
  tradeSell: number;
  tags: string[];
};

export type WhalesDetails = {
  realCount: number;
  totalReturned: number;
  traders: WhaleTrader[];
  timeFrame: string;
  note?: string;
  error?: string;
};

const TIME_FRAME = "24h";
const MIN_POSITION_USD = 500;
const MAX_TRADES = 20;
const TOP_RESULTS = 10;

/**
 * Apply spec bot filter with free-tier approximations.
 *
 * Spec wants: exclude if hold <5min, trades >20, first-trade <2min ago, or
 * position <$500. Keep if hold ≥5min (≥30min for PASS) + trades ≤20 +
 * position ≥$500 + still holding.
 *
 * The Birdeye top_traders v2 endpoint returns ONLY aggregates over a
 * time-frame window: owner, volumeBuy, volumeSell, trade, tradeBuy,
 * tradeSell. No per-transaction timestamps, no hold duration, no
 * "first trade at" field. So V1 approximates:
 *
 *   - "position ≥ $500"     → (volumeBuy - volumeSell) ≥ $500
 *   - "still holding"       → volumeBuy > volumeSell (net buyer)
 *   - "trades ≤ 20"         → trade ≤ 20 (spec-exact)
 *   - "hold ≥ 30min" (PASS) → proxied by the above (bots flipping in
 *     minutes leave ~0 net volume or >20 trades)
 *   - "first trade <2min ago" — NOT enforced (no timestamp available)
 *
 * V2 TODO: per-wallet transaction lookup for true hold-time, once budget
 * allows extra API calls.
 */
function isRealTrader(t: BirdeyeTrader): boolean {
  const volumeBuy = t.volumeBuy ?? 0;
  const volumeSell = t.volumeSell ?? 0;
  const trades = t.trade ?? 0;
  const netUsd = volumeBuy - volumeSell;

  if (trades > MAX_TRADES) return false;
  if (volumeBuy <= volumeSell) return false;
  if (netUsd < MIN_POSITION_USD) return false;
  return true;
}

function toWhaleTrader(t: BirdeyeTrader): WhaleTrader {
  const volumeBuyUsd = t.volumeBuy ?? 0;
  const volumeSellUsd = t.volumeSell ?? 0;
  return {
    owner: t.owner ?? "",
    netUsd: volumeBuyUsd - volumeSellUsd,
    volumeBuyUsd,
    volumeSellUsd,
    trade: t.trade ?? 0,
    tradeBuy: t.tradeBuy ?? 0,
    tradeSell: t.tradeSell ?? 0,
    tags: t.tags ?? [],
  };
}

/**
 * Whale check. Spec: 3+ real traders holding >30min = PASS, 1–2 = WARN,
 * 0 = FAIL, error = UNKNOWN.
 *
 * If top_traders is gated off the caller's Birdeye tier, fetchJson throws
 * on the 401/402/403 and we surface UNKNOWN with the HTTP status tucked
 * into details.error — scan never fails on a single API being paywalled.
 */
export async function checkWhales(
  mint: string
): Promise<CheckResult<WhalesDetails>> {
  const empty: WhalesDetails = {
    realCount: 0,
    totalReturned: 0,
    traders: [],
    timeFrame: TIME_FRAME,
  };

  const key = process.env.BIRDEYE_API_KEY;
  if (!key) {
    return {
      status: "UNKNOWN",
      details: { ...empty, error: "BIRDEYE_API_KEY not set" },
    };
  }

  const url =
    `${BIRDEYE}/defi/v2/tokens/top_traders` +
    `?address=${encodeURIComponent(mint)}` +
    `&time_frame=${TIME_FRAME}` +
    `&sort_type=desc` +
    `&sort_by=volume` +
    `&offset=0` +
    `&limit=10`;

  try {
    const data = await fetchJson<BirdeyeTopTradersResponse>(url, {
      headers: {
        "X-API-KEY": key,
        "x-chain": "solana",
        accept: "application/json",
      },
    });
    const items = data.data?.items ?? [];
    const real = items.filter(isRealTrader);

    const details: WhalesDetails = {
      realCount: real.length,
      totalReturned: items.length,
      traders: real.slice(0, TOP_RESULTS).map(toWhaleTrader),
      timeFrame: TIME_FRAME,
      note:
        "Hold-time approximated via net-buyer + trades≤20 + net position ≥$500 " +
        "(Birdeye top_traders returns only aggregate fields).",
    };

    if (items.length === 0) {
      return {
        status: "UNKNOWN",
        details: { ...details, error: "No traders returned" },
      };
    }
    if (real.length >= 3) return { status: "PASS", details };
    if (real.length >= 1) return { status: "WARN", details };
    return { status: "FAIL", details };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "UNKNOWN", details: { ...empty, error: msg } };
  }
}
