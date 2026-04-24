import { relations, sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const candidates = pgTable(
  "candidates",
  {
    id: serial("id").primaryKey(),
    contractAddress: text("contract_address").notNull(),
    pairAddress: text("pair_address"),
    ticker: text("ticker").notNull(),
    name: text("name"),
    chain: text("chain").notNull().default("solana"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    firstMcap: numeric("first_mcap"),
    firstPrice: numeric("first_price"),
    dexUrl: text("dex_url"),
    source: text("source").notNull(),
  },
  (t) => ({
    contractAddressIdx: uniqueIndex("candidates_contract_address_idx").on(
      t.contractAddress
    ),
  })
);

export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  trigger: text("trigger").notNull(),
  rawCount: integer("raw_count"),
  filteredCount: integer("filtered_count"),
  checkedCount: integer("checked_count"),
  topCandidateId: integer("top_candidate_id").references(() => candidates.id),
  topGreenCount: integer("top_green_count"),
  errorMessage: text("error_message"),
});

export const results = pgTable(
  "results",
  {
    id: serial("id").primaryKey(),
    scanId: integer("scan_id").references(() => scans.id),
    candidateId: integer("candidate_id")
      .notNull()
      .references(() => candidates.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),

    mcap: numeric("mcap"),
    price: numeric("price"),
    volume24h: numeric("volume_24h"),
    liquidity: numeric("liquidity"),
    ageDays: numeric("age_days"),

    rugcheckStatus: text("rugcheck_status"),
    rugcheckDetails: jsonb("rugcheck_details"),
    holdersStatus: text("holders_status"),
    holdersDetails: jsonb("holders_details"),
    volumeStatus: text("volume_status"),
    volumeDetails: jsonb("volume_details"),
    whalesStatus: text("whales_status"),
    whalesDetails: jsonb("whales_details"),
    socialStatus: text("social_status"),
    socialDetails: jsonb("social_details"),
    shakeoutStatus: text("shakeout_status"),
    shakeoutDetails: jsonb("shakeout_details"),
    higherLowStatus: text("higher_low_status"),
    higherLowDetails: jsonb("higher_low_details"),
    bundleStatus: text("bundle_status"),
    bundleDetails: jsonb("bundle_details"),

    collisionCount: integer("collision_count"),
    collisionAliveCount: integer("collision_alive_count"),
    collisionDetails: jsonb("collision_details"),

    phase: text("phase"),
    setupType: text("setup_type"),
    greenCount: integer("green_count").notNull().default(0),
    rank: integer("rank"),

    rawData: jsonb("raw_data"),
  },
  (t) => ({
    scanRankIdx: index("results_scan_rank_idx").on(t.scanId, t.rank),
    candidateScanIdx: index("results_candidate_scan_idx").on(
      t.candidateId,
      t.scanId
    ),
  })
);

export const holderSnapshots = pgTable(
  "holder_snapshots",
  {
    id: serial("id").primaryKey(),
    candidateId: integer("candidate_id")
      .notNull()
      .references(() => candidates.id),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    top10Pct: numeric("top10_pct"),
    top10Addresses: jsonb("top10_addresses"),
  },
  (t) => ({
    candidateSnapshotIdx: index("holder_snapshots_candidate_at_idx").on(
      t.candidateId,
      t.snapshotAt
    ),
  })
);

export const outcomes = pgTable(
  "outcomes",
  {
    id: serial("id").primaryKey(),
    candidateId: integer("candidate_id")
      .notNull()
      .references(() => candidates.id),
    trackedAt: timestamp("tracked_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    entryMcap: numeric("entry_mcap"),
    entryPrice: numeric("entry_price"),
    entryGreenCount: integer("entry_green_count"),
    entryPhase: text("entry_phase"),
    entrySetupType: text("entry_setup_type"),
    snapshot1h: jsonb("snapshot_1h"),
    snapshot6h: jsonb("snapshot_6h"),
    snapshot24h: jsonb("snapshot_24h"),
    snapshot72h: jsonb("snapshot_72h"),
    snapshot7d: jsonb("snapshot_7d"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    candidateIdx: uniqueIndex("outcomes_candidate_idx").on(t.candidateId),
  })
);

export const candidatesRelations = relations(candidates, ({ many, one }) => ({
  results: many(results),
  holderSnapshots: many(holderSnapshots),
  outcome: one(outcomes),
}));

export const scansRelations = relations(scans, ({ many, one }) => ({
  results: many(results),
  topCandidate: one(candidates, {
    fields: [scans.topCandidateId],
    references: [candidates.id],
  }),
}));

export const resultsRelations = relations(results, ({ one }) => ({
  scan: one(scans, { fields: [results.scanId], references: [scans.id] }),
  candidate: one(candidates, {
    fields: [results.candidateId],
    references: [candidates.id],
  }),
}));

export const holderSnapshotsRelations = relations(holderSnapshots, ({ one }) => ({
  candidate: one(candidates, {
    fields: [holderSnapshots.candidateId],
    references: [candidates.id],
  }),
}));

export const outcomesRelations = relations(outcomes, ({ one }) => ({
  candidate: one(candidates, {
    fields: [outcomes.candidateId],
    references: [candidates.id],
  }),
}));
