"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckTile } from "./CheckTile";
import { WhalesPanel, type WhaleTraderView } from "./WhalesPanel";
import { formatAgeDays, formatPct, formatUsd } from "@/lib/format";
import type { candidates, results } from "@/lib/db/schema";

type CheckStatus = "PASS" | "WARN" | "FAIL" | "UNKNOWN" | null;

type Candidate = typeof candidates.$inferSelect;
type Result = typeof results.$inferSelect;

export function ResultRow({
  result,
  candidate,
}: {
  result: Result;
  candidate: Candidate;
}) {
  const [expanded, setExpanded] = useState(false);

  const rugDetails = result.rugcheckDetails as { score?: number | null } | null;
  const holdersDetails = result.holdersDetails as {
    top10Pct?: number | null;
  } | null;
  const volumeDetails = result.volumeDetails as {
    ratio?: number | null;
  } | null;
  const whalesDetails = result.whalesDetails as {
    realCount?: number | null;
    totalReturned?: number | null;
    traders?: WhaleTraderView[] | null;
    timeFrame?: string | null;
    note?: string | null;
    error?: string | null;
  } | null;
  const socialDetails = result.socialDetails as {
    galaxyScore?: number | null;
    sentiment?: number | null;
  } | null;

  const ratioPct =
    volumeDetails?.ratio != null ? volumeDetails.ratio * 100 : null;

  const realCount = whalesDetails?.realCount ?? null;
  const whalesValue =
    realCount != null
      ? `${realCount} real`
      : whalesDetails?.error
      ? "no data"
      : null;

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">
            #{result.rank ?? "—"}
          </span>
          <h3 className="text-base font-semibold tracking-tight">
            {candidate.ticker}
          </h3>
          {candidate.name ? (
            <span className="text-xs text-muted-foreground">
              {candidate.name}
            </span>
          ) : null}
          <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-medium">
            {result.greenCount}/5 green
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatUsd(result.mcap)} mcap</span>
          <span>{formatAgeDays(result.ageDays)}</span>
          {candidate.dexUrl ? (
            <Link
              href={candidate.dexUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-foreground hover:underline"
            >
              dex ↗
            </Link>
          ) : null}
          <span aria-hidden className="text-muted-foreground">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <CheckTile
          label="RugCheck"
          status={result.rugcheckStatus as CheckStatus}
          value={
            rugDetails?.score != null ? `score ${rugDetails.score}` : null
          }
        />
        <CheckTile
          label="Holders"
          status={result.holdersStatus as CheckStatus}
          value={
            holdersDetails?.top10Pct != null
              ? `top10 ${formatPct(holdersDetails.top10Pct)}`
              : null
          }
        />
        <CheckTile
          label="Volume"
          status={result.volumeStatus as CheckStatus}
          value={ratioPct != null ? `${ratioPct.toFixed(1)}% v/mc` : null}
        />
        <CheckTile
          label="Whales"
          status={result.whalesStatus as CheckStatus}
          value={whalesValue}
        />
        <CheckTile
          label="Social"
          status={result.socialStatus as CheckStatus}
          value={
            socialDetails?.galaxyScore != null
              ? `galaxy ${socialDetails.galaxyScore}`
              : socialDetails?.sentiment != null
              ? `sent ${socialDetails.sentiment}`
              : null
          }
        />
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <WhalesPanel
            realCount={whalesDetails?.realCount ?? null}
            totalReturned={whalesDetails?.totalReturned ?? null}
            traders={whalesDetails?.traders ?? null}
            timeFrame={whalesDetails?.timeFrame ?? null}
            note={whalesDetails?.note ?? null}
            error={whalesDetails?.error ?? null}
          />
        </div>
      ) : null}
    </article>
  );
}
