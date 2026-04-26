import { cn } from "@/lib/utils";
import { phaseTone, type Phase, type PhaseTone } from "@/lib/labels/phase";
import { phaseLabel, setupLabel, type SetupType } from "@/lib/labels/setup";

const TONE_STYLES: Record<PhaseTone, string> = {
  green: "border-pass/40 bg-pass/10 text-pass",
  orange: "border-warn/40 bg-warn/10 text-warn",
  red: "border-fail/40 bg-fail/10 text-fail",
};

export function PhasePill({
  phase,
  reason,
}: {
  phase: Phase | string | null;
  reason?: string | null;
}) {
  if (!phase) {
    return (
      <span className="rounded border border-unknown/40 bg-unknown/10 px-2 py-0.5 text-[11px] text-unknown">
        phase: ?
      </span>
    );
  }
  const tone = isKnownPhase(phase) ? phaseTone(phase) : "orange";
  return (
    <span
      title={reason ?? undefined}
      className={cn(
        "rounded border px-2 py-0.5 text-[11px] font-medium",
        TONE_STYLES[tone]
      )}
    >
      {phaseLabel(phase)}
    </span>
  );
}

export function SetupPill({
  setup,
  reason,
}: {
  setup: SetupType | string | null;
  reason?: string | null;
}) {
  if (!setup || setup === "NO_SETUP") {
    return (
      <span className="rounded border border-border bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">
        no setup
      </span>
    );
  }
  return (
    <span
      title={reason ?? undefined}
      className="rounded border border-border bg-accent px-2 py-0.5 text-[11px] font-medium text-foreground"
    >
      {setupLabel(setup as SetupType)}
    </span>
  );
}

function isKnownPhase(s: string): s is Phase {
  return (
    s === "EARLY" ||
    s === "SWEET_SPOT" ||
    s === "BREAKOUT_EARLY" ||
    s === "BREAKOUT_EXTENDED" ||
    s === "LATE" ||
    s === "FADING"
  );
}
