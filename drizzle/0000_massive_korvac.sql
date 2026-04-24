CREATE TABLE "candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_address" text NOT NULL,
	"pair_address" text,
	"ticker" text NOT NULL,
	"name" text,
	"chain" text DEFAULT 'solana' NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_mcap" numeric,
	"first_price" numeric,
	"dex_url" text,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holder_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	"top10_pct" numeric,
	"top10_addresses" jsonb
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer NOT NULL,
	"tracked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entry_mcap" numeric,
	"entry_price" numeric,
	"entry_green_count" integer,
	"entry_phase" text,
	"entry_setup_type" text,
	"snapshot_1h" jsonb,
	"snapshot_6h" jsonb,
	"snapshot_24h" jsonb,
	"snapshot_72h" jsonb,
	"snapshot_7d" jsonb,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" serial PRIMARY KEY NOT NULL,
	"scan_id" integer,
	"candidate_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mcap" numeric,
	"price" numeric,
	"volume_24h" numeric,
	"liquidity" numeric,
	"age_days" numeric,
	"rugcheck_status" text,
	"rugcheck_details" jsonb,
	"holders_status" text,
	"holders_details" jsonb,
	"volume_status" text,
	"volume_details" jsonb,
	"whales_status" text,
	"whales_details" jsonb,
	"social_status" text,
	"social_details" jsonb,
	"shakeout_status" text,
	"shakeout_details" jsonb,
	"higher_low_status" text,
	"higher_low_details" jsonb,
	"bundle_status" text,
	"bundle_details" jsonb,
	"collision_count" integer,
	"collision_alive_count" integer,
	"collision_details" jsonb,
	"phase" text,
	"setup_type" text,
	"green_count" integer DEFAULT 0 NOT NULL,
	"rank" integer,
	"raw_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"trigger" text NOT NULL,
	"raw_count" integer,
	"filtered_count" integer,
	"checked_count" integer,
	"top_candidate_id" integer,
	"top_green_count" integer,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "holder_snapshots" ADD CONSTRAINT "holder_snapshots_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_top_candidate_id_candidates_id_fk" FOREIGN KEY ("top_candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_contract_address_idx" ON "candidates" USING btree ("contract_address");--> statement-breakpoint
CREATE INDEX "holder_snapshots_candidate_at_idx" ON "holder_snapshots" USING btree ("candidate_id","snapshot_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outcomes_candidate_idx" ON "outcomes" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "results_scan_rank_idx" ON "results" USING btree ("scan_id","rank");--> statement-breakpoint
CREATE INDEX "results_candidate_scan_idx" ON "results" USING btree ("candidate_id","scan_id");