# 💰 Bonus Amount Column - Implementation Guide

## 📋 Overview

Added a new `bonus_amount` column to the `submissions` table to explicitly store the flat fee bonus amount paid for each submission. This provides:

- ✅ **Historical accuracy** - Preserves exact bonus amount even if contest settings change
- ✅ **Easier querying** - Direct access to bonus earnings per submission
- ✅ **Complete data** - Submissions table now has both `earnings` and `bonus_amount`
- ✅ **Better analytics** - Can sum up bonus payments easily

---

## 🗄️ Database Migration

### Migration File: `SUPABASE/add_bonus_amount_column.sql`

```sql
-- Add bonus_amount column
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS bonus_amount INTEGER DEFAULT 0;

-- Add documentation comment
COMMENT ON COLUMN public.submissions.bonus_amount IS 
  'Flat fee bonus amount paid for this submission (in cents). Separate from CPM earnings.';

-- Create performance index
CREATE INDEX IF NOT EXISTS idx_submissions_bonus_amount 
ON public.submissions(bonus_amount) 
WHERE bonus_amount > 0;
```

### How to Run:

```bash
# Option 1: Supabase Dashboard
1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Copy contents from SUPABASE/add_bonus_amount_column.sql
4. Run the migration
5. Verify: Check submissions table has bonus_amount column

# Option 2: Supabase CLI (if configured)
supabase db push
```

---

## 📊 Database Schema

### Submissions Table Fields:

| Field | Type | Description |
|-------|------|-------------|
| `earnings` | integer (nullable) | CPM/Leaderboard earnings in cents |
| `paid` | boolean | Whether CPM earnings were paid |
| `paid_at` | timestamp | When CPM earnings were paid |
| `bonus_amount` | integer | Flat fee bonus amount in cents |
| `bonus_paid` | boolean | Whether bonus was paid |
| `bonus_paid_at` | timestamp | When bonus was paid |

### Example Record:
```json
{
  "id": "submission-uuid",
  "contest_id": "contest-uuid",
  "creator_id": "creator-uuid",
  "views": 10000,
  "earnings": 500,        // $5.00 CPM earnings
  "paid": true,
  "paid_at": "2025-10-07T06:35:24Z",
  "bonus_amount": 100,    // $1.00 flat fee bonus
  "bonus_paid": true,
  "bonus_paid_at": "2025-10-07T06:35:24Z"
}
```

---

## 💻 Code Changes

### 1. TypeScript Types Updated

**File:** `types/supabase.ts`

```typescript
submissions: {
  Row: {
    // ... existing fields ...
    bonus_amount: number  // ADDED
  }
  Insert: {
    // ... existing fields ...
    bonus_amount?: number  // ADDED
  }
  Update: {
    // ... existing fields ...
    bonus_amount?: number  // ADDED
  }
}
```

---

### 2. Bulk Payment API Updated

**File:** `app/api/admin/bulk-payment/route.ts`

```typescript
// Update each submission
for (const update of submissionUpdates) {
  const updatePayload: any = {};
  
  // CPM earnings
  if (payment_type !== "bonus" && update.cpm_amount > 0) {
    updatePayload.earnings = update.cpm_amount;
    updatePayload.paid = update.paid;
    updatePayload.paid_at = update.paid_at;
  }
  
  // Bonus payment (NEW: stores bonus_amount)
  if (update.bonus_paid !== undefined) {
    updatePayload.bonus_paid = update.bonus_paid;
    updatePayload.bonus_paid_at = update.bonus_paid_at;
    updatePayload.bonus_amount = update.bonus_amount;  // ← ADDED
  }

  await supabaseAdmin
    .from("submissions")
    .update(updatePayload)
    .eq("id", update.id);
}
```

---

### 3. Individual Payment API Updated

**File:** `app/api/admin/verify-submission/route.ts`

```typescript
// Update submission bonus_paid status and amount
const { error: bonusUpdateError } = await supabaseAdmin
  .from('submissions')
  .update({ 
    bonus_paid: true, 
    bonus_paid_at: new Date().toISOString(),
    bonus_amount: flatFeeBonus  // ← ADDED
  })
  .eq('id', submissionId);
```

---

## 📈 Benefits

### Before (Without bonus_amount):
```sql
SELECT id, earnings, bonus_paid FROM submissions;

| id   | earnings | bonus_paid |
|------|----------|------------|
| sub1 | 500      | true       |
| sub2 | 500      | true       |
| sub3 | NULL     | true       |

Problem: Can't see actual bonus amount!
Need to join with contests table to get flat_fee_bonus.
```

### After (With bonus_amount):
```sql
SELECT id, earnings, bonus_amount, bonus_paid FROM submissions;

| id   | earnings | bonus_amount | bonus_paid |
|------|----------|--------------|------------|
| sub1 | 500      | 100          | true       |
| sub2 | 500      | 100          | true       |
| sub3 | 0        | 100          | true       |

Perfect! All bonus amounts clearly visible!
```

---

## 🔍 Query Examples

### Total Earnings Per Submission:
```sql
SELECT 
  id,
  video_title,
  earnings,           -- CPM earnings
  bonus_amount,       -- Bonus earnings
  (COALESCE(earnings, 0) + bonus_amount) as total_earnings
FROM submissions
WHERE contest_id = 'xyz';
```

### Total Creator Earnings:
```sql
SELECT 
  creator_id,
  SUM(COALESCE(earnings, 0)) as total_cpm_earnings,
  SUM(bonus_amount) as total_bonus_earnings,
  SUM(COALESCE(earnings, 0) + bonus_amount) as total_earnings
FROM submissions
WHERE contest_id = 'xyz'
  AND paid = true
GROUP BY creator_id;
```

### Bonus Paid Summary:
```sql
SELECT 
  COUNT(*) as bonus_paid_count,
  SUM(bonus_amount) as total_bonus_paid
FROM submissions
WHERE contest_id = 'xyz'
  AND bonus_paid = true;
```

---

## 🧪 Testing

### Test Case 1: Bulk Payment (Both)
```bash
Setup:
  - 5 verified submissions
  - CPM: $1/1k views, 10k views each
  - Flat fee bonus: $1.00

Action:
  - Select all 5
  - Click "Mark Both as Paid (Bulk)"

Expected Database Result:
| id   | earnings | bonus_amount | paid | bonus_paid |
|------|----------|--------------|------|------------|
| sub1 | 1000     | 100          | true | true       |
| sub2 | 1000     | 100          | true | true       |
| sub3 | 1000     | 100          | true | true       |
| sub4 | 1000     | 100          | true | true       |
| sub5 | 1000     | 100          | true | true       |

Total: $50 CPM + $5 Bonus = $55
```

### Test Case 2: Bonus Only Payment
```bash
Setup:
  - 5 submissions already paid for CPM
  - Bonus not yet paid

Action:
  - Select all 5
  - Click "Mark Bonus as Paid (Bulk)"

Expected Database Result:
| id   | earnings | bonus_amount | paid | bonus_paid |
|------|----------|--------------|------|------------|
| sub1 | 1000     | 100          | true | true       |
| sub2 | 1000     | 100          | true | true       |
| sub3 | 1000     | 100          | true | true       |
| sub4 | 1000     | 100          | true | true       |
| sub5 | 1000     | 100          | true | true       |

Bonus: $5 (earnings unchanged)
```

### Test Case 3: With Earnings Cap
```bash
Setup:
  - 3 submissions (10k views each)
  - CPM: $1/1k, Bonus: $1
  - Earnings cap: $25

Action:
  - Bulk payment (both)

Expected Database Result:
| id   | earnings | bonus_amount | paid | bonus_paid |
|------|----------|--------------|------|------------|
| sub1 | 1000     | 100          | true | true       |
| sub2 | 1000     | 100          | true | true       |
| sub3 | 500      | 100          | true | true       | ← Capped!

Total: $25 CPM (capped) + $3 Bonus = $28
```

---

## 📱 UI Display

### Creator's Submissions Page:
```
My Submissions for Contest XYZ:

Submission #1
  CPM Earnings: $5.00
  Bonus: $1.00
  Total: $6.00
  Status: Paid ✓

Submission #2
  CPM Earnings: $5.00
  Bonus: $1.00
  Total: $6.00
  Status: Paid ✓

Submission #3
  CPM Earnings: $0.00 (capped)
  Bonus: $1.00
  Total: $1.00
  Status: Paid ✓
```

### Brand's Creator-wise View:
```
Creator: @visheshgupta4990

Total Submissions: 20
Expected Reward: $10.00 (capped)
Reward Granted: $10.00 ✓
Bonus Expected: $20.00
Bonus Granted: $20.00 ✓

Total Paid: $30.00
```

---

## ✅ Migration Checklist

### Pre-Migration:
- [x] Create migration SQL file
- [x] Update TypeScript types
- [x] Update bulk payment API
- [x] Update individual payment API
- [x] Test locally

### Run Migration:
- [ ] **IMPORTANT: Run `SUPABASE/add_bonus_amount_column.sql` in Supabase**
- [ ] Verify column added successfully
- [ ] Check existing data (should all have bonus_amount = 0)
- [ ] Test new payments

### Post-Migration:
- [ ] Test bulk payments
- [ ] Test individual payments
- [ ] Verify bonus_amount is populated
- [ ] Check creator submissions display
- [ ] Verify analytics calculations

---

## 🚨 Important Notes

### Default Value:
- All existing submissions will have `bonus_amount = 0`
- This is correct because they haven't been paid yet
- When payment is made, `bonus_amount` will be set to the actual amount

### Backfilling (Optional):
If you want to backfill existing paid bonuses:

```sql
-- Backfill bonus_amount for already paid bonuses
UPDATE public.submissions s
SET bonus_amount = COALESCE(
  (c.contest_based_details->'cpm_contest'->>'flat_fee_bonus')::integer,
  (c.contest_based_details->'leaderboard_contest'->>'flat_fee_bonus')::integer,
  0
)
FROM public.contests c
WHERE s.contest_id = c.id
AND s.bonus_paid = true
AND s.bonus_amount = 0;
```

**⚠️ Only run backfill if you have already paid bonuses that need historical data!**

---

## 🎯 Summary

### What Changed:
1. ✅ Added `bonus_amount` column to database
2. ✅ Updated TypeScript types
3. ✅ Bulk payment API now stores `bonus_amount`
4. ✅ Individual payment API now stores `bonus_amount`
5. ✅ Migration script created

### Next Steps:
1. **Run the migration SQL** in Supabase
2. Test bulk payment with bonus
3. Verify database records
4. Check creator submissions display

### Benefits:
- ✅ Explicit bonus tracking
- ✅ Historical accuracy
- ✅ Easier analytics
- ✅ Complete submission records
- ✅ No need to join with contests table

---

**Status:** ✅ Code Ready | ⚠️ Migration Pending

**Run the SQL migration to activate this feature!**

