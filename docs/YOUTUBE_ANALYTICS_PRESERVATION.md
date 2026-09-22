# YouTube analytics preservation

The cron, creator/basic refresh, queued admin refresh, and direct admin detailed
refresh share the YouTube submission updater. Previously these paths saved the
entire `other_stats` JSON built from a previously read submission. An overlapping
write could remove analytics fetched since that read. Basic refresh also copied
old detailed fields into its payload, so merging that payload at the database
would still roll newer values back.

A normal, isolated basic refresh in the code before this change preserves saved
details. The stale-write case is reproduced locally; attributing an individual
production incident still requires the affected submission/campaign and logs.

The updater now sends only the fields fetched by the current scope to
`patch_youtube_submission_metrics`. The function locks the target row, merges
into its current JSON, preserves other platforms and legacy root-level metrics,
and ignores null/empty analytics responses. It merges demographics and traffic
detail dimensions without copying stale sibling dimensions. Basic refresh no
longer rewrites detailed bot scores or clears analytics reauthorization flags.
Authentication failure paths also use patches rather than old row snapshots.

For the main submissions table, the function checks and locks the campaign row
before writing: `in_review`, `verification_complete`, `payouts_processed`, or a
non-null `views_locked_at` block changes. Post-campaign metrics remain writable
in the separate overlay table. The function uses invoker privileges and grants
execution only to `service_role`.

## Deployment

1. Apply `db/migrations/20260923_atomic_youtube_metrics_patch.sql` to the intended
   database before deploying the application. The migration only creates the
   writer and grants; it does not change existing analytics.
2. Deploy the application changes together. Old deployed writers still use
   whole-JSON updates until replaced. There is deliberately no unsafe fallback
   when the new function is unavailable; those refreshes report failure.
3. Restore missing analytics on unlocked campaigns using the admin detailed
   refresh, then run a basic refresh and compare the stored detailed fields.
   Use the post-campaign view for campaigns already locked for review. This
   change does not automatically reconstruct previously lost values.

## Validation

- `npx tsx --test lib/youtube-metrics-patch.test.ts lib/youtube-other-stats.test.ts lib/youtube-metrics-write-target.test.ts`
- Install `@electric-sql/pglite` into a temporary directory, set
  `PGLITE_MODULE_PATH` to its `dist/index.js`, and run
  `npx tsx scripts/test-youtube-metrics-database.ts`.

The database regression script creates an isolated in-memory PostgreSQL database
and runs the actual migration. It covers interleaved scope writes, zero values,
partial/empty results, auth failures, every review lock, overlay isolation,
legacy JSON, malformed data, and function permissions. It never connects to
production or calls YouTube.
