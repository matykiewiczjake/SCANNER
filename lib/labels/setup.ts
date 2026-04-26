import type { CheckStatus } from "@/lib/checks/types";

export type SetupType =
  | "QUICK_FLIP"
  | "HYPE_CATCH_MOONBAG"
  | "CONVICTION"
  | "NO_SETUP";

export type SetupInput = {
  ageDays: number | null;
  mcap: number | null;
  whales: CheckStatus; // check #4
  social: CheckStatus; // check #5
  shakeout: CheckStatus; // check #6
  higherLow: CheckStatus; // check #7
  bundle: CheckStatus | null; // check #8 — Phase 5, may be absent
};

export type SetupResult = {
  setupType: SetupType;
  reason: string;
};

const QUICK_FLIP_AGE_HOURS = 2;
const QUICK_FLIP_MCAP_MIN = 150_000;
const QUICK_FLIP_MCAP_MAX = 400_000;
const CONVICTION_AGE_DAYS = 5;

/**
 * Spec setup-type archetypes. First matching rule wins.
 *
 *   Quick Flip            age<2h + mcap $150K–$400K + #7 PASS + #5 PASS
 *   Hype Catch + Moonbag  #4 PASS + #5 PASS + #6 PASS
 *   Conviction            age>5d + #8 PASS + #4 PASS  (only fires once #8 ships)
 *   No Setup              default
 *
 * Descriptive only — never a buy recommendation.
 */
export function classifySetup(input: SetupInput): SetupResult {
  const ageHours = input.ageDays != null ? input.ageDays * 24 : null;

  if (
    ageHours != null &&
    ageHours < QUICK_FLIP_AGE_HOURS &&
    input.mcap != null &&
    input.mcap >= QUICK_FLIP_MCAP_MIN &&
    input.mcap <= QUICK_FLIP_MCAP_MAX &&
    input.higherLow === "PASS" &&
    input.social === "PASS"
  ) {
    return {
      setupType: "QUICK_FLIP",
      reason: "<2h, $150K–$400K mcap, higher-low + social PASS",
    };
  }

  if (
    input.whales === "PASS" &&
    input.social === "PASS" &&
    input.shakeout === "PASS"
  ) {
    return {
      setupType: "HYPE_CATCH_MOONBAG",
      reason: "Whales + social + shakeout-survival all PASS",
    };
  }

  if (
    input.ageDays != null &&
    input.ageDays > CONVICTION_AGE_DAYS &&
    input.bundle === "PASS" &&
    input.whales === "PASS"
  ) {
    return {
      setupType: "CONVICTION",
      reason: ">5d old, accumulating bundle + whales PASS",
    };
  }

  return { setupType: "NO_SETUP", reason: "No archetype matched" };
}

export function setupLabel(setup: SetupType): string {
  switch (setup) {
    case "QUICK_FLIP":
      return "Quick Flip";
    case "HYPE_CATCH_MOONBAG":
      return "Hype Catch + Moonbag";
    case "CONVICTION":
      return "Conviction";
    default:
      return "No Setup";
  }
}

export function phaseLabel(phase: string): string {
  switch (phase) {
    case "EARLY":
      return "Early";
    case "SWEET_SPOT":
      return "Sweet Spot";
    case "BREAKOUT_EARLY":
      return "Breakout (early)";
    case "BREAKOUT_EXTENDED":
      return "Breakout (extended)";
    case "LATE":
      return "Late";
    case "FADING":
      return "Fading";
    default:
      return phase;
  }
}
