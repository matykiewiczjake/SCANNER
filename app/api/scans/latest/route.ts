import { NextResponse } from "next/server";
import { desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { candidates, results, scans } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const [scan] = await db
    .select()
    .from(scans)
    .where(isNotNull(scans.completedAt))
    .orderBy(desc(scans.completedAt))
    .limit(1);

  if (!scan) return NextResponse.json({ scan: null, results: [] });

  const rows = await db
    .select({
      result: results,
      candidate: candidates,
    })
    .from(results)
    .innerJoin(candidates, eq(candidates.id, results.candidateId))
    .where(eq(results.scanId, scan.id))
    .orderBy(results.rank);

  return NextResponse.json({ scan, results: rows });
}
