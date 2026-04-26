import type { Candle5m, OhlcvResult } from "@/lib/sources/birdeye";
import type { CheckResult } from "./types";

export type HigherLowDetails = {
  lowsFound: number;
  earliestLow: number | null;
  latestLow: number | null;
  earliestLowUnix: number | null;
  latestLowUnix: number | null;
  trend: "higher" | "lower" | "flat" | null;
  diffPct: number | null;
  windowMinutes: number;
  error?: string;
};

const WINDOW_MINUTES = 120; // last 2hr
const CANDLE_MINUTES = 5;
const PIVOT_LOOKBACK = 2; // a "local low" is the min over a 5-candle pivot window
const FLAT_TOLERANCE_PCT = 0.01; // ±1% counts as flat

const EMPTY: HigherLowDetails = {
  lowsFound: 0,
  earliestLow: null,
  latestLow: null,
  earliestLowUnix: null,
  latestLowUnix: null,
  trend: null,
  diffPct: null,
  windowMinutes: WINDOW_MINUTES,
};

/**
 * Spec check #7 — 5m higher-low.
 *
 * Slice last 2hr (≈24 5m candles). Find local lows via a ±2-candle pivot
 * window (a candle whose low is the min across itself and its two
 * neighbours on each side). Need ≥2 lows. Compare earliest vs latest:
 * higher → PASS, lower → FAIL, within ±1% → WARN. <2 lows → UNKNOWN.
 */
export function checkHigherLow(
  ohlcv: OhlcvResult
): CheckResult<HigherLowDetails> {
  if (!ohlcv.ok) {
    return { status: "UNKNOWN", details: { ...EMPTY, error: ohlcv.error } };
  }

  const expected = WINDOW_MINUTES / CANDLE_MINUTES;
  const window = ohlcv.candles.slice(-expected);
  if (window.length < PIVOT_LOOKBACK * 2 + 2) {
    return {
      status: "UNKNOWN",
      details: { ...EMPTY, error: "Not enough candles in 2h window" },
    };
  }

  const lows: { low: number; unix: number }[] = [];
  for (let i = PIVOT_LOOKBACK; i < window.length - PIVOT_LOOKBACK; i++) {
    const slice = window.slice(i - PIVOT_LOOKBACK, i + PIVOT_LOOKBACK + 1);
    const minLow = Math.min(...slice.map((c) => c.low));
    if (window[i].low === minLow) {
      lows.push({ low: window[i].low, unix: window[i].unixTime });
    }
  }

  if (lows.length < 2) {
    return {
      status: "UNKNOWN",
      details: {
        ...EMPTY,
        lowsFound: lows.length,
        error: "Fewer than 2 local lows",
      },
    };
  }

  const earliest = lows[0];
  const latest = lows[lows.length - 1];
  const diffPct = (latest.low - earliest.low) / earliest.low;

  let trend: "higher" | "lower" | "flat";
  if (Math.abs(diffPct) <= FLAT_TOLERANCE_PCT) trend = "flat";
  else if (diffPct > 0) trend = "higher";
  else trend = "lower";

  const details: HigherLowDetails = {
    lowsFound: lows.length,
    earliestLow: earliest.low,
    latestLow: latest.low,
    earliestLowUnix: earliest.unix,
    latestLowUnix: latest.unix,
    trend,
    diffPct,
    windowMinutes: WINDOW_MINUTES,
  };

  if (trend === "higher") return { status: "PASS", details };
  if (trend === "lower") return { status: "FAIL", details };
  return { status: "WARN", details };
}

export type { Candle5m };
