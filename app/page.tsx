import Link from "next/link";
import { desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { candidates, results, scans } from "@/lib/db/schema";
import { ScanActions } from "./_components/ScanActions";
import { ResultRow } from "./_components/ResultRow";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

async function getLatest() {
  const [scan] = await db
    .select()
    .from(scans)
    .where(isNotNull(scans.completedAt))
    .orderBy(desc(scans.completedAt))
    .limit(1);
  if (!scan) return { scan: null as null | typeof scan, rows: [] as never[] };

  const rows = await db
    .select({ result: results, candidate: candidates })
    .from(results)
    .innerJoin(candidates, eq(candidates.id, results.candidateId))
    .where(eq(results.scanId, scan.id))
    .orderBy(results.rank);

  return { scan, rows };
}

export default async function HomePage() {
  const { scan, rows } = await getLatest();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Memecoin Scanner
        </h1>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/trending" className="hover:text-foreground">
            Trending
          </Link>
          <Link href="/history" className="hover:text-foreground">
            History
          </Link>
          <form action="/api/logout" method="post">
            <button type="submit" className="hover:text-foreground">
              Logout
            </button>
          </form>
        </nav>
      </header>

      <section className="mb-6 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Import & Scan
        </h2>
        <ScanActions />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Latest scan
          </h2>
          {scan ? (
            <span className="text-xs text-muted-foreground">
              {formatRelative(scan.completedAt)} · {scan.checkedCount ?? 0}{" "}
              checked / {scan.filteredCount ?? 0} filtered /{" "}
              {scan.rawCount ?? 0} raw
            </span>
          ) : null}
        </div>

        {!scan ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="py-8 text-center text-sm text-muted-foreground">
              No scans yet. Click <span className="font-medium">Find new</span>{" "}
              to run one, or paste a contract address above.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="py-8 text-center text-sm text-muted-foreground">
              Scan completed but no candidates passed the filter (age ≤12d,
              mcap $500K–$5M, vol ≥$50K, liq ≥$20K).
            </p>
          </div>
        ) : (
          rows.map(({ result, candidate }) => (
            <ResultRow key={result.id} result={result} candidate={candidate} />
          ))
        )}
      </section>
    </main>
  );
}
