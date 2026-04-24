import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { candidates, results, scans } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scanId = Number(id);
  if (!Number.isFinite(scanId)) {
    return NextResponse.json({ error: "Invalid scan id" }, { status: 400 });
  }

  const [scan] = await db.select().from(scans).where(eq(scans.id, scanId)).limit(1);
  if (!scan) return NextResponse.json({ scan: null, results: [] }, { status: 404 });

  const rows = await db
    .select({ result: results, candidate: candidates })
    .from(results)
    .innerJoin(candidates, eq(candidates.id, results.candidateId))
    .where(eq(results.scanId, scanId))
    .orderBy(results.rank);

  return NextResponse.json({ scan, results: rows });
}
