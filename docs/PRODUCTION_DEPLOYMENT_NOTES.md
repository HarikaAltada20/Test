# Production deployment notes

Short checklist for deploying changes that affect production.

---

## Campaign list pagination + `contest_stats` (required before app traffic)

**When:** Deploying the SQL-paginated campaign / opportunities lists (`campaign_list_page_ids`, Redis list cache, `contest_stats`).

**Why:** Production **refuses** the PostgREST fallback. If the app ships before these RPCs exist, brand / admin / opportunities list APIs return **500**.

**Before deploying the app**, apply migrations **in this exact order** (Supabase SQL Editor or your migration runner):

1. `db/migrations/20260729_contest_stats.sql`
2. `db/migrations/20260730_campaign_list_query.sql`
3. `db/migrations/20260731_campaign_list_page_ids.sql`
4. `db/migrations/20260801_contest_stats_batch_refresh.sql`

Confirm the RPCs exist (`campaign_list_page_ids`, `campaign_list_tab_counts`, `campaign_list_authorize_caller`, `refresh_contest_stats`), then deploy the app.

**Do not** set `CAMPAIGN_LIST_ALLOW_POSTGREST_FALLBACK=1` in production as a substitute — fallback can wrong-sort and silently cap results.

**After deploy:** Ensure the `refresh-stale-contest-stats` cron / QStash schedule is authorized (`CRON_SECRET` or Upstash signature) so list card view counts stay fresh.

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
