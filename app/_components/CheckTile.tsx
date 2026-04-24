import { cn } from "@/lib/utils";

type Props = {
  label: string;
  status: "PASS" | "WARN" | "FAIL" | "UNKNOWN" | null | undefined;
  value?: string | null;
  title?: string;
};

const STYLES: Record<"PASS" | "WARN" | "FAIL" | "UNKNOWN", string> = {
  PASS: "border-pass/40 bg-pass/10 text-pass",
  WARN: "border-warn/40 bg-warn/10 text-warn",
  FAIL: "border-fail/40 bg-fail/10 text-fail",
  UNKNOWN: "border-unknown/40 bg-unknown/10 text-unknown",
};

const ICONS: Record<"PASS" | "WARN" | "FAIL" | "UNKNOWN", string> = {
  PASS: "✓",
  WARN: "!",
  FAIL: "✕",
  UNKNOWN: "?",
};

export function CheckTile({ label, status, value, title }: Props) {
  const s = status ?? "UNKNOWN";
  return (
    <div
      title={title}
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-md border px-2 py-1.5 text-xs",
        STYLES[s]
      )}
    >
      <div className="flex items-center gap-1.5 font-medium">
        <span aria-hidden>{ICONS[s]}</span>
        <span className="truncate">{label}</span>
      </div>
      {value ? <div className="truncate text-[11px] opacity-80">{value}</div> : null}
    </div>
  );
}
