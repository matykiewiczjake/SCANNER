import { NextResponse } from "next/server";
import { countManualScansLast24h, MANUAL_SCAN_DAILY_LIMIT } from "@/lib/rate-limit";
import { runAutoScan } from "@/lib/scan";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const used = await countManualScansLast24h();
  if (used >= MANUAL_SCAN_DAILY_LIMIT) {
    return NextResponse.json(
      {
        error: "Daily manual-scan limit reached",
        limit: MANUAL_SCAN_DAILY_LIMIT,
        used,
      },
      { status: 429 }
    );
  }

  try {
    const { scanId } = await runAutoScan();
    return NextResponse.json({ scanId, used: used + 1, limit: MANUAL_SCAN_DAILY_LIMIT });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
