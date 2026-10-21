# Game of Creators (GoViral)

A marketplace where brands run paid campaigns and creators submit content (YouTube, TikTok, Instagram, X/Twitter) to earn from views, milestones or leaderboard prizes.

- **Brands** create campaigns, set budgets and requirements, review submissions and pay out.
- **Creators** browse Opportunities, submit content and get paid.
- **Admins** moderate campaigns, manage users and handle support.

## Stack

- Next.js 15 (App Router) and TypeScript
- Supabase: Postgres, Auth, Storage, row-level security and SQL functions
- Upstash Redis (list caches, rate limits) and QStash (background jobs)
- Stripe and Solana (Phantom) for payments
- AWS SES / Resend for email
- RapidAPI providers for platform metrics

## Getting started

```bash
npm install
# create .env.local with the variables below
npm run dev
```

The app runs at http://localhost:3000.

### Environment variables

At minimum:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for trusted routes |
| `NEXT_PUBLIC_APP_URL` | Public base URL, used in links and emails |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | List caches and rate limits |
| `CRON_SECRET` | Protects `/api/cron/*` routes |

Payments, email, metrics and OAuth need their own keys (`STRIPE_*`, `SES_*` / `RESEND_*`, `RAPIDAPI_*`, `TWITTER_RAPIDAPI_*`, `YOUTUBE_RAPIDAPI_*`, `GOOGLE_*`, `TIKTOK_*`, `INSTAGRAM_*`, `QSTASH_*`). Search the code for `process.env.` to see every variable a feature reads. Never commit `.env*` files.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Node test runner via `tsx`) |
| `npx tsc --noEmit` | Type-check |

Run a single test file with `npx --yes tsx --test lib/<name>.test.ts`.

## Project layout

```
app/              Routes (pages under app/dashboard, API under app/api)
components/       UI components (components/ui is the shared design system)
lib/              Domain logic, server helpers and their tests (*.test.ts)
utils/supabase/   Supabase clients: browser, server (session) and admin (service role)
db/migrations/    SQL migrations, named YYYYMMDD_description.sql
docs/             Feature notes and runbooks
scripts/          One-off maintenance and backfill scripts
```

Route files under `app/api` may only export route handlers (`GET`, `POST`, …) and Next.js config such as `dynamic`. Put shared helpers in `lib/`.

## Database migrations

Migrations live in `db/migrations` and are applied in filename order through the Supabase SQL editor or `psql`. Most are wrapped in `BEGIN`/`COMMIT` and are safe to re-run. Files that add enum values (`ALTER TYPE … ADD VALUE`) must run outside a transaction; they say so at the top.

New functions get `EXECUTE` for `anon` and `authenticated` by default in Supabase, so every migration that adds a function revokes and grants explicitly.

## Releasing

Run new migrations before deploying the code that uses them. For the campaign access release:

1. `20261014_campaign_restricted_applications.sql`
2. `20261015_campaign_access_notification_types.sql` — on its own, outside a transaction (adds enum values)
3. `20261016_access_polish.sql`
4. `20261017_access_review_fixes.sql`
5. Deploy the app.

Try the migrations on staging first. The create and edit pages only send the newer campaign columns when they are used, but the restricted-campaign features themselves need the migrations in place.

## Campaign access

Each campaign has an `access_mode`:

| Mode | Who sees it | How creators get in |
| --- | --- | --- |
| `public` | Everyone (subject to region) | Anyone can join. Optionally `list_only_to_eligible` hides it from creators who don't meet the requirements. |
| `private` | Only the brand, admins and creators on the access list | Brand adds usernames, imports a saved list, or shares an invite link. |
| `restricted` | Everyone sees a preview card and page | Creators apply (answering the brand's questions); the brand approves or rejects. Approval adds them to the access list. |

How it is enforced:

- `can_access_contest(contest_id)` is the single check. The contests RLS policy, the submission and Twitter-join triggers and the API route gates all use it. Restricted behaves like private for everything except the preview.
- Restricted previews are served only by `get_contest_preview` / `get_contest_previews` (SECURITY DEFINER, whitelisted fields).
- `contest_access_list` records who has access and where it came from (`manual`, `saved_list`, `invite_link`, `application`, `existing_submitter`). Switching a public campaign to private or restricted adds existing submitters automatically.
- `access_list_skips_requirements` lets listed creators bypass trust/quality minimums.
- Saved lists (`brand_allowlists`) are reusable per brand. The Access tab can import a list or sync it later to add only new members.
- Invite links (`contest_invite_links`) can expire or cap joins. Switching a campaign to public revokes its active links, and a dead link shows no campaign details.
- Creators get in-app notifications when an application is approved or rejected and when a brand adds them; brands are told when applications arrive.

Main code: `lib/campaign-access*.ts`, `lib/campaign-applications-server.ts`, `components/campaign-access/`, `app/api/contests/[id]/{access-list,applications,application-questions,invite-links,preview}`. Migrations: `20261010` through `20261017`.

v1.8
