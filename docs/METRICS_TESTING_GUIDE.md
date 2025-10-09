# Metrics System Testing Guide

## Database Setup (Before Testing)

### 1. Run Schema Updates
```bash
# Connect to your database and run the schema updates
psql -h your-host -U your-user -d your-database -f SUPABASE/add_submission_metrics.sql
```

### 2. Verify Schema Changes
```sql
-- Check if new columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'creator_profiles' 
AND column_name IN ('total_submissions_made', 'total_submissions_won');

-- Check if new table was created
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'creator_contest_wins';

-- Check if trigger was created
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_new_submission_increment_metrics';
```

### 3. Run Migration (Optional - for existing data)
```bash
# Only run this if you have existing data to migrate
psql -h your-host -U your-user -d your-database -f SUPABASE/migrate_existing_metrics.sql
```

## Testing Strategy

### Phase 1: Unit Testing (Local Development)

#### Test 1: Basic Submission Creation
```typescript
// Test file: test-submission-creation.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testSubmissionCreation() {
  const testCreatorId = 'your-test-creator-id';
  const testContestId = 'your-test-contest-id';
  
  // Get initial metrics
  const { data: initialProfile } = await supabase
    .from('creator_profiles')
    .select('total_submissions_made, total_submissions_won, total_contests_participated, total_contests_won')
    .eq('id', testCreatorId)
    .single();
  
  console.log('Initial metrics:', initialProfile);
  
  // Create a test submission
  const { data: submission, error } = await supabase
    .from('submissions')
    .insert({
      contest_id: testContestId,
      creator_id: testCreatorId,
      content_link: 'https://test.com',
      status: 'pending'
    })
    .select()
    .single();
    
  if (error) {
    console.error('Submission creation failed:', error);
    return;
  }
  
  console.log('Submission created:', submission.id);
  
  // Check if metrics were updated
  const { data: updatedProfile } = await supabase
    .from('creator_profiles')
    .select('total_submissions_made, total_submissions_won, total_contests_participated, total_contests_won')
    .eq('id', testCreatorId)
    .single();
    
  console.log('Updated metrics:', updatedProfile);
  
  // Verify increment
  const expectedSubmissionsMade = (initialProfile?.total_submissions_made || 0) + 1;
  const expectedParticipation = (initialProfile?.total_contests_participated || 0) + 1;
  
  if (updatedProfile?.total_submissions_made === expectedSubmissionsMade && 
      updatedProfile?.total_contests_participated === expectedParticipation) {
    console.log('✅ Submission creation test passed');
  } else {
    console.log('❌ Submission creation test failed');
  }
}

testSubmissionCreation();
```

#### Test 2: Submission Win Tracking
```typescript
// Test file: test-submission-win.ts
import { MetricsService } from '@/lib/metrics-service';

async function testSubmissionWin() {
  const testCreatorId = 'your-test-creator-id';
  const testContestId = 'your-test-contest-id';
  const testSubmissionId = 'your-test-submission-id';
  
  // Get initial metrics
  const initialSubmissionsWon = await MetricsService.getCreatorField(testCreatorId, 'total_submissions_won');
  const initialContestsWon = await MetricsService.getCreatorField(testCreatorId, 'total_contests_won');
  
  console.log('Initial - Submissions won:', initialSubmissionsWon, 'Contests won:', initialContestsWon);
  
  // Test first submission win
  await MetricsService.incrementSubmissionWin(testCreatorId, testContestId, testSubmissionId);
  
  const afterFirstWin = {
    submissionsWon: await MetricsService.getCreatorField(testCreatorId, 'total_submissions_won'),
    contestsWon: await MetricsService.getCreatorField(testCreatorId, 'total_contests_won')
  };
  
  console.log('After first win:', afterFirstWin);
  
  // Test second submission win (same contest)
  const testSubmissionId2 = 'your-test-submission-id-2';
  await MetricsService.incrementSubmissionWin(testCreatorId, testContestId, testSubmissionId2);
  
  const afterSecondWin = {
    submissionsWon: await MetricsService.getCreatorField(testCreatorId, 'total_submissions_won'),
    contestsWon: await MetricsService.getCreatorField(testCreatorId, 'total_contests_won')
  };
  
  console.log('After second win:', afterSecondWin);
  
  // Verify results
  const expectedSubmissionsWon = initialSubmissionsWon + 2;
  const expectedContestsWon = initialContestsWon + 1; // Should only increment once for the contest
  
  if (afterSecondWin.submissionsWon === expectedSubmissionsWon && 
      afterSecondWin.contestsWon === expectedContestsWon) {
    console.log('✅ Submission win test passed');
  } else {
    console.log('❌ Submission win test failed');
  }
}

testSubmissionWin();
```

#### Test 3: Reversal and Re-payment
```typescript
// Test file: test-reversal-repayment.ts
import { MetricsService } from '@/lib/metrics-service';

async function testReversalAndRepayment() {
  const testCreatorId = 'your-test-creator-id';
  const testContestId = 'your-test-contest-id';
  const testSubmissionId = 'your-test-submission-id';
  
  // Get metrics after initial wins
  const initialMetrics = {
    submissionsWon: await MetricsService.getCreatorField(testCreatorId, 'total_submissions_won'),
    contestsWon: await MetricsService.getCreatorField(testCreatorId, 'total_contests_won')
  };
  
  console.log('Before reversal:', initialMetrics);
  
  // Test reversal
  await MetricsService.decrementSubmissionWin(testCreatorId, testContestId, testSubmissionId);
  
  const afterReversal = {
    submissionsWon: await MetricsService.getCreatorField(testCreatorId, 'total_submissions_won'),
    contestsWon: await MetricsService.getCreatorField(testCreatorId, 'total_contests_won')
  };
  
  console.log('After reversal:', afterReversal);
  
  // Test re-payment
  await MetricsService.incrementSubmissionWin(testCreatorId, testContestId, testSubmissionId);
  
  const afterRepayment = {
    submissionsWon: await MetricsService.getCreatorField(testCreatorId, 'total_submissions_won'),
    contestsWon: await MetricsService.getCreatorField(testCreatorId, 'total_contests_won')
  };
  
  console.log('After re-payment:', afterRepayment);
  
  // Verify results
  if (JSON.stringify(initialMetrics) === JSON.stringify(afterRepayment)) {
    console.log('✅ Reversal and re-payment test passed');
  } else {
    console.log('❌ Reversal and re-payment test failed');
  }
}

testReversalAndRepayment();
```

### Phase 2: Integration Testing (Staging Environment)

#### Test 4: End-to-End Payout Flow
```typescript
// Test file: test-payout-flow.ts
import { processQueuedPayouts } from '@/lib/payout-processor';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testPayoutFlow() {
  const testCreatorId = 'your-test-creator-id';
  const testContestId = 'your-test-contest-id';
  
  // Create a test submission
  const { data: submission } = await supabase
    .from('submissions')
    .insert({
      contest_id: testContestId,
      creator_id: testCreatorId,
      content_link: 'https://test.com',
      status: 'pending',
      earnings: 1000 // $10.00 in cents
    })
    .select()
    .single();
  
  // Create a payout job
  const { data: payoutJob } = await supabase
    .from('payout_jobs')
    .insert({
      submission_id: submission.id,
      requested_by: 'your-admin-user-id',
      payload: {},
      status: 'queued'
    })
    .select()
    .single();
  
  // Get initial metrics
  const initialMetrics = await supabase
    .from('creator_profiles')
    .select('total_submissions_won, total_contests_won')
    .eq('id', testCreatorId)
    .single();
  
  console.log('Initial metrics:', initialMetrics.data);
  
  // Process payout
  const results = await processQueuedPayouts(1);
  
  console.log('Payout results:', results);
  
  // Check final metrics
  const finalMetrics = await supabase
    .from('creator_profiles')
    .select('total_submissions_won, total_contests_won')
    .eq('id', testCreatorId)
    .single();
  
  console.log('Final metrics:', finalMetrics.data);
  
  // Verify job status
  const { data: updatedJob } = await supabase
    .from('payout_jobs')
    .select('status')
    .eq('id', payoutJob.id)
    .single();
  
  console.log('Job status:', updatedJob?.status);
  
  if (results[0]?.status === 'done' && updatedJob?.status === 'done') {
    console.log('✅ Payout flow test passed');
  } else {
    console.log('❌ Payout flow test failed');
  }
}

testPayoutFlow();
```

### Phase 3: Database Validation

#### Validation Queries
```sql
-- 1. Check for duplicate contest wins
SELECT creator_id, contest_id, COUNT(*) 
FROM creator_contest_wins 
GROUP BY creator_id, contest_id 
HAVING COUNT(*) > 1;

-- 2. Verify metrics consistency
SELECT 
  cp.id as creator_id,
  cp.total_submissions_made,
  (SELECT COUNT(*) FROM submissions WHERE creator_id = cp.id) as actual_submissions,
  cp.total_submissions_won,
  (SELECT COUNT(*) FROM submissions WHERE creator_id = cp.id AND status = 'paid') as actual_wins,
  cp.total_contests_won,
  (SELECT COUNT(*) FROM creator_contest_wins WHERE creator_id = cp.id) as actual_contest_wins
FROM creator_profiles cp
WHERE cp.total_submissions_made != (SELECT COUNT(*) FROM submissions WHERE creator_id = cp.id)
   OR cp.total_submissions_won != (SELECT COUNT(*) FROM submissions WHERE creator_id = cp.id AND status = 'paid')
   OR cp.total_contests_won != (SELECT COUNT(*) FROM creator_contest_wins WHERE creator_id = cp.id);

-- 3. Check trigger functionality
SELECT 
  s.creator_id,
  s.id as submission_id,
  cp.total_submissions_made,
  ccp.creator_id as participation_recorded
FROM submissions s
LEFT JOIN creator_profiles cp ON s.creator_id = cp.id
LEFT JOIN creator_contest_participations ccp ON s.creator_id = ccp.creator_id AND s.contest_id = ccp.contest_id
WHERE s.created_at > NOW() - INTERVAL '1 hour'
ORDER BY s.created_at DESC;

-- 4. Test edge cases
-- Check if creators with multiple submissions in same contest have correct metrics
SELECT 
  s.creator_id,
  s.contest_id,
  COUNT(*) as total_submissions,
  COUNT(CASE WHEN s.status = 'paid' THEN 1 END) as winning_submissions,
  cp.total_submissions_won,
  cp.total_contests_won,
  CASE 
    WHEN COUNT(CASE WHEN s.status = 'paid' THEN 1 END) > 0 THEN 1 
    ELSE 0 
  END as should_have_contest_win
FROM submissions s
JOIN creator_profiles cp ON s.creator_id = cp.id
GROUP BY s.creator_id, s.contest_id, cp.total_submissions_won, cp.total_contests_won
HAVING COUNT(CASE WHEN s.status = 'paid' THEN 1 END) > 0;
```

## Pre-Production Checklist

### 1. Database Backup
```bash
# Create backup before making changes
pg_dump -h your-host -U your-user -d your-database > backup_before_metrics_update.sql
```

### 2. Environment Setup
```bash
# Ensure you have the right environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
echo $CRON_SECRET
```

### 3. Code Deployment
```bash
# Deploy code changes
git add .
git commit -m "feat: implement new metrics system with multiple submissions support"
git push origin your-branch
```

### 4. Database Migration
```bash
# Run on production database
psql -h production-host -U production-user -d production-database -f SUPABASE/add_submission_metrics.sql

# Run migration if needed
psql -h production-host -U production-user -d production-database -f SUPABASE/migrate_existing_metrics.sql
```

### 5. Verification
```sql
-- Quick verification queries
SELECT COUNT(*) as total_creators FROM creator_profiles;
SELECT SUM(total_submissions_made) as total_submissions FROM creator_profiles;
SELECT SUM(total_submissions_won) as total_wins FROM creator_profiles;
SELECT SUM(total_contests_won) as total_contest_wins FROM creator_profiles;
```

## Rollback Plan

### If Issues Occur
```sql
-- 1. Disable trigger
DROP TRIGGER IF EXISTS on_new_submission_increment_metrics ON submissions;

-- 2. Remove new columns (if needed)
ALTER TABLE creator_profiles DROP COLUMN IF EXISTS total_submissions_made;
ALTER TABLE creator_profiles DROP COLUMN IF EXISTS total_submissions_won;

-- 3. Remove new table (if needed)
DROP TABLE IF EXISTS creator_contest_wins;

-- 4. Restore from backup
# psql -h your-host -U your-user -d your-database < backup_before_metrics_update.sql
```

## Monitoring After Deployment

### Key Metrics to Watch
```sql
-- Monitor submission creation rate
SELECT 
  DATE(created_at) as date,
  COUNT(*) as submissions_created
FROM submissions 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Monitor payout processing
SELECT 
  DATE(created_at) as date,
  status,
  COUNT(*) as job_count
FROM payout_jobs 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), status
ORDER BY date DESC;

-- Monitor metrics accuracy
SELECT 
  'Metrics Accuracy Check' as check_type,
  COUNT(*) as total_creators,
  SUM(CASE WHEN total_submissions_made = (SELECT COUNT(*) FROM submissions WHERE creator_id = creator_profiles.id) THEN 1 ELSE 0 END) as correct_submission_counts,
  SUM(CASE WHEN total_submissions_won = (SELECT COUNT(*) FROM submissions WHERE creator_id = creator_profiles.id AND status = 'paid') THEN 1 ELSE 0 END) as correct_win_counts
FROM creator_profiles;
```

## Testing Timeline

1. **Day 1**: Run unit tests locally
2. **Day 2**: Run integration tests on staging
3. **Day 3**: Database migration on staging
4. **Day 4**: Full end-to-end testing
5. **Day 5**: Production deployment (during low-traffic hours)
6. **Day 6-7**: Monitor and validate results

---

*This testing guide ensures your metrics system works correctly before and after deployment.*
