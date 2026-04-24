import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Memecoin Scanner
        </h1>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/history" className="hover:text-foreground">
            History
          </Link>
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="hover:text-foreground"
            >
              Logout
            </button>
          </form>
        </nav>
      </header>

      <section className="mb-6 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Import & Scan
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste contract address or ticker"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled
          />
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50"
            disabled
          >
            Scan
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Phase 1 scaffold — scanning wired up in Phase 2.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Latest scan
          </h2>
          <button
            type="button"
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium opacity-50"
            disabled
          >
            Find new
          </button>
        </div>
        <p className="py-8 text-center text-sm text-muted-foreground">
          No scans yet.
        </p>
      </section>
    </main>
  );
}
