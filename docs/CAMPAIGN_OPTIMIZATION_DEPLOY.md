# Campaign Optimization Deploy Runbook

Deploy **database migrations and application code in the same release window**. The app assumes DB triggers and creator-metrics columns from this migration chain exist.

**Do not deploy app code before migrations finish, or run migrations without deploying app immediately after.** Partial deploy leaves verify flows without quality-score enforcement and profile metrics without incremental triggers.

## Required migration order

Run in filename order (do not skip or reorder):

| #   | Migration                                                      | Purpose                                                                    |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | `20260629_trust_score_formula_and_trust_number.sql`            | New trust formula + `contests.trust_number`                                |
| 2   | `20260630_quality_score_and_creator_requirements.sql`          | Quality scores, creator gates, `contests_with_status` view                 |
| 3   | `20260701_creator_quality_gate_consistency.sql`                | Live fallback in submission gate trigger                                   |
| 4   | `20260702_incremental_creator_metrics.sql`                     | O(1) incremental trust/quality counters                                    |
| 5   | `20260703_backfill_quality_scores_and_reconcile.sql`           | Historical quality backfill + reconciliation helpers                       |
| 6   | `20260704_backfilled_quality_and_contest_gates.sql`            | Backfilled-quality gate rules + contest requirement validation on write    |
| 7   | `20260705_explicit_quality_metrics_only.sql`                   | Explicit-only quality aggregates + verified quality_score DB enforcement   |

## Breaking API changes

After this release, **verify actions require `qualityScore` (1–3)** in the request body:

- `POST /api/admin/verify-submission` — `action: "verified"`
- `POST /api/admin/bulk-verify-submissions` — `action: "verified"`

Scripts, integrations, or Postman collections must send `qualityScore` or verification returns **400**.

Trust/quality profile updates after verify are handled by DB triggers (`submissions_sync_trust_metrics`). Do not rely on app-side recompute during deploy; ensure migration 4+ is applied before traffic hits the new app.

## Deploy steps

1. **Staging:** run migrations 1→7, then deploy app.
2. **Smoke test:**
   - Verify/reject a submission → creator trust + quality update on profile
   - Submit to a gated campaign → UI gate, `POST /api/creators/stats`, and DB trigger agree
   - Bulk verify requires explicit `qualityScore` (1–3)
   - Legacy creator with only backfilled scores → quality gates skipped until first explicit verify score
   - Creator with explicit scores → avg/best excludes backfilled rows only
3. **Production:** run migrations 1→7, then deploy app immediately after.
4. **Post-deploy:** sample creators for trust % changes; monitor submission insert errors.

## Ops: metrics reconciliation

If incremental counters drift (manual DB edits, trigger bugs), run on staging first:

```sql
-- Single creator
SELECT public.reconcile_creator_profile_metrics('<creator-uuid>');

-- All creators (returns count of profiles where drift was repaired)
SELECT public.reconcile_creator_profile_metrics_batch(500);
```

Schedule `reconcile_creator_profile_metrics_batch` nightly in production if desired.

## Rollback notes

- Trust formula change is **not** automatically reversible; keep a pre-migration backup.
- App code after this release expects quality scores on verify and live stats on pre-submit checks.
- Migration 7 adds a DB trigger requiring `quality_score` on verified/paid rows; rolling back app without rolling back DB leaves stricter submission writes in place.
