# Naming Corrections - Flat Fee Bonus Fields

**Date:** October 6, 2025  
**Issue:** Inconsistent naming with `_cents` suffix

---

## ✅ CORRECTED NAMING CONVENTION

Since everything in the database is stored in cents by default, we should NOT add `_cents` suffix to avoid redundancy.

### Field Names:

#### **Before (Incorrect):**
- ❌ `flat_fee_bonus_cents`
- ❌ `bonus_amount_cents`

#### **After (Correct):**
- ✅ `flat_fee_bonus`
- ✅ `bonus_amount`

---

## 📝 FILES UPDATED

### 1. `types/supabase.ts`
```typescript
// CPM contest specific details
export interface CpmContestDetails {
  flat_fee_bonus?: number; // ✅ Correct (not flat_fee_bonus_cents)
}

// Leaderboard contest specific details
export interface LeaderboardContestDetails {
  flat_fee_bonus?: number; // ✅ Correct (not flat_fee_bonus_cents)
}

// Bonus Payment tracking
export interface BonusPayment {
  bonus_amount: number; // ✅ Correct (not bonus_amount_cents)
}
```

### 2. `app/api/admin/verify-submission/route.ts`
```typescript
// Line 242
const flatFeeBonus = (contest.contest_based_details as any)?.flat_fee_bonus || 0;
// ✅ Changed from flat_fee_bonus_cents
```

### 3. `components/BudgetProgress.tsx`
```typescript
// Line 29
const flatFeeBonus = (contest.contest_based_details as any)?.flat_fee_bonus || 0;
// ✅ Changed from flat_fee_bonus_cents
```

### 4. `components/CreatorSubmissionsModal.tsx`
```typescript
// Line 154
const flatFeeBonus = (contest?.contest_based_details as any)?.flat_fee_bonus || 0;
// ✅ Changed from flat_fee_bonus_cents
```

### 5. `DOCS/PHASE4_IMPLEMENTATION_STATUS.md`
Updated documentation to reflect correct naming convention.

---

## 💡 REASONING

**Why remove `_cents` suffix?**

1. **Database Convention**: All monetary values in the database are stored in cents by default
2. **Consistency**: Other fields like `prize_pool_cents`, `max_earnings_per_creator` use this pattern, but JSONB fields don't need it
3. **Readability**: Shorter names are cleaner and less redundant
4. **Type Safety**: The comment `// in cents` in the type definition is sufficient documentation

**Fields that SHOULD have `_cents` suffix:**
- Table columns: `prize_pool_cents`, `max_earnings_per_creator`
- These are actual database columns where the suffix helps distinguish from other formats

**Fields that SHOULD NOT have `_cents` suffix:**
- JSONB fields: `flat_fee_bonus` (inside `contest_based_details`)
- Interface fields: `bonus_amount` (inside `BonusPayment`)
- These are nested in JSON structures where the context makes it clear

---

## ✅ VERIFICATION

All files have been updated and linting passes with no errors.

**Next Steps:**
1. When implementing the contest creation/edit UI, use `flat_fee_bonus` (not `flat_fee_bonus_cents`)
2. When accessing the field in components, use `contest.contest_based_details?.flat_fee_bonus`
3. The value is always in cents and should be divided by 100 for display

---

**Last Updated:** October 6, 2025

