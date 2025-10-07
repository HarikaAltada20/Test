# Earnings Cap Logic & Display

## Date: October 6, 2025

## Business Problem

When a contest has both:
1. **Earnings Cap** (e.g., $10.00 per creator)
2. **Flat Fee Bonus** (e.g., $1.00 per verified submission)
3. **Multiple Submissions** (e.g., 20 submissions allowed)

**The Question**: How should we calculate and display earnings when the creator exceeds the cap?

---

## Real Example from User

**Contest Settings**:
- CPM Rate: $1.00 per 1,000 views
- Earnings Cap: **$10.00** per creator
- Flat Fee Bonus: **$1.00** per verified submission
- Max Submissions: 20

**Creator Performance**:
- Total Submissions: 20 (all verified)
- Total Views: 33,056
- Calculated CPM Earnings: **$10.32**
- Calculated Bonus: **$20.00** (20 × $1.00)

**The Confusion**:
```
Expected Reward: $10.32  ⚠️ Exceeds cap!
Bonus Expected: $20.00
Total: $30.32

But the cap is $10.00!
```

---

## Solution Implemented

### **Design Decision: Earnings Cap Applies to Performance-Based Earnings ONLY**

#### Rationale:
1. **Flat Fee Bonus is "Guaranteed"** - It's a promise to creators for each verified submission
2. **CPM/Leaderboard Earnings are "Performance-based"** - Variable and subject to caps
3. **Clear Separation** - Easier to explain to creators and track for accounting
4. **Industry Standard** - Most platforms separate base payouts from bonus/incentives

---

## Implementation Details

### 1. **Earnings Cap Logic**

```typescript
// Step 1: Calculate raw CPM earnings for all submissions
let totalCPMEarnings = 0;
submissions.forEach(sub => {
  totalCPMEarnings += (sub.views * cpmRate) / 1000;
});
// Result: $10.32

// Step 2: Apply earnings cap (if configured)
const maxEarnings = contest.max_earnings_per_creator; // $10.00
if (totalCPMEarnings > maxEarnings) {
  totalCPMEarnings = maxEarnings; // Cap to $10.00
  isCapped = true;
}

// Step 3: Calculate flat fee bonus (separate from cap)
const flatFeeBonus = contest.flat_fee_bonus; // $1.00
const bonusTotal = verifiedCount * flatFeeBonus; // 20 × $1.00 = $20.00
```

### 2. **Display Logic**

**Creator-wise Table**:
```
Expected Reward: $10.00 ⚠️  (capped from $10.32)
Bonus Expected: $20.00
Total Expected Payout: $30.00
```

**Key Points**:
- ⚠️ Warning icon indicates earnings are capped
- Tooltip shows: "Capped at $10.00. Original: $10.32"
- Bonus is NOT affected by the cap
- Total payout is **capped CPM + full bonus**

---

## Payment Flow

### **When Paying Creator**:

```
Performance Earnings (Capped): $10.00
Flat Fee Bonus: $20.00
──────────────────────────────
Total to Pay: $30.00
```

### **Payment Actions Available**:

1. **Mark as Paid** - Pays the $10.00 (capped CPM earnings)
2. **Mark Bonus as Paid** - Pays the $20.00 (flat fee bonus)
3. **Mark Both as Paid** - Pays $30.00 total
4. **Custom Pay** - Custom amount

---

## Budget Tracking

### **Budget Calculation**:

```
CPM Budget Spent: $10.00 (capped amount, not $10.32)
Flat Fee Bonus Spent: $20.00
──────────────────────────────
Total Budget Spent: $30.00
```

**Important**: Budget tracking uses the **capped amount** for CPM, not the raw calculated amount.

---

## Alternative Approaches (Not Implemented)

### **Option B: Cap Applies to Total (CPM + Bonus)**

**Logic**: Total payout cannot exceed $10.00

```
Raw CPM: $10.32
Raw Bonus: $20.00
Total Raw: $30.32

Apply Cap: $10.00
Distribution:
- CPM: $3.33 (1/3 of $10.00)
- Bonus: $6.67 (2/3 of $10.00)
```

**Why NOT chosen**:
- ❌ Defeats the purpose of "guaranteed" flat fee bonus
- ❌ Complex to explain to creators
- ❌ Difficult to track and account for
- ❌ Creators lose trust in "guaranteed" bonuses

---

### **Option C: Cap Per Submission**

**Logic**: Each submission's earnings are capped individually

```
Max per submission: $0.50 ($10.00 / 20 submissions)

Submission 1: 363 views = $0.36 → No cap
Submission 2: 1,372 views = $1.37 → Capped to $0.50
Submission 3: 134 views = $0.13 → No cap
...
```

**Why NOT chosen**:
- ❌ Too complex to calculate and display
- ❌ Unfair to creators who perform better early on
- ❌ Difficult to predict earnings
- ❌ Not industry standard

---

## UI/UX Components

### 1. **Warning Indicator** (⚠️)

**Location**: Next to "Expected Reward" in creator-wise table

**Appearance**:
```
Expected Reward: $10.00 ⚠️
```

**Tooltip (on hover)**:
```
Capped at $10.00
Original: $10.32
```

### 2. **Earnings Breakdown**

**Full Display**:
```
┌─────────────────────────────────┐
│ Expected Reward: $10.00 ⚠️      │
│ (Original: $10.32)              │
│                                 │
│ Bonus Expected: $20.00          │
│ (20 submissions × $1.00)        │
│                                 │
│ Total Expected: $30.00          │
└─────────────────────────────────┘
```

### 3. **Creator Modal**

**Individual Submissions**:
- Each submission shows its individual CPM earnings
- Each submission shows $1.00 flat fee bonus
- Total row shows capped CPM + full bonus

---

## Database & API Considerations

### **Stored Values**:

```sql
-- submissions table
earnings: NULL or 0  -- Not pre-calculated
paid: false
bonus_paid: false

-- Dynamic calculation on display
SELECT 
  creator_id,
  SUM(views) as total_views,
  -- Calculate raw CPM
  SUM(views * :cpm_rate / 1000) as raw_cpm_earnings,
  -- Apply cap in application logic
  COUNT(*) FILTER (WHERE status = 'verified') as verified_count
FROM submissions
GROUP BY creator_id
```

**Application Layer**:
```typescript
// Calculate and cap
let cpmEarnings = (totalViews * cpmRate) / 1000;
if (cpmEarnings > maxEarnings) {
  cpmEarnings = maxEarnings;
}

// Bonus is separate
const bonusEarnings = verifiedCount * flatFeeBonus;

// Total payout
const totalPayout = cpmEarnings + bonusEarnings;
```

---

## Testing Scenarios

### **Scenario 1: Below Cap**
```
Views: 5,000
CPM: $1.00
Calculated: $5.00
Cap: $10.00
Result: $5.00 (no capping)
Bonus: $5.00 (5 submissions)
Total: $10.00
```

### **Scenario 2: At Cap**
```
Views: 10,000
CPM: $1.00
Calculated: $10.00
Cap: $10.00
Result: $10.00 ⚠️ (at cap)
Bonus: $20.00 (20 submissions)
Total: $30.00
```

### **Scenario 3: Above Cap**
```
Views: 33,056
CPM: $1.00
Calculated: $10.32
Cap: $10.00
Result: $10.00 ⚠️ (capped from $10.32)
Bonus: $20.00 (20 submissions)
Total: $30.00
```

### **Scenario 4: No Cap Configured**
```
Views: 100,000
CPM: $1.00
Calculated: $100.00
Cap: NULL
Result: $100.00 (no capping)
Bonus: $20.00 (20 submissions)
Total: $120.00
```

---

## Creator Communication

### **How to Explain to Creators**:

> **"Your contest earnings are calculated in two parts:**
> 
> **1. Performance Earnings** (based on views/ranking)
>    - CPM contests: Paid per 1,000 views
>    - Leaderboard contests: Paid by rank
>    - **Subject to earnings cap** (if configured)
> 
> **2. Flat Fee Bonus** (guaranteed per verified submission)
>    - Fixed amount per submission
>    - **NOT subject to earnings cap**
>    - Paid after contest ends
> 
> **Example:**
> - Your 20 videos earned $10.32 from views
> - But the contest has a $10.00 per-creator cap
> - So you'll receive $10.00 from performance ⚠️
> - Plus $20.00 in flat fee bonuses ($1.00 × 20)
> - **Total: $30.00**"

---

## Files Modified

1. **`app/dashboard/contests/[id]/contest-detail-client.tsx`**
   - Added `earningsBeforeCap` tracking in `groupSubmissionsByCreator`
   - Added `isCapped` flag to indicate when cap is applied
   - Added earnings cap logic after aggregation
   - Added ⚠️ warning indicator with tooltip
   - Added `max_earnings_per_creator` to Contest interface

---

## Status

✅ **Implemented**: Earnings cap applies to performance earnings only
✅ **Implemented**: Flat fee bonus remains separate and uncapped
✅ **Implemented**: Visual indicator (⚠️) for capped earnings
✅ **Implemented**: Tooltip showing original vs capped amount
🔄 **Next**: Test with real contest data
🔄 **Next**: Add explanation text in creator dashboard

---

## Summary

**The Final Answer:**

When a creator reaches the earnings cap:
- ✅ **CPM/Leaderboard earnings are capped** at the max_earnings_per_creator limit
- ✅ **Flat fee bonus is NOT capped** and paid in full for each verified submission
- ✅ **Total payout = Capped Performance Earnings + Full Bonus**
- ✅ **Clear visual indicator** (⚠️) shows when earnings are capped
- ✅ **Tooltip explains** the original amount vs capped amount

This approach is:
- ✅ **Fair to creators** - Guaranteed bonuses remain guaranteed
- ✅ **Clear for accounting** - Separate tracking for performance vs bonus
- ✅ **Easy to explain** - Simple "two bucket" model
- ✅ **Industry standard** - Similar to how other platforms handle bonuses

