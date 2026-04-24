export type CheckStatus = "PASS" | "WARN" | "FAIL" | "UNKNOWN";

export type CheckResult<D = Record<string, unknown>> = {
  status: CheckStatus;
  details: D;
};

export function isGreen(status: CheckStatus | null | undefined): boolean {
  return status === "PASS";
}
