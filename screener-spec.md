# Memecoin Scanner — Master Spec

**Goal: build and deploy V1 in ONE focused session. $0/month. Free tier APIs only.**

Paste as first message to Claude Code in a new empty repo.

---

## Context

I built an Events CRM with Claude Code before — same stack. I'm a beginner. Walk me through what you're doing. Define jargon. Build in phases. Don't skip ahead.

This consolidates what I do across RugCheck + Dexscreener + Birdeye + LunarCrush + X into one screen. Design is informed by my trading journal (separate doc).

---

## What we're building

A Solana memecoin scanner that:

1. **Auto-scans hourly** for Solana coins <12d old, $500K–$5M mcap
2. **Manual import** — paste contract address OR ticker to scan any coin
3. **Runs 8 checks** per coin from free APIs
4. **Labels** each coin with phase and setup type
5. **Shows ticker/name collision count** (informational)
6. **Ranks** by green-check count, best first
7. **Track star** — I tap to opt coins into outcome monitoring (1h/6h/24h/72h/7d)
8. **History tab** for all coins ever scanned

No wallet list management. No background wallet polling. Whale data fetched per-coin from Birdeye during scans.

Single user. Password-gated. Netlify deploy.

---

## Stack

Next.js 15 App Router, TypeScript, Tailwind + shadcn/ui, lucide-react, Drizzle on Neon, Netlify. Password gate via middleware + cookie, same as my Events CRM. No Anthropic API in V1.

---

## Env vars

- `DATABASE_URL` (Neon pooled)
- `DASHBOARD_PASSWORD`
- `HELIUS_API_KEY`
- `BIRDEYE_API_KEY`
- `LUNARCRUSH_API_KEY`
- `CRON_SECRET`

All free tier.

---

## The 8 checks

Each returns PASS/WARN/FAIL/UNKNOWN. Only PASS counts toward green_count. Max 8.

**1. RugCheck** — GET rugcheck.xyz summary. <20=PASS, 20–50=WARN, >50=FAIL.

**2. Top 10 holders** — Helius `getTokenLargestAccounts`. <25%=PASS, 25–45%=WARN, >45%=FAIL. Bar is loose because memecoin winners often have 35%+ bundles.

**3. Volume/mcap ratio** — Dexscreener, volume.h24/marketCap. >10%=PASS, 3–10%=WARN, <3%=FAIL.

**4. Whale activity (Birdeye, bot-filtered)** — `/defi/v2/tokens/top_traders`. Apply bot filter (below). 3+ real traders holding >30min=PASS, 1–2=WARN, 0 real=FAIL, error=UNKNOWN. Store filtered traders in whales_details.

**5. Social (LunarCrush)** — coin endpoint for 24h mentions, sentiment, growth. Rising+positive=PASS, flat=WARN, falling/empty=FAIL or UNKNOWN.

**6. Shakeout survival (journal)** — Birdeye 5m OHLCV last 24h. Detect -40% to -70% dump in 15-30min, recovery to ≥60% of pre-dump. Recovered=PASS, failed=FAIL, no shakeout yet=WARN, no data=UNKNOWN.

**7. 5m higher-low (journal)** — same candles. Last 2hr: find ≥2 local lows, recent higher. Higher low=PASS, lower low=FAIL, flat=WARN, insufficient=UNKNOWN.

**8. Bundle behavior over time (journal, needs history)** — snapshot top10_pct every scan to `holder_snapshots`. Delta=current-earliest. Δ≤-10%=FAIL, -10 to -3%=WARN, -3 to +5%=PASS, >+5%=PASS. First-ever snapshot=UNKNOWN.

**Ranking:** `green_count DESC, mcap ASC`.

---

## Bot filtering (check #4)

Exclude trader if ANY: hold <5min, trades on this token >20, first trade <2min ago, position <$500.

Keep trader if ALL: hold ≥5min (≥30min for PASS), trades ≤20, position ≥$500, still holding.

Show top 10 surviving traders on expand.

---

## Informational (on expand, not scored)

**Collision count** — Dexscreener search by ticker + by name. Exclude current coin. Classify each prior as "alive" (liquidity >$10K + recent volume) or "dead". Show: "Prior: 4 (1 alive, 3 dead)". Not scored — I judge.

**Phase** — deterministic rules on OHLCV:
- EARLY: <4h old AND no >2x move
- SWEET_SPOT: post-shakeout, consolidating under prior high
- BREAKOUT_EARLY: just broke consolidation with volume
- BREAKOUT_EXTENDED: up 3x+ from base, still trending
- LATE: up 5x+, vertical, distribution signs
- FADING: lower highs, declining volume

Pill colors: green (first three), orange (next two), red (FADING).

**Setup type** — journal archetypes:
- Quick Flip: age<2h + mcap $150K-$400K + check#7 PASS + check#5 PASS
- Hype Catch + Moonbag: check#4 PASS + check#5 rising + check#6 PASS
- Conviction: age>5d + check#8 accumulating + check#4 PASS
- No Setup: default

Phase and setup are descriptive, not predictive. They never recommend buying.

---

## Manual import (smart input)

One field at top of home page. If input matches Solana address format (44 chars base58) → treat as CA, run full scan. Else → treat as ticker, call Dexscreener search, show dropdown of matches, I pick one, then scan. `POST /api/candidates/import` body `{ query }`.

---

## Outcome tracking (opt-in)

Track star on each row. Tap → upsert `outcomes` row with `tracked_at=now()` and entry snapshot. Cron every 15 min checks all tracked: at tracked_at+1h capture snapshot_1h, same at 6h/24h/72h/7d. After 7d, set `completed_at`.

Untracked coins stay in `/history` without performance monitoring. I can tap Track anytime on any historical coin.

---

## Data model

**candidates** — id, contract_address unique, pair_address, ticker, name, chain, discovered_at, first_mcap, first_price, dex_url, source ('scan'|'manual_import').

**scans** — id, started_at, completed_at, trigger ('manual'|'hourly'), raw_count, filtered_count, checked_count, top_candidate_id fk, top_green_count.

**results** — id, scan_id fk nullable, candidate_id fk, mcap, price, volume_24h, liquidity, age_days, 8 `{check}_status` text, 8 `{check}_details` jsonb, collision_count, collision_alive_count, collision_details jsonb, phase, setup_type, green_count, rank, raw_data jsonb. Indexes `(scan_id, rank)` and `(candidate_id, scan_id DESC)`.

**holder_snapshots** — id, candidate_id fk, snapshot_at, top10_pct, top10_addresses jsonb. Index `(candidate_id, snapshot_at DESC)`.

**outcomes** — id, candidate_id fk unique, tracked_at, entry_mcap, entry_price, entry_green_count, entry_phase, entry_setup_type, snapshot_1h/6h/24h/72h/7d jsonb nullable (each `{mcap, price, performance_pct, at}`), completed_at.

**session** — password cookie, same as Events CRM.

---

## Routes

- `/login`, `/`, `/history`

## API routes

- `POST /api/scan` — manual auto-scan, 10/day limit
- `GET /api/scans/latest`, `GET /api/scans/[id]`
- `POST /api/candidates/import` — smart input
- `POST /api/candidates/[id]/track`
- `GET /api/history`
- `POST /api/cron/hourly-scan` — protected by CRON_SECRET
- `POST /api/cron/refresh-outcomes` — every 15 min, protected by CRON_SECRET

---

## Scan flow

1. Create scans row
2. Dexscreener fetch new Solana tokens. **If you're unsure which endpoint returns new tokens filterable by mcap, ask me before implementing.**
3. Apply quick filter: Solana, age ≤12d, mcap $500K–$5M, 24h vol ≥$50K, liquidity ≥$20K, has pair
4. Upsert into candidates, source='scan'
5. For each, run 8 checks in parallel, concurrency cap 5
6. Snapshot holders into holder_snapshots
7. Compute green_count, rank, insert results
8. Update scans with top_candidate_id, top_green_count, completed_at

Target <5 min. Rate-limit handling: exponential backoff 3 retries, then UNKNOWN for that check. Never fail entire scan on one API down.

---

## UI (main `/`)

- Top: smart import input + "Import & Scan" button
- Below: "Last scan" info + "Find new" button
- Ranked list. Each row:
  - Line 1: rank, ticker (→ Dexscreener), green bar (8 segments), mcap, age, external link, Track star
  - Line 2: phase pill, setup type pill, collision count (⚠️ prefix if ≥3 prior mostly dead)
  - Line 3: 8 check tiles with icon + key number
  - Click row → expand: full details, whale trader list, prior tickers, phase+setup reasoning

Icons: ✅ PASS, ⚠️ WARN, ❌ FAIL, ? UNKNOWN.

## UI (history `/history`)

Table: ticker, discovered, best green_count, tracked (star), performance 1h/24h/7d (if tracked). Sortable. Filterable tracked/untracked. Row expand = all scans of coin + outcome snapshots.

---

## Build phases (one session, 5–7 hours)

**Phase 1: Scaffold + deploy (60–90min)** — next.js, shadcn, drizzle, Neon, password gate, empty routes, Netlify deploy. Verify: log in at deployed URL.

**Phase 2: 4 checks + manual import (90–120min)** — `/api/scan` running checks 1/2/3/5. Smart import endpoint. Main page with Find new + import input. 4 check tiles per row. Verify: both scan paths work with 4 checks.

**Phase 3: Whale check + bot filtering (60–90min)** — Birdeye top_traders, bot filter, add check #4, expand shows whales. Verify: real investors vs flippers distinguished.

**Phase 4: OHLCV + phase + setup (90–120min)** — Birdeye OHLCV, shakeout and higher-low detection, phase classification, setup type classification. Pills in UI. Verify: known dump+recovery coin shows check #6 PASS.

**Phase 5: Bundle + collision + hourly cron (60–90min)** — holder_snapshots on every scan, check #8, collision detection, hourly scheduled function. Verify: first scan shows UNKNOWN for #8, hourly auto-scan runs.

**Phase 6: Track + outcomes + history (60–90min)** — track star, outcomes table, 15-min refresh cron, `/history` page. Verify: track a coin, see 1h snapshot after waiting.

**Phase 7: Polish (30–45min)** — empty/loading/error states, remove debug routes, final QA.

---

## Rules for Claude Code

- Don't guess external APIs. Ask me first if unsure.
- Don't fabricate data. Null USD when unavailable. UNKNOWN on failure. No placeholder prices.
- Don't skip phases.
- Don't invent package APIs. Check docs.
- No features outside this spec. No LLM, no email, no auto-trading.
- Cache within a scan. Share Dexscreener responses across checks.
- Respect rate limits, back off, UNKNOWN on persistent failure.

---

## Budget

All free tier. V1 = $0/mo.

---

## v2 roadmap (after 30 days of use)

Performance analysis of which checks predict winners. Composite weighted score calibrated from real outcomes. LLM chart/narrative analysis. Separate watchlist. Indicator alerts (RSI, EMA). Email alerts (Resend). Image-collision detection. Paid API upgrades if needed.

---

## To start

1. Summarize spec back to me in 4 sentences.
2. List clarifying questions. Known: best Dexscreener endpoint for new <$5M Solana tokens; Birdeye top_traders and OHLCV on free tier; LunarCrush free tier Solana sentiment endpoint; Netlify Scheduled Functions for hourly + 15-min intervals (or recommend Upstash QStash / Trigger.dev if free tier insufficient).
3. Wait for my answers.
4. Start Phase 1.
