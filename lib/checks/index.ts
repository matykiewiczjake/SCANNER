import type { CheckResult } from "./types";
import { checkRugcheck, type RugcheckDetails } from "./rugcheck";
import { checkHolders, type HoldersDetails } from "./holders";
import { checkVolume, type VolumeDetails } from "./volume";
import { checkWhales, type WhalesDetails, type WhaleTrader } from "./whales";
import { checkSocial, type SocialDetails } from "./social";
import type { DexPair } from "@/lib/sources/dexscreener";

export { checkRugcheck, checkHolders, checkVolume, checkWhales, checkSocial };
export type {
  RugcheckDetails,
  HoldersDetails,
  VolumeDetails,
  WhalesDetails,
  WhaleTrader,
  SocialDetails,
};

export type ChecksBundle = {
  rugcheck: CheckResult<RugcheckDetails>;
  holders: CheckResult<HoldersDetails>;
  volume: CheckResult<VolumeDetails>;
  whales: CheckResult<WhalesDetails>;
  social: CheckResult<SocialDetails>;
};

/**
 * Run the current checks in parallel for a single candidate. Pair is passed
 * in so the scan orchestrator can share DexScreener fetches.
 *
 * Phase 3: rugcheck, holders, volume, whales (Birdeye), social. 5 checks.
 */
export async function runChecks(input: {
  mint: string;
  ticker: string;
  pair: DexPair | null;
}): Promise<ChecksBundle> {
  const [rugcheck, holders, whales, social] = await Promise.all([
    checkRugcheck(input.mint),
    checkHolders(input.mint),
    checkWhales(input.mint),
    checkSocial(input.ticker),
  ]);
  const volume = checkVolume(input.pair);
  return { rugcheck, holders, volume, whales, social };
}

export const TOTAL_CHECKS = 5;

export function countGreen(bundle: ChecksBundle): number {
  let n = 0;
  if (bundle.rugcheck.status === "PASS") n++;
  if (bundle.holders.status === "PASS") n++;
  if (bundle.volume.status === "PASS") n++;
  if (bundle.whales.status === "PASS") n++;
  if (bundle.social.status === "PASS") n++;
  return n;
}
