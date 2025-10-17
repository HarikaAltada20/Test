# Creator Metrics Fix - Documentation

## Problem Summary

The creator metrics system had several issues where metrics were not updating correctly:

1. ✅ **total_submissions_made** - Was increasing correctly (database trigger working)
2. ❌ **total_contests_participated** - Was NOT increasing
3. ❌ **total_submissions_won** - Was NOT increasing  
4. ❌ **total_contests_won** - Was NOT increasing

## Root Causes

### 1. total_contests_participated Bug
**Issue**: No mechanism to update this metric when submissions are created.

**Details**:
- The `MetricsService.getContestsParticipated()` method had a bug - it counted ALL submissions instead of DISTINCT contests
- The database column `total_contests_participated` was never updated automatically
- Dashboard reads directly from the column, not using the dynamic calculation

**Code Location**: `lib/metrics-service.ts:12-23`

### 2. total_submissions_won & total_contests_won Not Updating
**Issue**: Metrics only update when payout jobs are processed.

**Details**:
- These metrics are updated by `MetricsService.incrementSubmissionWin()` 
- This method is ONLY called from `processQueuedPayouts()` in the payout processor
- If the CRON job isn't running or payout jobs aren't being processed, metrics won't update
- The error handling silently swallowed errors, making debugging difficult

**Code Location**: `lib/payout-processor.ts:148-150`

## Solutions Implemented

### 1. Fixed getContestsParticipated() Method
**File**: `lib/metrics-service.ts`

**Change**: Modified the method to properly count DISTINCT contests instead of all submission rows.

```typescript
// Before: Counted all submission rows
const { count, error } = await supabase
  .from('submissions')
  .select('contest_id', { count: 'exact', head: true })
  .eq('creator_id', creatorId);

// After: Counts unique contest IDs
const { data, error } = await supabase
  .from('submissions')
  .select('contest_id')
  .eq('creator_id', creatorId);

const uniqueContests = new Set((data || []).map(sub => sub.contest_id));
return uniqueContests.size;
```

### 2. Created Database Trigger for total_contests_participated
**File**: `SUPABASE/fix_creator_metrics_triggers.sql`

**What it does**:
- Automatically updates `total_contests_participated` when new submissions are created
- Counts distinct contests for the creator and updates the column
- Ensures the metric stays in sync with actual data

**Functions Created**:
- `update_creator_contests_participated()` - Counts distinct contests and updates the column
- `increment_creator_submissions_made()` - Increments total_submissions_made (already existed but recreated for completeness)

**Triggers Created**:
- `on_new_submission_increment_metrics` - Fires after INSERT on submissions
- `on_new_submission_update_participation` - Fires after INSERT on submissions

### 3. Improved Error Logging in Payout Processor
**File**: `lib/payout-processor.ts`

**Change**: Added proper error logging so we can see when metrics updates fail.

```typescript
// Before: Silently swallowed errors
try {
  await MetricsService.incrementSubmissionWin(sub.creator_id, sub.contest_id, sub.id);
} catch {}

// After: Logs errors for debugging
try {
  await MetricsService.incrementSubmissionWin(sub.creator_id, sub.contest_id, sub.id);
} catch (metricsErr: any) {
  console.error(`Failed to increment submission win metrics for submission ${sub.id}:`, metricsErr);
}
```

### 4. Created Backfill Migration Script
**File**: `SUPABASE/backfill_creator_metrics.sql`

**What it does**:
- Recalculates all creator metrics from existing data
- Updates `total_submissions_made`, `total_contests_participated`, `total_submissions_won`, and `total_contests_won`
- Rebuilds the `creator_contest_wins` table with correct data
- Ensures no NULL values (sets to 0)
- Displays a summary of updated metrics

## Deployment Instructions

### Step 1: Apply Database Triggers
Run the trigger creation script in Supabase SQL Editor:

```bash
# File: SUPABASE/fix_creator_metrics_triggers.sql
```

This will:
- Create the necessary functions
- Create triggers to auto-update metrics
- Grant appropriate permissions

### Step 2: Backfill Existing Data
Run the backfill script to fix existing metrics:

```bash
# File: SUPABASE/backfill_creator_metrics.sql
```

This will:
- Recalculate all metrics from submissions table
- Update all creator profiles with correct values
- Show a summary of the changes

### Step 3: Deploy Code Changes
Deploy the updated code files:
- `lib/metrics-service.ts` - Fixed getContestsParticipated()
- `lib/payout-processor.ts` - Improved error logging

### Step 4: Verify Payout CRON Job is Running
Ensure the payout processing CRON job is configured correctly:

**Endpoint**: `GET /api/jobs/process-payouts`

**Environment Variable Required**: `CRON_SECRET`

**Recommended Schedule**: Every 5-10 minutes

**Vercel CRON Configuration** (if using Vercel):
```json
{
  "crons": [
    {
      "path": "/api/jobs/process-payouts",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Step 5: Manual Processing (if needed)
If CRON isn't set up yet, admins can manually process payouts:

**Endpoint**: `POST /api/jobs/process-now`

**Access**: Admin only

**What it does**: Processes up to 25 queued payout jobs at once

## Verification Steps

### 1. Check Database Triggers
```sql
-- Verify triggers exist
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement 
FROM information_schema.triggers 
WHERE trigger_name IN (
  'on_new_submission_increment_metrics',
  'on_new_submission_update_participation'
);

-- Verify functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name IN (
  'increment_creator_submissions_made',
  'update_creator_contests_participated'
);
```

### 2. Test Submission Creation
1. Create a test submission
2. Check that `total_submissions_made` increments
3. Check that `total_contests_participated` updates correctly
4. Verify the creator has the correct count of unique contests

### 3. Test Payout Processing
1. Mark a submission as paid (verify it or trigger payment)
2. Check that a payout job is created in `payout_jobs` table
3. Manually trigger `/api/jobs/process-now` (or wait for CRON)
4. Verify `total_submissions_won` and `total_contests_won` increment correctly

### 4. Check Metrics Display
1. Log in as a creator
2. Go to dashboard
3. Verify all metrics display correctly:
   - Total Submissions Made
   - Contests Participated
   - Submissions Won  
   - Contests Won

## Monitoring

### Key Metrics to Monitor

1. **Payout Job Queue**:
   ```sql
   SELECT status, COUNT(*) 
   FROM payout_jobs 
   GROUP BY status;
   ```

2. **Recent Metric Updates**:
   ```sql
   SELECT 
     u.username,
     cp.total_submissions_made,
     cp.total_submissions_won,
     cp.total_contests_participated,
     cp.total_contests_won
   FROM creator_profiles cp
   JOIN users u ON u.id = cp.id
   WHERE cp.total_submissions_made > 0
   ORDER BY u.created_at DESC
   LIMIT 10;
   ```

3. **CRON Job Logs**:
   - Check Vercel logs (or your hosting provider logs)
   - Look for calls to `/api/jobs/process-payouts`
   - Verify jobs are processing successfully

## Known Issues & Limitations

### 1. Supabase Count Limitation
Supabase's `.count()` method doesn't support `COUNT(DISTINCT column)`, so we have to fetch all rows and count unique values in application code. This is fine for reasonable data sizes but could be optimized with a database function if needed.

### 2. Payout Job Dependency
`total_submissions_won` and `total_contests_won` only update when payout jobs are processed. This means:
- If CRON isn't running, these metrics won't update automatically
- Admins need to manually trigger processing or wait for CRON
- Consider setting up monitoring/alerts for stuck payout jobs

### 3. Historical Data
If you have submissions marked as "paid" before deploying these fixes, you MUST run the backfill script to get accurate historical metrics.

## Troubleshooting

### Metrics Still Not Updating?

1. **Check Database Triggers**:
   ```sql
   SELECT * FROM pg_trigger 
   WHERE tgname LIKE '%submission%';
   ```

2. **Check for Errors in Logs**:
   - Look for "Failed to increment submission win metrics" in server logs
   - Check Supabase logs for trigger execution errors

3. **Verify CRON is Running**:
   - Check your hosting provider's CRON logs
   - Manually call `/api/jobs/process-now` to test

4. **Check Payout Jobs Table**:
   ```sql
   SELECT * FROM payout_jobs 
   WHERE status IN ('queued', 'processing', 'error')
   ORDER BY created_at DESC;
   ```

5. **Run Backfill Script Again**:
   - If metrics are still wrong, re-run `backfill_creator_metrics.sql`

## Support

If you continue to experience issues:
1. Check the server logs for detailed error messages
2. Verify database triggers are installed correctly
3. Ensure payout CRON job is configured
4. Run the backfill script to fix historical data
5. Contact the development team with specific error messages

## Summary of Files Changed

### Modified Files:
- `lib/metrics-service.ts` - Fixed contest participation count
- `lib/payout-processor.ts` - Improved error logging

### New Files:
- `SUPABASE/fix_creator_metrics_triggers.sql` - Database triggers for auto-updating metrics
- `SUPABASE/backfill_creator_metrics.sql` - Migration script to fix existing data
- `DOCS/METRICS_FIX_README.md` - This documentation

