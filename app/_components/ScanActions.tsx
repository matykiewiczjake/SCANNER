"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Match = {
  pairAddress: string;
  mint: string;
  ticker: string;
  name: string | null;
  priceUsd: string | null;
  marketCap: number | null;
  liquidityUsd: number | null;
  dexUrl: string | null;
};

export function ScanActions() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleFindNew() {
    setScanning(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Scan failed");
        return;
      }
      setInfo(`Scan #${data.scanId} complete — used ${data.used}/${data.limit} today`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }

  async function postImport(body: Record<string, unknown>) {
    const res = await fetch("/api/candidates/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { res, data: (await res.json()) as Record<string, unknown> };
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setImporting(true);
    setError(null);
    setInfo(null);
    setMatches(null);
    try {
      const { res, data } = await postImport({ query: q });
      if (!res.ok) {
        setError((data.error as string) ?? "Import failed");
        return;
      }
      if (Array.isArray(data.matches)) {
        setMatches(data.matches as Match[]);
        return;
      }
      setInfo(`Scanned candidate #${data.candidateId as number}`);
      setQuery("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  async function pickMatch(m: Match) {
    setImporting(true);
    setError(null);
    setInfo(null);
    try {
      const { res, data } = await postImport({
        query: query.trim(),
        pairAddress: m.pairAddress,
      });
      if (!res.ok) {
        setError((data.error as string) ?? "Import failed");
        return;
      }
      setInfo(`Scanned ${m.ticker}`);
      setMatches(null);
      setQuery("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={handleImport}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Paste contract address or ticker"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={importing}
        />
        <button
          type="submit"
          disabled={importing || !query.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {importing ? "Scanning…" : "Import & Scan"}
        </button>
        <button
          type="button"
          onClick={handleFindNew}
          disabled={scanning}
          className="rounded-md border border-input px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {scanning ? "Finding…" : "Find new"}
        </button>
      </form>

      {error ? (
        <p className="text-xs text-fail">{error}</p>
      ) : info ? (
        <p className="text-xs text-pass">{info}</p>
      ) : null}

      {matches ? (
        <div className="rounded-md border border-border bg-background p-2">
          <p className="mb-2 text-xs text-muted-foreground">
            Multiple matches — pick one:
          </p>
          <ul className="space-y-1">
            {matches.map((m) => (
              <li key={m.pairAddress}>
                <button
                  type="button"
                  onClick={() => pickMatch(m)}
                  disabled={importing}
                  className="flex w-full items-center justify-between gap-2 rounded border border-transparent px-2 py-1 text-left text-xs hover:border-border hover:bg-accent"
                >
                  <span className="truncate">
                    <span className="font-medium">{m.ticker}</span>
                    {m.name ? <span className="ml-1 text-muted-foreground">{m.name}</span> : null}
                  </span>
                  <span className="text-muted-foreground">
                    {m.marketCap ? `$${(m.marketCap / 1000).toFixed(0)}K mcap` : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
