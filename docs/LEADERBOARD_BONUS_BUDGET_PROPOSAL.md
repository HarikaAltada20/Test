# Leaderboard Contest Flat Fee Bonus Budget Proposal

**Date:** October 7, 2025  
**Proposal:** Add separate budget field for leaderboard contests with flat fee bonuses

## 🎯 **Problem Statement**

Currently, leaderboard contests use `prize_pool_cents` for both:
1. **Prize distribution** (1st place: $100, 2nd place: $50, etc.)
2. **Flat fee bonus tracking** (when enabled)

This creates confusion because:
- Prize pool is fixed and distributed based on rankings
- Flat fee bonus is variable and depends on number of verified submissions
- No way to set a budget limit for flat fee bonuses
- Budget tracker shows combined spending without clear separation

## 💡 **Proposed Solution**

### **1. Update Contest Based Details Structure**

**Add `total_budget` to `leaderboard_contest` object:**
- **Purpose:** Separate budget for flat fee bonuses and future features
- **Default:** `NULL` (no budget limit)
- **When set:** Only for leaderboard contests with `flat_fee_bonus > 0`

**Updated Structure:**
```json
{
  "leaderboard_contest": {
    "prizes": [
      { "amount": 10000000, "position": 1 },
      { "amount": 3000, "position": 2 },
      { "amount": 2000, "position": 3 }
    ],
    "total_prize": 10005000,
    "winner_count": 3,
    "total_budget": 500000,  // New field for flat fee bonuses
    "flat_fee_bonus": 1000   // Existing field
  }
}
```

### **2. Contest Creation/Edit UI Updates**

**Leaderboard Contest Form:**
```typescript
// When flat_fee_bonus is enabled, show additional field
{contestType === 'leaderboard' && flatFeeBonus > 0 && (
  <div className="space-y-2">
    <Label htmlFor="total-budget">
      Total Budget for Bonuses (Optional)
    </Label>
    <Input
      id="total-budget"
      type="number"
      step="0.01"
      min="0"
      placeholder="e.g., 500.00"
      value={totalBudget}
      onChange={(e) => setTotalBudget(parseFloat(e.target.value) || 0)}
    />
    <p className="text-sm text-muted-foreground">
      Set a budget limit for flat fee bonuses and future features. Leave empty for no limit.
      <br />
      <strong>Prize Pool:</strong> ${totalPrize} (for rankings)
      <br />
      <strong>Total Budget:</strong> ${totalBudget || 'No limit'} (for bonuses & extras)
    </p>
  </div>
)}
```

### **3. Budget Tracker Updates**

**Enhanced Budget Tracker for Leaderboard Contests:**
```typescript
// Show separate tracking for prize pool vs total budget
if (contest.contest_type === 'leaderboard' && hasFlatFeeBonus) {
  const leaderboardConfig = contest.contest_based_details?.leaderboard_contest;
  const totalPrize = leaderboardConfig?.total_prize || 0;
  const totalBudget = leaderboardConfig?.total_budget || null;
  
  return (
    <div className="space-y-4">
      {/* Prize Pool Tracker */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Prize Pool</span>
          <span className="font-bold">
            {formatCurrency(prizePoolSpent)} / {formatCurrency(totalPrize)}
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full">
          <div 
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${(prizePoolSpent / totalPrize) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-600">
          {formatCurrency(totalPrize - prizePoolSpent)} remaining
        </p>
      </div>

      {/* Total Budget Tracker (for bonuses & extras) */}
      {totalBudget && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Total Budget</span>
            <span className="font-bold">
              {formatCurrency(bonusSpent)} / {formatCurrency(totalBudget)}
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full">
            <div 
              className="h-full bg-green-500 rounded-full"
              style={{ 
                width: `${Math.min((bonusSpent / totalBudget) * 100, 100)}%` 
              }}
            />
          </div>
          <p className="text-xs text-gray-600">
            {formatCurrency(totalBudget - bonusSpent)} remaining
          </p>
        </div>
      )}
    </div>
  );
}
```

### **4. Payment Logic Updates**

**Flat Fee Bonus Payment Validation:**
```typescript
// In verify-submission API
if (action === 'mark_bonus_paid' || action === 'mark_both_paid') {
  const flatFeeBonus = getFlatFeeBonus(contest);
  const leaderboardConfig = contest.contest_based_details?.leaderboard_contest;
  const totalBudget = leaderboardConfig?.total_budget;
  
  if (totalBudget && bonusSpent + flatFeeBonus > totalBudget) {
    return NextResponse.json({
      error: 'Total budget exceeded',
      details: {
        currentSpent: bonusSpent,
        bonusAmount: flatFeeBonus,
        budgetLimit: totalBudget,
        remaining: totalBudget - bonusSpent
      }
    }, { status: 400 });
  }
  
  // Proceed with payment...
}
```

### **5. Contest Display Updates**

**Contest Cards & Details:**
```typescript
// Show both budgets when applicable
{contest.contest_type === 'leaderboard' && hasFlatFeeBonus && (
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span>Prize Pool:</span>
      <span className="font-semibold">{formatCurrency(totalPrize)}</span>
    </div>
    <div className="flex justify-between text-sm">
      <span>Total Budget:</span>
      <span className="font-semibold">
        {totalBudget ? formatCurrency(totalBudget) : 'No limit'}
      </span>
    </div>
  </div>
)}
```

## 🏗️ **Implementation Plan**

### **Phase 1: Update Contest Structure**
1. ✅ Add `total_budget` field to `leaderboard_contest` in `contest_based_details`
2. ✅ Update TypeScript types for `LeaderboardContestDetails`
3. ✅ Update contest creation/edit forms

### **Phase 2: Contest Creation/Edit**
1. ✅ Update contest creation form for leaderboard contests
2. ✅ Add budget field when flat fee bonus is enabled
3. ✅ Add validation (budget >= 0, optional field)
4. ✅ Update contest edit form

### **Phase 3: Budget Tracking**
1. ✅ Update `BudgetProgress` component for leaderboard contests
2. ✅ Show separate trackers for prize pool vs bonus budget
3. ✅ Update budget calculation logic
4. ✅ Update cron jobs to track both budgets

### **Phase 4: Payment Logic**
1. ✅ Update payment validation to check bonus budget
2. ✅ Add budget exceeded error handling
3. ✅ Update bulk payment logic
4. ✅ Add budget warnings in UI

### **Phase 5: UI/UX Polish**
1. ✅ Update contest cards to show both budgets
2. ✅ Update contest detail pages
3. ✅ Add budget status indicators
4. ✅ Update admin dashboard

## 📊 **Example Scenarios**

### **Scenario 1: Leaderboard Contest with Bonus Budget**
```
Contest: "Best Video Contest"
Prize Pool: $1,000 (1st: $500, 2nd: $300, 3rd: $200)
Flat Fee Bonus: $10 per verified submission
Bonus Budget: $500 (max 50 verified submissions)

Budget Tracker:
├── Prize Pool: $0 / $1,000 (0% used)
└── Bonus Budget: $120 / $500 (24% used, 12 verified)
```

### **Scenario 2: Leaderboard Contest with No Bonus Budget**
```
Contest: "Unlimited Bonus Contest"
Prize Pool: $500 (1st: $300, 2nd: $200)
Flat Fee Bonus: $5 per verified submission
Bonus Budget: No limit

Budget Tracker:
├── Prize Pool: $0 / $500 (0% used)
└── Bonus Budget: $250 / ∞ (unlimited)
```

### **Scenario 3: CPM Contest (No Changes)**
```
Contest: "Views Contest"
Total Budget: $1,000
CPM Rate: $2 per 1000 views
Flat Fee Bonus: $5 per verified submission

Budget Tracker:
├── CPM Earnings: $400 / $1,000 (40% used)
└── Flat Fee Bonus: $100 / $1,000 (10% used)
```

## 🎯 **Benefits**

1. **✅ Clear Separation:** Prize pool vs bonus budget are distinct
2. **✅ Budget Control:** Brands can set limits on bonus spending
3. **✅ Better Planning:** Predictable costs for both components
4. **✅ Flexible Options:** Optional budget (can be unlimited)
5. **✅ Backward Compatible:** Existing contests work without changes
6. **✅ Better UX:** Clear understanding of where money goes

## 🔄 **Migration Strategy**

1. **Existing Contests:** `flat_fee_bonus_budget_cents = NULL` (no limit)
2. **New Contests:** Optional field, defaults to no limit
3. **Gradual Rollout:** Feature flag for new budget field
4. **Admin Tools:** Bulk update tool for existing contests

## 📝 **API Changes**

### **Contest Creation/Update:**
```typescript
interface LeaderboardContestDetails {
  prizes: Array<{ amount: number; position: number }>;
  total_prize: number;
  winner_count: number;
  total_budget?: number | null;  // New field for bonuses & extras
  flat_fee_bonus?: number;       // Existing field
}

interface ContestResponse {
  // ... existing fields
  contest_based_details: {
    leaderboard_contest?: LeaderboardContestDetails;
    cpm_contest?: CpmContestDetails;
  };
  // ... other fields
}
```

### **Budget Tracking API:**
```typescript
interface BudgetStatus {
  prize_pool: {
    total: number;
    spent: number;
    remaining: number;
    percentage: number;
  };
  flat_fee_bonus: {
    total: number | null; // null = unlimited
    spent: number;
    remaining: number | null;
    percentage: number | null;
  };
}
```

This proposal provides a clean, flexible solution for managing leaderboard contest budgets while maintaining backward compatibility! 🚀
