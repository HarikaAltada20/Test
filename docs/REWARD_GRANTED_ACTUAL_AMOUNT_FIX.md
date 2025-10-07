# Reward Granted - Actual Amount Display Fix

**Date:** October 7, 2025  
**Issue:** Reward Granted was showing expected amount instead of actual paid amount when earnings cap was applied

## Problem

When a creator hit their earnings cap (`max_earnings_per_creator`), the "Reward Granted" column was displaying the **expected uncapped amount** instead of the **actual capped amount** that was paid and stored in the database.

### Example Issue:
- **Expected Reward**: $10.32 (calculated from views)
- **Earnings Cap**: $10.00 per creator
- **Actual Amount Paid**: $10.00 (stored in database)
- **Reward Granted Display (BEFORE FIX)**: $10.32 ❌ (incorrect - showing expected)
- **Reward Granted Display (AFTER FIX)**: $10.00 ✅ (correct - showing actual)

## Root Cause

Both in the **Creator-wise View** (`contest-detail-client.tsx`) and the **Creator Submissions Modal** (`CreatorSubmissionsModal.tsx`), the "Reward Granted" was being calculated using the `expectedEarnings` value instead of reading the actual `submission.earnings` from the database.

### Before Fix:
```typescript
// WRONG: Using calculated expected earnings
if (submission.paid) {
  group.earnings.granted += expectedEarnings;
}

const grantedReward = submission.paid ? expectedReward : 0;
```

### After Fix:
```typescript
// CORRECT: Using actual earnings from database
if (submission.paid) {
  group.earnings.granted += (submission.earnings || 0);
}

const grantedReward = submission.paid ? (submission.earnings || 0) : 0;
```

## Solution

### Files Modified:

#### 1. `app/dashboard/contests/[id]/contest-detail-client.tsx`

**Changes in `groupSubmissionsByCreator` function:**

- **Line 384-386**: Changed to use actual `submission.earnings` from database instead of calculated `expectedEarnings`
- **Line 400-402**: Updated bonus granted to use actual `bonus_amount` from database
- **Line 422**: Removed incorrect cap logic for `earnings.granted` - database values already respect the cap

**Key Logic:**
```typescript
// For granted earnings, use ACTUAL earnings from database (which respects cap)
if (submission.paid) {
  group.earnings.granted += (submission.earnings || 0);
}

// Use actual bonus_amount from database if available
if (submission.bonus_paid) {
  const actualBonus = (submission as any).bonus_amount || flatFeeBonus;
  group.bonus.granted += actualBonus;
}

// Do NOT cap granted earnings - it already reflects actual paid amounts from database
```

#### 2. `components/CreatorSubmissionsModal.tsx`

**Changes in submission rendering:**

- **Lines 542-595**: Added pre-calculation logic for expected rewards with proper cap handling
- **Line 603**: Use pre-calculated expected reward from map
- **Line 606**: Changed to use actual `submission.earnings` from database for granted reward
- **Line 609**: Changed to use actual `bonus_amount` from database for granted bonus
- **Line 63**: Added `bonus_amount: number | null;` to Submission interface

**Key Logic - Expected Reward with Cap:**
```typescript
// Pre-calculate expected rewards with cap logic
// Sort by created_at (earliest first) to apply cap in submission order
const submissionsByTime = [...sortedSubmissions].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateA - dateB;
});

const maxEarningsPerCreator = (contest as any)?.max_earnings_per_creator || null;
const expectedRewardsMap = new Map<string, number>();
let runningTotal = 0;

// Calculate expected rewards in submission order, applying cap
submissionsByTime.forEach((sub) => {
    // Calculate base expected reward...
    let baseExpectedReward = calculateEarnings(sub);
    
    // Apply creator earnings cap
    let cappedExpectedReward = baseExpectedReward;
    if (maxEarningsPerCreator && maxEarningsPerCreator > 0) {
        const remainingCap = maxEarningsPerCreator - runningTotal;
        if (remainingCap <= 0) {
            cappedExpectedReward = 0; // Cap exhausted
        } else if (baseExpectedReward > remainingCap) {
            cappedExpectedReward = remainingCap; // Partial
        }
        runningTotal += Math.min(baseExpectedReward, Math.max(0, remainingCap));
    }
    
    expectedRewardsMap.set(sub.id, cappedExpectedReward);
});
```

**Key Logic - Granted Reward (Actual Database Value):**
```typescript
// Get pre-calculated expected reward (with cap applied)
const expectedReward = expectedRewardsMap.get(submission.id) || 0;

// Use ACTUAL earnings from database for granted reward (respects cap)
const grantedReward = submission.paid ? (submission.earnings || 0) : 0;

// Use actual bonus_amount from database if available
const grantedBonus = submission.bonus_paid ? ((submission as any).bonus_amount || flatFeeBonus) : 0;
```

## How It Works

1. **During Bulk Payment** (`app/api/admin/bulk-payment/route.ts`):
   - The API sorts submissions by `created_at` (earliest first)
   - Calculates CPM earnings for each submission
   - Applies the `max_earnings_per_creator` cap by tracking running total
   - Stores the **actual capped amount** in `submission.earnings`
   - Stores the **actual bonus** in `submission.bonus_amount`

2. **During Display**:
   - **Expected Reward**: Shows what WOULD be earned without cap (calculated from views/rank)
   - **Reward Granted**: Shows what WAS ACTUALLY paid (from `submission.earnings` in database)
   - If capped, shows ⚠️ icon with tooltip explaining the cap

## Benefits

✅ **Accurate Financial Reporting**: Brands see the actual amount paid, not misleading expected amounts  
✅ **Cap Transparency**: The cap warning icon clearly shows when earnings were limited  
✅ **Database as Source of Truth**: All granted amounts come from database, ensuring consistency  
✅ **Supports Partial Payments**: If only part of expected earnings were paid (due to cap), the actual amount is shown  
✅ **Zero Payment Display**: If cap was already reached and $0 was paid, it correctly shows $0.00 instead of expected amount

## Testing Scenarios

### Scenario 1: Full Payment (No Cap)
- **Expected**: $5.00
- **Paid**: $5.00
- **Display**: Expected: $5.00, Granted: $5.00 ✅

### Scenario 2: Partial Payment (Cap Reached Mid-Submission)
- **Expected**: $3.00
- **Cap Remaining**: $1.50
- **Paid**: $1.50
- **Display**: Expected: $3.00, Granted: $1.50 ⚠️

### Scenario 3: Zero Payment (Cap Already Reached)
- **Expected**: $2.00
- **Cap Remaining**: $0.00
- **Paid**: $0.00
- **Display**: Expected: $2.00, Granted: $0.00 ⚠️

### Scenario 4: With Bonus
- **Expected CPM**: $5.00
- **Paid CPM**: $5.00
- **Expected Bonus**: $1.00
- **Paid Bonus**: $1.00
- **Display**: Expected: $5.00, Granted: $5.00, Bonus Expected: $1.00, Bonus Granted: $1.00 ✅

## Related Files

- `app/api/admin/bulk-payment/route.ts` - Stores actual paid amounts with cap logic
- `app/api/admin/verify-submission/route.ts` - Stores amounts for individual payments
- `app/dashboard/contests/[id]/page.tsx` - Fetches `earnings` and `bonus_amount` fields
- `types/supabase.ts` - Type definitions for submissions table

## Migration Requirements

**Database columns used:**
- `submissions.earnings` - Actual CPM/Leaderboard earnings paid (in cents)
- `submissions.bonus_amount` - Actual bonus paid (in cents)
- `submissions.paid` - Boolean flag indicating payment status
- `submissions.bonus_paid` - Boolean flag indicating bonus payment status

All required columns already exist in the database.

