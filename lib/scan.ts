import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { candidates, results, scans } from "@/lib/db/schema";
import {
  DexCache,
  fetchLatestProfiles,
  searchPairsByQuery,
  type DexPair,
} from "@/lib/sources/dexscreener";
import { countGreen, runChecks } from "@/lib/checks";

const MAX_AGE_DAYS = 12;
const MIN_MCAP = 500_000;
const MAX_MCAP = 5_000_000;
const MIN_VOL_24H = 50_000;
const MIN_LIQ = 20_000;
const CHECK_CONCURRENCY = 5;
const MAX_CHECKED = 15;

type PreparedCandidate = { mint: string; pair: DexPair };

export async function runAutoScan(): Promise<{ scanId: number }> {
  const [scanRow] = await db
    .insert(scans)
    .values({ trigger: "manual" })
    .returning({ id: scans.id });
  const scanId = scanRow.id;

  try {
    const cache = new DexCache();

    const profiles = await fetchLatestProfiles();
    const solanaProfiles = profiles.filter((p) => p.chainId === "solana");
    const rawCount = solanaProfiles.length;

    const mints = solanaProfiles.map((p) => p.tokenAddress);
    const pairsMap = await cache.getPairsBatch(mints);

    const filtered: PreparedCandidate[] = [];
    for (const profile of solanaProfiles) {
      const pair = pairsMap.get(profile.tokenAddress) ?? null;
      if (!pair) continue;
      if (!passesScanFilters(pair)) continue;
      filtered.push({ mint: profile.tokenAddress, pair });
    }

    filtered.sort(
      (a, b) => (b.pair.volume?.h24 ?? 0) - (a.pair.volume?.h24 ?? 0)
    );
    const toCheck = filtered.slice(0, MAX_CHECKED);

    const rows = await checkAll({
      scanId,
      prepared: toCheck,
      source: "scan",
    });
    const ranked = await rankAndAssign(rows);
    const top = ranked[0] ?? null;

    await db
      .update(scans)
      .set({
        completedAt: sql`now()`,
        rawCount,
        filteredCount: filtered.length,
        checkedCount: toCheck.length,
        topCandidateId: top?.candidateId ?? null,
        topGreenCount: top?.greenCount ?? null,
      })
      .where(eq(scans.id, scanId));

    return { scanId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(scans)
      .set({ completedAt: sql`now()`, errorMessage: msg })
      .where(eq(scans.id, scanId));
    throw err;
  }
}

export async function runImportScan(input: {
  mint: string;
  pair: DexPair;
}): Promise<{ scanId: number; candidateId: number }> {
  const [scanRow] = await db
    .insert(scans)
    .values({ trigger: "manual_import" })
    .returning({ id: scans.id });
  const scanId = scanRow.id;

  try {
    const rows = await checkAll({
      scanId,
      prepared: [{ mint: input.mint, pair: input.pair }],
      source: "manual_import",
    });
    const ranked = await rankAndAssign(rows);
    const top = ranked[0] ?? null;

    await db
      .update(scans)
      .set({
        completedAt: sql`now()`,
        rawCount: 1,
        filteredCount: 1,
        checkedCount: 1,
        topCandidateId: top?.candidateId ?? null,
        topGreenCount: top?.greenCount ?? null,
      })
      .where(eq(scans.id, scanId));

    if (rows.length === 0) {
      throw new Error("Import scan produced no rows");
    }
    return { scanId, candidateId: rows[0].candidateId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(scans)
      .set({ completedAt: sql`now()`, errorMessage: msg })
      .where(eq(scans.id, scanId));
    throw err;
  }
}

function passesScanFilters(pair: DexPair): boolean {
  if (pair.chainId !== "solana") return false;
  const mcap = pair.marketCap ?? pair.fdv ?? null;
  if (mcap == null || mcap < MIN_MCAP || mcap > MAX_MCAP) return false;
  const vol = pair.volume?.h24 ?? 0;
  if (vol < MIN_VOL_24H) return false;
  const liq = pair.liquidity?.usd ?? 0;
  if (liq < MIN_LIQ) return false;
  if (pair.pairCreatedAt) {
    const ageDays = (Date.now() - pair.pairCreatedAt) / 86_400_000;
    if (ageDays > MAX_AGE_DAYS) return false;
  }
  return true;
}

type CheckedRow = {
  resultId: number;
  candidateId: number;
  greenCount: number;
};

async function checkAll(args: {
  scanId: number;
  prepared: PreparedCandidate[];
  source: string;
}): Promise<CheckedRow[]> {
  const out: CheckedRow[] = [];
  for (let i = 0; i < args.prepared.length; i += CHECK_CONCURRENCY) {
    const batch = args.prepared.slice(i, i + CHECK_CONCURRENCY);
    const settled = await Promise.all(
      batch.map((p) => checkOne(args.scanId, p, args.source))
    );
    for (const row of settled) if (row) out.push(row);
  }
  return out;
}

async function checkOne(
  scanId: number,
  prepared: PreparedCandidate,
  source: string
): Promise<CheckedRow | null> {
  const { mint, pair } = prepared;
  const ticker = pair.baseToken.symbol;
  const name = pair.baseToken.name;

  const candidateId = await upsertCandidate({
    mint,
    pair,
    ticker,
    name,
    source,
  });

  const bundle = await runChecks({ mint, ticker, pair });
  const greenCount = countGreen(bundle);

  const ageDays = pair.pairCreatedAt
    ? (Date.now() - pair.pairCreatedAt) / 86_400_000
    : null;
  const priceNum = pair.priceUsd ? Number(pair.priceUsd) : null;

  const [row] = await db
    .insert(results)
    .values({
      scanId,
      candidateId,
      mcap: numOrNull(pair.marketCap ?? pair.fdv ?? null),
      price: numOrNull(priceNum),
      volume24h: numOrNull(pair.volume?.h24 ?? null),
      liquidity: numOrNull(pair.liquidity?.usd ?? null),
      ageDays: numOrNull(ageDays),
      rugcheckStatus: bundle.rugcheck.status,
      rugcheckDetails: bundle.rugcheck.details,
      holdersStatus: bundle.holders.status,
      holdersDetails: bundle.holders.details,
      volumeStatus: bundle.volume.status,
      volumeDetails: bundle.volume.details,
      whalesStatus: bundle.whales.status,
      whalesDetails: bundle.whales.details,
      socialStatus: bundle.social.status,
      socialDetails: bundle.social.details,
      greenCount,
    })
    .returning({ id: results.id });

  return { resultId: row.id, candidateId, greenCount };
}

async function upsertCandidate(input: {
  mint: string;
  pair: DexPair;
  ticker: string;
  name: string;
  source: string;
}): Promise<number> {
  const existing = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(eq(candidates.contractAddress, input.mint))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const priceNum = input.pair.priceUsd ? Number(input.pair.priceUsd) : null;

  const [row] = await db
    .insert(candidates)
    .values({
      contractAddress: input.mint,
      pairAddress: input.pair.pairAddress,
      ticker: input.ticker,
      name: input.name,
      chain: "solana",
      firstMcap: numOrNull(input.pair.marketCap ?? input.pair.fdv ?? null),
      firstPrice: numOrNull(priceNum),
      dexUrl: input.pair.url ?? null,
      source: input.source,
    })
    .returning({ id: candidates.id });
  return row.id;
}

async function rankAndAssign(rows: CheckedRow[]): Promise<CheckedRow[]> {
  const sorted = [...rows].sort((a, b) => b.greenCount - a.greenCount);
  await Promise.all(
    sorted.map((row, i) =>
      db
        .update(results)
        .set({ rank: i + 1 })
        .where(eq(results.id, row.resultId))
    )
  );
  return sorted;
}

function numOrNull(n: number | null): string | null {
  return n == null || Number.isNaN(n) ? null : String(n);
}

export { searchPairsByQuery };

export function pickTopSolanaPair(pairs: DexPair[]): DexPair | null {
  const sol = pairs.filter(
    (p) => p.chainId === "solana" && !!p.baseToken?.address
  );
  if (sol.length === 0) return null;
  return sol.reduce((best, p) => {
    const a = best.liquidity?.usd ?? 0;
    const b = p.liquidity?.usd ?? 0;
    return b > a ? p : best;
  });
}
