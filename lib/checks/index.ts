import type { CheckResult } from "./types";
import { checkRugcheck, type RugcheckDetails } from "./rugcheck";
import { checkHolders, type HoldersDetails } from "./holders";
import { checkVolume, type VolumeDetails } from "./volume";
import { checkWhales, type WhalesDetails, type WhaleTrader } from "./whales";
import { checkSocial, type SocialDetails } from "./social";
import { checkShakeout, type ShakeoutDetails } from "./shakeout";
import { checkHigherLow, type HigherLowDetails } from "./higher-low";
import { fetchOhlcv5m, type OhlcvResult } from "@/lib/sources/birdeye";
import { classifyPhase, type PhaseResult } from "@/lib/labels/phase";
import { classifySetup, type SetupResult } from "@/lib/labels/setup";
import type { DexPair } from "@/lib/sources/dexscreener";

export {
  checkRugcheck,
  checkHolders,
  checkVolume,
  checkWhales,
  checkSocial,
  checkShakeout,
  checkHigherLow,
};
export type {
  RugcheckDetails,
  HoldersDetails,
  VolumeDetails,
  WhalesDetails,
  WhaleTrader,
  SocialDetails,
  ShakeoutDetails,
  HigherLowDetails,
};

export type ChecksBundle = {
  rugcheck: CheckResult<RugcheckDetails>;
  holders: CheckResult<HoldersDetails>;
  volume: CheckResult<VolumeDetails>;
  whales: CheckResult<WhalesDetails>;
  social: CheckResult<SocialDetails>;
  shakeout: CheckResult<ShakeoutDetails>;
  higherLow: CheckResult<HigherLowDetails>;
};

export type ScanLabels = {
  phase: PhaseResult;
  setup: SetupResult;
};

export type ChecksRunResult = {
  bundle: ChecksBundle;
  labels: ScanLabels;
  ohlcv: OhlcvResult;
};

const OHLCV_HOURS = 24;

/**
 * Run all checks in parallel for a single candidate. The Dexscreener pair
 * is shared from the scan orchestrator, and the Birdeye OHLCV fetch is
 * issued once and reused by checks #6, #7, and the phase classifier.
 *
 * Phase 4: 7 checks scored — rugcheck, holders, volume, whales, social,
 * shakeout, higherLow. (#8 bundle ships in Phase 5.)
 */
export async function runChecks(input: {
  mint: string;
  ticker: string;
  pair: DexPair | null;
}): Promise<ChecksRunResult> {
  const ohlcvP = fetchOhlcv5m(input.mint, OHLCV_HOURS);
  const [rugcheck, holders, whales, social, ohlcv] = await Promise.all([
    checkRugcheck(input.mint),
    checkHolders(input.mint),
    checkWhales(input.mint),
    checkSocial(input.ticker),
    ohlcvP,
  ]);
  const volume = checkVolume(input.pair);
  const shakeout = checkShakeout(ohlcv);
  const higherLow = checkHigherLow(ohlcv);

  const bundle: ChecksBundle = {
    rugcheck,
    holders,
    volume,
    whales,
    social,
    shakeout,
    higherLow,
  };

  const ageDays = input.pair?.pairCreatedAt
    ? (Date.now() - input.pair.pairCreatedAt) / 86_400_000
    : null;
  const mcap = input.pair?.marketCap ?? input.pair?.fdv ?? null;

  const phase = classifyPhase({
    ohlcv,
    ageDays,
    shakeoutPass: shakeout.status === "PASS",
  });
  const setup = classifySetup({
    ageDays,
    mcap,
    whales: whales.status,
    social: social.status,
    shakeout: shakeout.status,
    higherLow: higherLow.status,
    bundle: null, // Phase 5
  });

  return { bundle, labels: { phase, setup }, ohlcv };
}

export const TOTAL_CHECKS = 7;

export function countGreen(bundle: ChecksBundle): number {
  let n = 0;
  if (bundle.rugcheck.status === "PASS") n++;
  if (bundle.holders.status === "PASS") n++;
  if (bundle.volume.status === "PASS") n++;
  if (bundle.whales.status === "PASS") n++;
  if (bundle.social.status === "PASS") n++;
  if (bundle.shakeout.status === "PASS") n++;
  if (bundle.higherLow.status === "PASS") n++;
  return n;
}
