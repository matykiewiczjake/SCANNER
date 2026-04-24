import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { scans } from "@/lib/db/schema";

export const MANUAL_SCAN_DAILY_LIMIT = 10;

export async function countManualScansLast24h(): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(scans)
    .where(
      and(
        eq(scans.trigger, "manual"),
        gte(scans.startedAt, sql`now() - interval '24 hours'`)
      )
    );
  return rows[0]?.c ?? 0;
}
