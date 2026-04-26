import Link from "next/link";
import { fetchTopTrending, lunarCoinUrl } from "@/lib/sources/lunarcrush";
import { formatRelative } from "@/lib/format";

const TOP_N = 5;
const REVALIDATE_SECONDS = 12 * 60 * 60;

export const revalidate = REVALIDATE_SECONDS;

function compactNumber(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function sentimentLabel(s: number | null): { text: string; tone: string } {
  if (s == null) return { text: "—", tone: "text-muted-foreground" };
  if (s >= 60) return { text: `${s.toFixed(0)} positive`, tone: "text-pass" };
  if (s < 40) return { text: `${s.toFixed(0)} negative`, tone: "text-fail" };
  return { text: `${s.toFixed(0)} neutral`, tone: "text-warn" };
}

function changeLabel(p: number | null): { text: string; tone: string } {
  if (p == null) return { text: "—", tone: "text-muted-foreground" };
  const sign = p > 0 ? "+" : "";
  if (p > 0) return { text: `${sign}${p.toFixed(1)}%`, tone: "text-pass" };
  if (p < 0) return { text: `${p.toFixed(1)}%`, tone: "text-fail" };
  return { text: "0.0%", tone: "text-muted-foreground" };
}

export default async function TrendingPage() {
  const result = await fetchTopTrending(TOP_N, REVALIDATE_SECONDS);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Trending on X
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Top {TOP_N} most-talked-about coins from LunarCrush · refreshes
            every 12h ·{" "}
            {result.ok ? formatRelative(result.fetchedAt) : "no data"}
          </p>
        </div>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <Link href="/history" className="hover:text-foreground">
            History
          </Link>
        </nav>
      </header>

      {!result.ok ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="py-8 text-center text-sm text-muted-foreground">
            Couldn't load trending coins from LunarCrush ({result.error}). The
            list endpoint may be gated on the free tier — open the page on
            LunarCrush directly:{" "}
            <a
              href="https://lunarcrush.com/coins"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:underline"
            >
              lunarcrush.com/coins ↗
            </a>
          </p>
        </section>
      ) : (
        <ol className="space-y-3">
          {result.coins.map((c, i) => {
            const sent = sentimentLabel(c.sentiment);
            const change = changeLabel(c.percentChange24h);
            return (
              <li
                key={c.symbol + i}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground">
                      #{i + 1}
                    </span>
                    <h2 className="text-base font-semibold tracking-tight">
                      {c.symbol}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {c.name}
                    </span>
                  </div>
                  <a
                    href={lunarCoinUrl(c.symbol)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-foreground hover:underline"
                  >
                    LunarCrush ↗
                  </a>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Mentions 24h</dt>
                    <dd className="font-medium">
                      {compactNumber(c.socialVolume24h)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Interactions 24h</dt>
                    <dd className="font-medium">
                      {compactNumber(c.interactions24h)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sentiment</dt>
                    <dd className={`font-medium ${sent.tone}`}>{sent.text}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Price 24h</dt>
                    <dd className={`font-medium ${change.tone}`}>
                      {change.text}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-6 text-[11px] text-muted-foreground">
        Tweet bodies aren't shown — LunarCrush gates the per-coin posts
        endpoint above the free tier. Click the LunarCrush link on any row to
        see the actual posts.
      </p>
    </main>
  );
}
