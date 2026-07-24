# Production deployment notes

Short checklist for deploying changes that affect production.

---

## Campaign list pagination + `contest_stats` (required before app traffic)

**When:** Deploying the SQL-paginated campaign / opportunities lists (`campaign_list_page_ids`, Redis list cache, `contest_stats`).

**Why:** Production **refuses** the PostgREST fallback. If the app ships before these RPCs exist, brand / admin / opportunities list APIs return **500**. Eligible-only opportunities also require the eligibility filter migration (no app-side scan cap).

**Before deploying the app**, apply migrations **in this exact order** (Supabase SQL Editor or your migration runner):

1. `db/migrations/20260729_contest_stats.sql`
2. `db/migrations/20260730_campaign_list_query.sql`
3. `db/migrations/20260731_campaign_list_page_ids.sql` (includes eligible-only filter)
4. `db/migrations/20260801_contest_stats_batch_refresh.sql`

Confirm the RPCs exist (`campaign_list_page_ids`, `campaign_list_tab_counts`, `campaign_list_authorize_caller`, `refresh_contest_stats`, `contest_matches_creator_eligibility`), then deploy the app.

**After deploy:** Ensure the `refresh-stale-contest-stats` cron / QStash schedule is authorized (`CRON_SECRET` or Upstash signature) so list card view counts stay fresh.

---

## Campaign list monitoring / alerts (B9)

List routes and the stale-stats cron emit structured JSON logs (one line per request):

| `type` | Where | Useful fields |
| --- | --- | --- |
| `campaign_list_request` | `/api/contests/list`, `/api/admin/contests/list`, `/api/opportunities/list` | `durationMs`, `status`, `cache` (`HIT`/`MISS`/`BYPASS`), `eligibleOnly`, `error` |
| `refresh_stale_contest_stats` | `/api/cron/refresh-stale-contest-stats` | `durationMs`, `refreshed`, `status`, `error` |
| `refresh_contest_stats` | metrics jobs / cron (failures only) | `contestId`, `error` |

**Vercel Observability / log drain — after deploy:**

1. Filter logs containing `"type":"campaign_list_request"`.
2. Alert when `status >= 500` rate spikes on those three routes.
3. Alert or dashboard p95 on `durationMs` (suggested start: p95 > 2s sustained).
4. Filter `"type":"refresh_stale_contest_stats"` with `error` or `status:500`.
5. Optional cache health: ratio of `cache":"HIT"` vs `MISS` on list requests (eligible lists use `BYPASS`).

Response header `X-Campaign-List-Cache` mirrors the same HIT/MISS/BYPASS values for quick Network-tab checks.

---

## Admin withdrawals (transactional refunds)

**When:** Deploying the updated admin withdrawals API that uses Postgres RPC for status updates and refunds.

**Before deploying the app:** Apply the migration that adds the transactional refund functions so the API does not 500 on first use.

1. In Supabase Dashboard → **SQL Editor**, run the contents of:
   - **`db/migrations/20260316_withdrawal_refund_transactional.sql`**

2. Confirm success (no errors). The migration creates:
   - `public._admin_refund_withdrawal_request`
   - `public.admin_set_withdrawal_status`
   - `public.admin_cancel_withdrawal_request`

3. Then deploy the app (admin withdrawals PATCH and cancel flows depend on these RPCs).

**Optional (if not already applied):** Run `db/migrations/20260315_withdrawal_request_status_constraint.sql` first so `withdrawal_requests.status` is constrained to allowed values.
