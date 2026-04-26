"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckTile } from "./CheckTile";
import { WhalesPanel, type WhaleTraderView } from "./WhalesPanel";
import { PhasePill, SetupPill } from "./PhasePill";
import { formatAgeDays, formatPct, formatUsd } from "@/lib/format";
import { TOTAL_CHECKS } from "@/lib/checks";
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
  const shakeoutDetails = result.shakeoutDetails as {
    detected?: boolean | null;
    dropPct?: number | null;
    recoveryReachedPct?: number | null;
    recoveryTargetPct?: number | null;
    prePeak?: number | null;
    trough?: number | null;
    recoveryPrice?: number | null;
    error?: string | null;
  } | null;
  const higherLowDetails = result.higherLowDetails as {
    lowsFound?: number | null;
    trend?: "higher" | "lower" | "flat" | null;
    diffPct?: number | null;
    earliestLow?: number | null;
    latestLow?: number | null;
    error?: string | null;
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

  const shakeoutValue = (() => {
    if (shakeoutDetails?.detected && shakeoutDetails.dropPct != null) {
      const drop = (shakeoutDetails.dropPct * 100).toFixed(0);
      const rec =
        shakeoutDetails.recoveryReachedPct != null
          ? `${(shakeoutDetails.recoveryReachedPct * 100).toFixed(0)}%`
          : "—";
      return `−${drop}% → ${rec}`;
    }
    if (result.shakeoutStatus === "WARN") return "no shakeout";
    if (shakeoutDetails?.error) return "no data";
    return null;
  })();

  const higherLowValue = (() => {
    const t = higherLowDetails?.trend;
    if (t === "higher") return "higher low";
    if (t === "lower") return "lower low";
    if (t === "flat") return "flat lows";
    if ((higherLowDetails?.lowsFound ?? 0) < 2) return "<2 lows";
    return null;
  })();

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mb-2 flex w-full flex-wrap items-center justify-between gap-2 text-left"
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
            {result.greenCount}/{TOTAL_CHECKS} green
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

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <PhasePill phase={result.phase} />
        <SetupPill setup={result.setupType} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
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
        <CheckTile
          label="Shakeout"
          status={result.shakeoutStatus as CheckStatus}
          value={shakeoutValue}
        />
        <CheckTile
          label="HigherLow"
          status={result.higherLowStatus as CheckStatus}
          value={higherLowValue}
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
          <OhlcvPanel
            shakeout={shakeoutDetails}
            higherLow={higherLowDetails}
            shakeoutStatus={result.shakeoutStatus as CheckStatus}
            higherLowStatus={result.higherLowStatus as CheckStatus}
          />
        </div>
      ) : null}
    </article>
  );
}

function OhlcvPanel({
  shakeout,
  higherLow,
  shakeoutStatus,
  higherLowStatus,
}: {
  shakeout: {
    detected?: boolean | null;
    dropPct?: number | null;
    recoveryReachedPct?: number | null;
    recoveryTargetPct?: number | null;
    prePeak?: number | null;
    trough?: number | null;
    recoveryPrice?: number | null;
    error?: string | null;
  } | null;
  higherLow: {
    lowsFound?: number | null;
    trend?: "higher" | "lower" | "flat" | null;
    diffPct?: number | null;
    earliestLow?: number | null;
    latestLow?: number | null;
    error?: string | null;
  } | null;
  shakeoutStatus: CheckStatus;
  higherLowStatus: CheckStatus;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
      <section className="rounded-md border border-border p-3">
        <h4 className="mb-2 text-xs font-medium text-foreground">
          Shakeout survival ({shakeoutStatus ?? "UNKNOWN"})
        </h4>
        {shakeout?.error ? (
          <p className="text-muted-foreground">{shakeout.error}</p>
        ) : shakeout?.detected ? (
          <dl className="grid grid-cols-2 gap-y-1 text-[11px]">
            <dt className="text-muted-foreground">Drop</dt>
            <dd>
              {shakeout.dropPct != null
                ? `${(shakeout.dropPct * 100).toFixed(0)}%`
                : "—"}
            </dd>
            <dt className="text-muted-foreground">Pre-peak</dt>
            <dd>{shakeout.prePeak != null ? shakeout.prePeak.toPrecision(4) : "—"}</dd>
            <dt className="text-muted-foreground">Trough</dt>
            <dd>{shakeout.trough != null ? shakeout.trough.toPrecision(4) : "—"}</dd>
            <dt className="text-muted-foreground">Recovery</dt>
            <dd>
              {shakeout.recoveryPrice != null
                ? shakeout.recoveryPrice.toPrecision(4)
                : "—"}
              {shakeout.recoveryReachedPct != null
                ? ` (${(shakeout.recoveryReachedPct * 100).toFixed(0)}% / target ${(
                    (shakeout.recoveryTargetPct ?? 0.6) * 100
                  ).toFixed(0)}%)`
                : null}
            </dd>
          </dl>
        ) : (
          <p className="text-muted-foreground">
            No 40–70% shakeout window detected in last 24h.
          </p>
        )}
      </section>

      <section className="rounded-md border border-border p-3">
        <h4 className="mb-2 text-xs font-medium text-foreground">
          5m higher-low ({higherLowStatus ?? "UNKNOWN"})
        </h4>
        {higherLow?.error ? (
          <p className="text-muted-foreground">{higherLow.error}</p>
        ) : (higherLow?.lowsFound ?? 0) >= 2 ? (
          <dl className="grid grid-cols-2 gap-y-1 text-[11px]">
            <dt className="text-muted-foreground">Lows found</dt>
            <dd>{higherLow?.lowsFound}</dd>
            <dt className="text-muted-foreground">Trend</dt>
            <dd>{higherLow?.trend}</dd>
            <dt className="text-muted-foreground">Earliest</dt>
            <dd>
              {higherLow?.earliestLow != null
                ? higherLow.earliestLow.toPrecision(4)
                : "—"}
            </dd>
            <dt className="text-muted-foreground">Latest</dt>
            <dd>
              {higherLow?.latestLow != null
                ? higherLow.latestLow.toPrecision(4)
                : "—"}
            </dd>
            <dt className="text-muted-foreground">Diff</dt>
            <dd>
              {higherLow?.diffPct != null
                ? `${(higherLow.diffPct * 100).toFixed(2)}%`
                : "—"}
            </dd>
          </dl>
        ) : (
          <p className="text-muted-foreground">Insufficient pivot lows.</p>
        )}
      </section>
    </div>
  );
}
