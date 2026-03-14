# Production deployment notes

Short checklist for deploying changes that affect production.

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
