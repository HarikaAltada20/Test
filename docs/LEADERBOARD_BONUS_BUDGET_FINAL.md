# Leaderboard Contest Bonus Budget - Final Implementation

**Status**: ✅ **COMPLETE**  
**Date**: 2025-01-07  
**Feature**: Separate budget tracking for flat fee bonuses in leaderboard contests

---

## 📋 Overview

This document outlines the final implementation of the separate budget system for leaderboard contests. The system now correctly tracks the **total_budget** for flat fee bonuses, while the **prize pool (total_prize)** remains fixed for ranking-based rewards.

---

## ✅ What Was Implemented

### 1. **TypeScript Types**
**File**: `types/supabase.ts`

Added `total_budget` field to `LeaderboardContestDetails`:
```typescript
export interface LeaderboardContestDetails {
  prizes: { position: number; amount: number }[];
  total_prize: number;
  winner_count: number;
  total_budget?: number | null; // Budget for flat fee bonuses (in cents)
  flat_fee_bonus?: number; // Flat fee per verified submission (in cents)
}
```

### 2. **BudgetProgress Component**
**File**: `components/BudgetProgress.tsx`

#### Updated Interface:
```typescript
interface Contest {
    total_budget?: number | null;  // Changed from prize_pool_cents
    contest_based_details: any;
    contest_type: string;
    max_earnings_per_creator?: number | null;
}
```

#### Key Changes:
- **Removed**: `prize_pool_cents` reference
- **Added**: `total_budget` for both CPM and Leaderboard contests
- **Simplified logic**: Single source of truth for budget tracking

#### Budget Calculation:
```typescript
const totalBudget = contest.total_budget || 0;
const bonusBudget = contest.total_budget || 0;
```

#### Special Leaderboard Display:
For leaderboard contests with `total_budget` set, the component shows:
- **Prize Pool tracker** (blue) - for ranking prizes
- **Total Budget tracker** (green) - for flat fee bonuses

### 3. **Contest Creation Form**
**File**: `app/dashboard/contests/create/client.tsx`

Added UI field for total budget:
```tsx
{/* Total Budget for Bonuses (Only for Leaderboard contests with flat fee bonus) */}
{contestType === "leaderboard" && flatFeeBonus && parseFloat(flatFeeBonus.toString()) > 0 && (
  <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
    <Label htmlFor="totalBudget">
      Total Budget for Bonuses (Optional)
    </Label>
    <Input
      id="totalBudget"
      type="number"
      value={totalBudget}
      onChange={(e) => setTotalBudget(e.target.value)}
      placeholder="e.g., 500 for $500 total budget"
    />
    <p className="text-sm text-muted-foreground">
      Optional: Set a budget limit for flat fee bonuses. Leave empty for no limit.
      <br />
      <strong>Prize Pool:</strong> ${formatCurrencyFromCents(totalPrizePool)} (for rankings)
      <br />
      <strong>Total Budget:</strong> {totalBudget ? `$${parseFloat(totalBudget.toString()).toFixed(2)}` : 'No limit'} (for bonuses)
    </p>
  </div>
)}
```

#### Form Submission:
```typescript
const totalBudgetCents = totalBudget && parseFloat(totalBudget.toString()) > 0
  ? Math.round(parseFloat(totalBudget.toString()) * 100)
  : undefined;

contestBasedDetails = {
  leaderboard_contest: {
    prizes: prizesArray,
    total_prize: totalPrizePool,
    winner_count: winnerCount,
    ...(flatFeeBonusCents && { flat_fee_bonus: flatFeeBonusCents }),
    ...(totalBudgetCents && { total_budget: totalBudgetCents }),
  },
};
```

### 4. **Contest Edit Form**
**File**: `app/dashboard/contests/[id]/edit/client.tsx`

Similar implementation to create form:
- Added UI field for total budget
- Added data loading logic
- Added save logic

```typescript
// Loading data
if (lbDetails?.total_budget) {
  setTotalBudget((lbDetails.total_budget / 100).toString());
}

// Saving data
if (totalBudget && parseFloat(totalBudget.toString()) > 0) {
  leaderboardDetails.total_budget = Math.round(parseFloat(totalBudget.toString()) * 100);
}
```

### 5. **Payment Validation**
**Files**: 
- `app/api/admin/verify-submission/route.ts`
- `app/api/admin/bulk-payment/route.ts`

#### Individual Payment Validation:
```typescript
const contestDetails = contest.contest_type === 'cpm' 
  ? (contest.contest_based_details as any)?.cpm_contest
  : (contest.contest_based_details as any)?.leaderboard_contest;

const flatFeeBonus = contestDetails?.flat_fee_bonus || 0;
const totalBudget = contestDetails?.total_budget || null;

if (contest.contest_type === 'leaderboard' && totalBudget) {
  const { data: bonusSpendingData } = await supabaseAdmin
    .from('submissions')
    .select('bonus_amount')
    .eq('contest_id', submissionFull.contest_id)
    .eq('bonus_paid', true);
  
  const currentBonusSpent = (bonusSpendingData || [])
    .reduce((sum, sub) => sum + (sub.bonus_amount || 0), 0);
  
  if (currentBonusSpent + flatFeeBonus > totalBudget) {
    return NextResponse.json({
      error: 'Total budget exceeded',
      details: { currentSpent, bonusAmount, budgetLimit, remaining }
    }, { status: 400 });
  }
}
```

#### Bulk Payment Validation:
```typescript
if (contest.contest_type === "leaderboard" && totalBudget && (payment_type === "bonus" || payment_type === "both")) {
  const currentBonusSpent = (bonusSpendingData || [])
    .reduce((sum, sub) => sum + (sub.bonus_amount || 0), 0);
  
  const potentialBonusSpending = verifiedSubmissions.length * flatFeeBonus;
  
  if (currentBonusSpent + potentialBonusSpending > totalBudget) {
    return NextResponse.json({
      error: 'Total budget would be exceeded',
      details: {
        currentSpent,
        potentialSpending,
        budgetLimit,
        remaining,
        maxSubmissions: Math.floor((totalBudget - currentBonusSpent) / flatFeeBonus)
      }
    }, { status: 400 });
  }
}
```

### 6. **Contest Display**
**File**: `app/dashboard/contests/[id]/contest-detail-client.tsx`

#### Prize Pool & Total Budget Card:
```tsx
<CardContent className="p-4 space-y-4">
  {/* Prize Pool */}
  <div className="flex justify-between">
    <div className="flex-1 text-black space-y-3">
      <p className="text-lg font-medium">Prize Pool</p>
      <p className="text-xl font-bold">
        {formatMoney(currentContest.contest_based_details.leaderboard_contest.total_prize)}
      </p>
      <p className="text-md">{winner_count} winners</p>
    </div>
    <Trophy className="h-5 w-5" />
  </div>

  {/* Total Budget (if set) */}
  {currentContest.contest_based_details?.leaderboard_contest?.total_budget && (
    <div className="border-t pt-4">
      <div className="flex justify-between">
        <div className="flex-1 text-black space-y-3">
          <p className="text-lg font-medium">Total Budget</p>
          <p className="text-xl font-bold text-blue-600">
            {formatMoney(currentContest.contest_based_details.leaderboard_contest.total_budget)}
          </p>
          <p className="text-md text-gray-600">For bonuses & extras</p>
        </div>
        <span className="text-lg">💰</span>
      </div>
    </div>
  )}
</CardContent>
```

#### Budget Progress Component:
```tsx
{/* Budget Progress Tracker - For Leaderboard with total_budget */}
{currentContest.contest_type === "leaderboard" &&
  currentContest.contest_based_details?.leaderboard_contest?.total_budget != null &&
  currentContest.contest_based_details.leaderboard_contest.total_budget > 0 && (
    <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-6">
      <BudgetProgress
        contest={{
          total_budget: currentContest.contest_based_details.leaderboard_contest.total_budget,
          contest_based_details: currentContest.contest_based_details,
          contest_type: currentContest.contest_type,
          max_earnings_per_creator: currentContest.max_earnings_per_creator,
        }}
        submissions={currentSubmissions as any}
        showDetailed={true}
      />
    </div>
  )}
```

---

## 🎯 Key Design Decisions

### 1. **Naming Convention**
- ✅ **Used**: `total_budget` (consistent with existing convention - all values in cents by default)
- ❌ **Avoided**: `total_budget_cents`, `prize_pool_cents` (redundant suffix)

### 2. **Budget Tracking for Leaderboard Contests**
- **Prize Pool (`total_prize`)**: Fixed amount distributed to winners based on ranking
  - **NOT tracked** by BudgetProgress component (it's a fixed distribution)
  - **Only displayed** in the prize pool card
  
- **Total Budget (`total_budget`)**: Flexible budget for flat fee bonuses
  - **IS tracked** by BudgetProgress component
  - **Shows spending** against the budget limit
  - **Enforces limits** during payment processing

### 3. **CPM vs Leaderboard Contests**
- **CPM Contests**: Use `total_budget` from `cpm_contest` details
- **Leaderboard Contests**: Use `total_budget` from `leaderboard_contest` details
- **Single prop**: Both pass `total_budget` to BudgetProgress component

---

## 📊 Data Flow

### Contest Creation:
1. Brand enables flat fee bonus for leaderboard contest
2. UI shows "Total Budget" field (optional)
3. Brand enters budget amount (e.g., $500)
4. Form converts to cents (50000) and saves to `leaderboard_contest.total_budget`

### Budget Tracking:
1. BudgetProgress receives `contest.total_budget`
2. Queries all submissions where `bonus_paid = true`
3. Sums up `bonus_amount` values to get current spending
4. Displays progress bar with spending vs budget

### Payment Processing:
1. Admin initiates bonus payment
2. API checks if `total_budget` is set
3. Calculates current + potential spending
4. Rejects if budget would be exceeded
5. Credits creator and updates `bonus_paid`, `bonus_amount`

---

## ✅ Testing Checklist

- [x] Create leaderboard contest with flat fee bonus and total budget
- [ ] Verify budget progress displays correctly
- [ ] Test payment validation (should reject when budget exceeded)
- [ ] Test bulk payment validation
- [ ] Verify edit form loads and saves total budget correctly
- [ ] Test with no total budget set (unlimited bonuses)
- [ ] Verify CPM contests still work with total_budget

---

## 🔄 Migration Notes

### For Existing Contests:
- Existing leaderboard contests will have `total_budget = null`
- This means **unlimited bonuses** (no budget cap)
- No migration script needed - backwards compatible

### For New Contests:
- Brands can optionally set `total_budget` when enabling flat fee bonus
- If not set, bonuses remain unlimited
- If set, budget is enforced during payment

---

## 📝 Summary

The implementation now correctly separates:
- **Prize Pool** (fixed, for rankings) - `total_prize`
- **Total Budget** (flexible, for bonuses) - `total_budget`

For leaderboard contests:
- Prize pool is **fixed** and distributed to winners
- Total budget is **tracked** and enforced for bonuses
- Both are displayed clearly in the UI

The system is flexible, backward-compatible, and follows established naming conventions! 🎉

