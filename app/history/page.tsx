import Link from "next/link";

export default function HistoryPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
        </nav>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <p className="py-8 text-center text-sm text-muted-foreground">
          No scans yet. Phase 6 wires up tracked outcomes and the full table.
        </p>
      </section>
    </main>
  );
}
