# Memecoin Scanner

Single-user, password-gated Solana memecoin scanner. Runs 8 free-tier checks per
coin and ranks them by green-check count.

**Status:** Phase 1 of 7 — scaffold only. See `SPEC.md` (top of the feature
branch history) for the full plan.

## Stack

Next.js 16 (App Router, `proxy.ts` for auth gate) · TypeScript · Tailwind ·
Drizzle ORM · Neon Postgres · Netlify hosting + Scheduled Functions.

> Spec says Next 15; we bumped to 16 during install to resolve
> [CVE-2025-66478](https://nextjs.org/blog/CVE-2025-66478). Next 16 renamed the
> `middleware.ts` file convention to `proxy.ts`, which we use.

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in DATABASE_URL, DASHBOARD_PASSWORD, CRON_SECRET, HELIUS_API_KEY,
# BIRDEYE_API_KEY, LUNARCRUSH_API_KEY

npm run db:push   # push schema to Neon (first run)
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login`.

### Generating `CRON_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Env vars

| Var | Required | Where |
|---|---|---|
| `DATABASE_URL` | yes | Neon → project → Pooled connection |
| `DASHBOARD_PASSWORD` | yes | Any string you pick |
| `CRON_SECRET` | yes | Generate (see above) |
| `HELIUS_API_KEY` | Phase 2 | helius.dev |
| `BIRDEYE_API_KEY` | Phase 3 | birdeye.so |
| `LUNARCRUSH_API_KEY` | Phase 2 | lunarcrush.com (check #5 returns UNKNOWN without paid tier) |

## Deploy (Netlify)

1. Push this branch to GitHub.
2. Netlify → Add new site → Import from Git → select the repo.
3. Framework auto-detected. Build command `npm run build`, publish `.next`.
4. Site settings → Environment variables → add all of the above.
5. Deploy.

Scheduled functions (`netlify/functions/scheduled-*.ts`) run on Netlify's cron
once deployed and hit the corresponding `/api/cron/*` routes with
`CRON_SECRET`.

## Routes

- `/` — home (scan results)
- `/history` — all coins ever scanned
- `/login` — password form

## API

- `POST /api/scan` — manual auto-scan
- `POST /api/candidates/import` — smart input (CA or ticker)
- `POST /api/candidates/:id/track` — opt a coin into outcome tracking
- `GET /api/scans/latest`, `GET /api/scans/:id`, `GET /api/history`
- `POST /api/cron/hourly-scan`, `POST /api/cron/refresh-outcomes` — protected
  by `CRON_SECRET`
- `GET /api/health` — public probe for deploy sanity checks (remove in Phase 7)
