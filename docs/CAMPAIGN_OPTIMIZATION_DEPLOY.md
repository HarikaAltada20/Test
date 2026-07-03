# Campaign Optimization Deploy Runbook

Deploy **database migrations and application code in the same release window**. The app assumes DB triggers and creator-metrics columns from this migration chain exist.

## Required migration order

Run in filename order (do not skip or reorder):

| #   | Migration                                                      | Purpose                                                                    |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | `20260629_trust_score_formula_and_trust_number.sql`            | New trust formula + `contests.trust_number`                                |
| 2   | `20260630_quality_score_and_creator_requirements.sql`          | Quality scores, creator gates, `contests_with_status` view                 |
| 3   | `20260701_creator_quality_gate_consistency.sql`                | Live fallback in submission gate trigger                                   |
| 4   | `20260702_incremental_creator_metrics.sql`                     | O(1) incremental trust/quality counters                                    |
| 5   | `20260703_backfill_quality_scores_and_reconcile.sql`           | Historical quality backfill + reconciliation helpers                       |
| 6   | `20260704_backfilled_quality_and_contest_gates.sql` | Backfilled-quality gate rules + contest requirement validation on write |

## Deploy steps

1. **Staging:** run migrations 1→6, then deploy app.
2. **Smoke test:**
   - Verify/reject a submission → creator trust + quality update on profile
   - Submit to a gated campaign → UI gate, `POST /api/creators/stats`, and DB trigger agree
   - Bulk verify requires explicit `qualityScore` (1–3)
3. **Production:** run migrations 1→6, then deploy app immediately after.
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
