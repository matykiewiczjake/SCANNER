import type { CheckResult } from "./types";
import type { DexPair } from "@/lib/sources/dexscreener";

export type VolumeDetails = {
  volume24h: number | null;
  marketCap: number | null;
  ratio: number | null;
  error?: string;
};

/**
 * Volume/mcap ratio. Spec: >10%=PASS, 3–10%=WARN, <3%=FAIL.
 * Source: Dexscreener pair volume.h24 / marketCap.
 */
export function checkVolume(pair: DexPair | null): CheckResult<VolumeDetails> {
  if (!pair) {
    return {
      status: "UNKNOWN",
      details: { volume24h: null, marketCap: null, ratio: null, error: "No pair data" },
    };
  }

  const volume24h = pair.volume?.h24 ?? null;
  const marketCap = pair.marketCap ?? pair.fdv ?? null;

  if (volume24h == null || marketCap == null || marketCap <= 0) {
    return {
      status: "UNKNOWN",
      details: { volume24h, marketCap, ratio: null, error: "Missing volume or mcap" },
    };
  }

  const ratio = volume24h / marketCap;
  const details: VolumeDetails = { volume24h, marketCap, ratio };

  if (ratio > 0.10) return { status: "PASS", details };
  if (ratio >= 0.03) return { status: "WARN", details };
  return { status: "FAIL", details };
}
