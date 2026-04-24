import type { CheckResult } from "./types";
import { checkRugcheck, type RugcheckDetails } from "./rugcheck";
import { checkHolders, type HoldersDetails } from "./holders";
import { checkVolume, type VolumeDetails } from "./volume";
import { checkSocial, type SocialDetails } from "./social";
import type { DexPair } from "@/lib/sources/dexscreener";

export { checkRugcheck, checkHolders, checkVolume, checkSocial };
export type { RugcheckDetails, HoldersDetails, VolumeDetails, SocialDetails };

export type ChecksBundle = {
  rugcheck: CheckResult<RugcheckDetails>;
  holders: CheckResult<HoldersDetails>;
  volume: CheckResult<VolumeDetails>;
  social: CheckResult<SocialDetails>;
};

/**
 * Run Phase 2's 4 checks in parallel for a single candidate.
 * Pair is passed in so the scan orchestrator can share DexScreener fetches.
 */
export async function runPhase2Checks(input: {
  mint: string;
  ticker: string;
  pair: DexPair | null;
}): Promise<ChecksBundle> {
  const [rugcheck, holders, social] = await Promise.all([
    checkRugcheck(input.mint),
    checkHolders(input.mint),
    checkSocial(input.ticker),
  ]);
  const volume = checkVolume(input.pair);
  return { rugcheck, holders, volume, social };
}

export function countGreen(bundle: ChecksBundle): number {
  let n = 0;
  if (bundle.rugcheck.status === "PASS") n++;
  if (bundle.holders.status === "PASS") n++;
  if (bundle.volume.status === "PASS") n++;
  if (bundle.social.status === "PASS") n++;
  return n;
}
