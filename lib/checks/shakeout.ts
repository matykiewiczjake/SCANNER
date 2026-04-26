import type { Candle5m, OhlcvResult } from "@/lib/sources/birdeye";
import type { CheckResult } from "./types";

export type ShakeoutDetails = {
  detected: boolean;
  prePeak: number | null;
  trough: number | null;
  recoveryPrice: number | null;
  dropPct: number | null;
  recoveryTargetPct: number; // 0.60
  recoveryReachedPct: number | null; // recovery / prePeak
  windowStartUnix: number | null;
  windowEndUnix: number | null;
  error?: string;
};

const WINDOW_MIN_CANDLES = 3; // 15 min
const WINDOW_MAX_CANDLES = 6; // 30 min
const DROP_MIN = 0.40;
const DROP_MAX = 0.70;
const RECOVERY_TARGET = 0.60; // recover to ≥60% of pre-dump price

const EMPTY: ShakeoutDetails = {
  detected: false,
  prePeak: null,
  trough: null,
  recoveryPrice: null,
  dropPct: null,
  recoveryTargetPct: RECOVERY_TARGET,
  recoveryReachedPct: null,
  windowStartUnix: null,
  windowEndUnix: null,
};

/**
 * Spec check #6 — shakeout survival.
 *
 * Scan rolling 15–30min windows over the last 24h of 5m candles. A window
 * is a "shakeout" when (prePeak − windowLow) / prePeak ∈ [40%, 70%], where
 * prePeak is the close of the candle immediately before the window.
 *
 * For the most recent shakeout: PASS if any subsequent candle closed at
 * ≥60% of prePeak. FAIL otherwise. WARN if no shakeout window matched.
 * UNKNOWN on missing data.
 */
export function checkShakeout(
  ohlcv: OhlcvResult
): CheckResult<ShakeoutDetails> {
  if (!ohlcv.ok) {
    return { status: "UNKNOWN", details: { ...EMPTY, error: ohlcv.error } };
  }
  const candles = ohlcv.candles;
  if (candles.length < WINDOW_MIN_CANDLES + 2) {
    return {
      status: "UNKNOWN",
      details: { ...EMPTY, error: "Not enough candles" },
    };
  }

  // Walk newest-to-oldest so the first match is the most recent shakeout.
  const lastIdx = candles.length - 1;
  let best: ShakeoutDetails | null = null;
  for (let end = lastIdx; end >= WINDOW_MIN_CANDLES; end--) {
    for (
      let size = WINDOW_MIN_CANDLES;
      size <= WINDOW_MAX_CANDLES && end - size >= 0;
      size++
    ) {
      const start = end - size + 1;
      const prevIdx = start - 1;
      if (prevIdx < 0) continue;
      const prePeak = candles[prevIdx].close;
      if (prePeak <= 0) continue;
      const window = candles.slice(start, end + 1);
      const trough = Math.min(...window.map((c) => c.low));
      const dropPct = (prePeak - trough) / prePeak;
      if (dropPct < DROP_MIN || dropPct > DROP_MAX) continue;

      const after = candles.slice(end + 1);
      const recoveryPrice = after.length
        ? Math.max(...after.map((c) => c.close))
        : trough;
      const recoveryReachedPct = recoveryPrice / prePeak;

      best = {
        detected: true,
        prePeak,
        trough,
        recoveryPrice,
        dropPct,
        recoveryTargetPct: RECOVERY_TARGET,
        recoveryReachedPct,
        windowStartUnix: candles[start].unixTime,
        windowEndUnix: candles[end].unixTime,
      };
      break;
    }
    if (best) break;
  }

  if (!best) {
    return { status: "WARN", details: { ...EMPTY } };
  }

  if (best.recoveryReachedPct != null && best.recoveryReachedPct >= RECOVERY_TARGET) {
    return { status: "PASS", details: best };
  }
  return { status: "FAIL", details: best };
}

// Re-exported for tests / future tooling.
export { WINDOW_MIN_CANDLES, WINDOW_MAX_CANDLES, DROP_MIN, DROP_MAX, RECOVERY_TARGET };
export type { Candle5m };
