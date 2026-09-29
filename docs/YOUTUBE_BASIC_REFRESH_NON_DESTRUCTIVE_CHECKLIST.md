# YouTube Basic Refresh: Non-Destructive Regression Checklist

## Goal
Ensure **basic metrics refresh** does not erase previously fetched detailed analytics fields.

## Expected Behavior
- Running `Refresh all metrics` (or detailed refresh) populates detailed YouTube fields.
- Running `Refresh all (standard)` updates basic + core + traffic sources + age/gender/countries only; it does **not** overwrite or remove existing `cities`, `provinces`, `devices`, `audience_retention`, `traffic_source_details`, or `subscribed_status`.
- Running `Refresh basic metrics` afterwards updates only basic fields (`views`, `likes`, `comments`, `last_basic_update`) and preserves detailed fields.

## Manual Verification Steps
1. Open a YouTube contest with at least one submission.
2. Trigger `Refresh all metrics` and wait until complete.
3. Confirm detailed fields are present in UI (traffic/demographics/core sections).
4. Trigger `Refresh all (standard)` and verify city/state/device/retention data from step 2 is still visible.
5. Trigger `Refresh basic metrics`.
6. Re-open the same submission and verify detailed fields are still present.

## DB-Level Spot Check (optional)
For a sample submission before and after basic refresh, verify these keys under `other_stats.youtube` are preserved:
- `traffic_sources`
- `demographics`
- `devices`
- `traffic_source_details`
- `subscribed_status`
- `audience_retention`
- `estimated_minutes_watched`
- `avg_view_duration_seconds`
- `avg_view_percentage`
- `engaged_views`
- `bot_score`
- `bot_flags`
- `last_traffic_update`
- `last_demographics_update`

## Code Invariant (must stay true)
In the fallback cron path (`app/api/cron/update-youtube-metrics/route.ts`):
- Do **not** replace `other_stats` with a minimal object.
- Always merge existing `other_stats` and existing `other_stats.youtube` before writing updates.

## Risk Signals (regression symptoms)
- Detailed analytics disappear right after basic refresh.
- Cards/charts show `0`/empty despite successful earlier detailed refresh.
- `other_stats.youtube` after basic refresh contains only a small subset of fields.
