# Campaign Optimization Deploy Runbook

Deploy **database migrations and application code in the same release window**. The app assumes DB triggers and creator-metrics columns from this migration chain exist.

**Do not deploy app code before migrations finish, or run migrations without deploying app immediately after.** Partial deploy leaves verify flows without quality-score enforcement and profile metrics without incremental triggers.

## Atomic deploy (required)

Treat migrations + app as **one release**. Do not leave production in a mixed state.

| Step | Action | If skipped |
| ---- | ------ | ---------- |
| 1 | Run migrations 1→9 to completion on the target environment | App crashes or verify/gate logic is inconsistent |
| 2 | Deploy app **immediately** after migrations succeed | Verify API may 400; triggers/columns missing |
| 3 | Run smoke tests below before routing traffic | Gate drift or broken verify flows go unnoticed |

**Never:** deploy app first, run migrations later, or pause between migration 7 and app deploy.

Gate rules are enforced in **two places** that must stay aligned:

- **App:** `lib/creator-requirements.ts` (`evaluateCreatorRequirements`)
- **DB:** `public.enforce_submission_creator_requirements()` (migrations 6–7)

After changing gate semantics, update both and run `lib/creator-requirements.test.ts` plus a gated submit smoke test.

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
| 8   | `20260706_quality_gates_new_creators.sql`                    | Quality gates for new creators (default 1/1); skip backfill-only legacy    |
| 9   | `20260707_gate_checks_profile_cache_only.sql`                | Submit gates use cached profile metrics (O(1)); no submission table scans  |

Migration 7 rebuilds avg/best quality and `has_explicit_quality_scores` with **set-based SQL** (no per-creator loop). Still plan a short maintenance window on large databases for migrations 5–7 backfills.

## Verify API: `qualityScore`

For `action: "verified"` on:

- `POST /api/admin/verify-submission`
- `POST /api/admin/bulk-verify-submissions`

| `qualityScore` in body | Behavior |
| ---------------------- | -------- |
| `1`, `2`, or `3`       | Used as-is |
| Omitted / `null` / `""` | **400** — explicit score required |
| Any other value        | **400** — must be 1, 2, or 3 |

The admin UI prompts via `VerifyQualityDialog` before verify. Scripts and integrations **must** send `qualityScore`; there is no server-side default.

Trust/quality profile updates after verify are handled by DB triggers (`submissions_sync_trust_metrics`). Do not rely on app-side recompute during deploy; ensure migration 4+ is applied before traffic hits the new app.

## Deploy steps

1. **Staging:** run migrations 1→9, then deploy app in the same window.
2. **Smoke test:**
   - Verify/reject a submission → creator trust + quality update on profile
   - Verify without `qualityScore` in API body → **400**
   - Submit to a gated campaign → UI gate, `POST /api/creators/stats`, and DB trigger agree
   - Bulk verify with explicit `qualityScore` (1–3)
   - PATCH quality score on verified submission → response `creatorQuality` matches live submissions
   - Legacy creator with only backfilled scores → quality gates skipped until first explicit verify score
   - Creator with explicit scores → avg/best excludes backfilled rows only
   - Re-check eligibility after another admin verify/reject (submit error mentions refresh if DB gate fires)
3. **Production:** run migrations 1→9, then deploy app immediately after.
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
