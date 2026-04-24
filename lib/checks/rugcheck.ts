import { fetchJson } from "@/lib/http";
import type { CheckResult } from "./types";

type RugcheckRisk = {
  name: string;
  value?: string;
  description?: string;
  score?: number;
  level?: string;
};

type RugcheckSummary = {
  score?: number;
  score_normalised?: number;
  risks?: RugcheckRisk[];
};

export type RugcheckDetails = {
  score: number | null;
  risks: RugcheckRisk[];
  error?: string;
};

/**
 * RugCheck summary. Spec: score <20=PASS, 20–50=WARN, >50=FAIL.
 * Lower score = lower risk in RugCheck's system.
 */
export async function checkRugcheck(
  mint: string
): Promise<CheckResult<RugcheckDetails>> {
  try {
    const data = await fetchJson<RugcheckSummary>(
      `https://api.rugcheck.xyz/v1/tokens/${mint}/report/summary`
    );
    const score = typeof data.score === "number" ? data.score : null;
    const risks = data.risks ?? [];

    if (score == null) {
      return { status: "UNKNOWN", details: { score, risks, error: "No score" } };
    }
    if (score < 20) return { status: "PASS", details: { score, risks } };
    if (score <= 50) return { status: "WARN", details: { score, risks } };
    return { status: "FAIL", details: { score, risks } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "UNKNOWN",
      details: { score: null, risks: [], error: msg },
    };
  }
}
