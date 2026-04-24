import { formatUsd } from "@/lib/format";

export type WhaleTraderView = {
  owner: string;
  netUsd: number;
  volumeBuyUsd: number;
  volumeSellUsd: number;
  trade: number;
  tradeBuy: number;
  tradeSell: number;
  tags: string[];
};

function short(addr: string): string {
  if (!addr) return "—";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function WhalesPanel({
  realCount,
  totalReturned,
  traders,
  timeFrame,
  note,
  error,
}: {
  realCount: number | null;
  totalReturned: number | null;
  traders: WhaleTraderView[] | null;
  timeFrame: string | null;
  note: string | null;
  error: string | null;
}) {
  return (
    <section>
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium">Whale traders</h4>
        <span className="text-[11px] text-muted-foreground">
          {realCount != null && totalReturned != null
            ? `${realCount} real / ${totalReturned} returned`
            : "—"}
          {timeFrame ? ` · ${timeFrame}` : ""}
        </span>
      </header>

      {error ? (
        <p className="text-xs text-muted-foreground">Birdeye: {error}</p>
      ) : !traders || traders.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No surviving traders after bot filter.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {traders.map((t) => (
            <li
              key={t.owner}
              className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
            >
              <a
                href={`https://solscan.io/account/${t.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:underline"
              >
                {short(t.owner)}
              </a>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span title="Net USD (buy - sell)">
                  net {formatUsd(t.netUsd)}
                </span>
                <span title="Trades (buy / sell)">
                  {t.trade} tx ({t.tradeBuy}/{t.tradeSell})
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {note ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>
      ) : null}
    </section>
  );
}
