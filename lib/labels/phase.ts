import type { Candle5m, OhlcvResult } from "@/lib/sources/birdeye";

export type Phase =
  | "EARLY"
  | "SWEET_SPOT"
  | "BREAKOUT_EARLY"
  | "BREAKOUT_EXTENDED"
  | "LATE"
  | "FADING";

export type PhaseTone = "green" | "orange" | "red";

const TONES: Record<Phase, PhaseTone> = {
  EARLY: "green",
  SWEET_SPOT: "green",
  BREAKOUT_EARLY: "green",
  BREAKOUT_EXTENDED: "orange",
  LATE: "orange",
  FADING: "red",
};

export function phaseTone(phase: Phase): PhaseTone {
  return TONES[phase];
}

export type PhaseInput = {
  ohlcv: OhlcvResult;
  ageDays: number | null;
  shakeoutPass: boolean;
};

export type PhaseResult = {
  phase: Phase;
  reason: string;
  moveX: number | null;
};

const RECENT_CANDLES = 6; // 30m
const PRIOR_CANDLES = 6; // the 30m before that

/**
 * Spec phase rules — deterministic on 5m OHLCV. Order matters: first
 * matching rule wins. Designed to degrade gracefully when OHLCV is empty
 * (gated tier, brand-new pair) — fall back to age-based EARLY/SWEET_SPOT.
 *
 *   EARLY              <4h old AND no >2x move
 *   LATE               up 5x+ AND last close <85% of recent high
 *   BREAKOUT_EXTENDED  up 3x+
 *   FADING             lower highs over 60m AND volume <50% of prior 30m
 *   BREAKOUT_EARLY     close at 24h high AND recent volume expanding
 *   SWEET_SPOT         post-shakeout, consolidating under prior high
 *   default            BREAKOUT_EARLY if up >1.5x, else SWEET_SPOT
 */
export function classifyPhase(input: PhaseInput): PhaseResult {
  const ageHours = input.ageDays != null ? input.ageDays * 24 : null;
  const candles: Candle5m[] = input.ohlcv.ok ? input.ohlcv.candles : [];

  if (candles.length < RECENT_CANDLES + PRIOR_CANDLES) {
    if (ageHours != null && ageHours < 4) {
      return { phase: "EARLY", reason: "<4h old, no candle history", moveX: null };
    }
    return {
      phase: "SWEET_SPOT",
      reason: "Insufficient OHLCV — defaulting to consolidating",
      moveX: null,
    };
  }

  const baseline = candles[0].close;
  const current = candles[candles.length - 1].close;
  const moveX = baseline > 0 ? current / baseline : null;

  if (ageHours != null && ageHours < 4 && (moveX ?? 0) <= 2) {
    return { phase: "EARLY", reason: "<4h old, ≤2x move", moveX };
  }

  const recent = candles.slice(-RECENT_CANDLES);
  const prior = candles.slice(-(RECENT_CANDLES + PRIOR_CANDLES), -RECENT_CANDLES);
  const recentHigh = Math.max(...recent.map((c) => c.high));
  const recentVol = recent.reduce((s, c) => s + c.volume, 0);
  const priorVol = prior.reduce((s, c) => s + c.volume, 0);
  const max24h = Math.max(...candles.map((c) => c.high));

  if (moveX != null && moveX >= 5 && current < recentHigh * 0.85) {
    return { phase: "LATE", reason: "≥5x and pulling back from high", moveX };
  }
  if (moveX != null && moveX >= 3) {
    return { phase: "BREAKOUT_EXTENDED", reason: "≥3x from baseline", moveX };
  }

  // Lower-highs: split last 12 candles into two 30m halves, compare highs.
  const last12 = candles.slice(-12);
  const firstHalfHigh = Math.max(...last12.slice(0, 6).map((c) => c.high));
  const secondHalfHigh = Math.max(...last12.slice(6).map((c) => c.high));
  const lowerHighs = secondHalfHigh < firstHalfHigh * 0.95;
  if (lowerHighs && priorVol > 0 && recentVol < priorVol * 0.5) {
    return { phase: "FADING", reason: "Lower highs, volume <50% prior 30m", moveX };
  }

  if (current >= max24h * 0.98 && priorVol > 0 && recentVol > priorVol * 1.3) {
    return {
      phase: "BREAKOUT_EARLY",
      reason: "At 24h high, volume expanding",
      moveX,
    };
  }

  if (input.shakeoutPass) {
    return {
      phase: "SWEET_SPOT",
      reason: "Post-shakeout, consolidating",
      moveX,
    };
  }

  if (moveX != null && moveX > 1.5) {
    return { phase: "BREAKOUT_EARLY", reason: ">1.5x, default uptrend", moveX };
  }
  return { phase: "SWEET_SPOT", reason: "Consolidating", moveX };
}
