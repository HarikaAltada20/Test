# Architecture Decision: Flat Fee Bonus Storage

**Date:** October 1, 2025  
**Status:** Implemented ✅

---

## Decision

Store `flat_fee_bonus_cents` **inside the `contest_based_details` JSONB field** instead of as a separate column.

---

## Context

Initially, we considered adding `flat_fee_bonus_cents` as a separate column in the `contests` table. However, this would be inconsistent with how other optional contest parameters are stored.

---

## Rationale

### ✅ Advantages:

1. **Consistency**: Just like `min_views` and `max_views` for CPM contests
2. **Cleaner Schema**: Fewer top-level columns
3. **Contest-Type Specific**: Each contest type has its own optional parameters in one place
4. **Flexible**: Easy to add more optional fields in the future
5. **Optional by Nature**: Only included in JSONB if value is set (no null columns)

### ❌ Alternative (Separate Column):

- Would add another nullable column to an already wide table
- Inconsistent with existing pattern (min/max views)
- Harder to query all contest-specific options together

---

## Implementation

### Leaderboard Contests:

```json
{
  "leaderboard_contest": {
    "prizes": [{"position": 1, "amount": 10000}, ...],
    "total_prize": 50000,
    "winner_count": 3,
    "flat_fee_bonus_cents": 1000  // OPTIONAL - only included if set
  }
}
```

### CPM Contests:

```json
{
  "cpm_contest": {
    "cpm_rate_usd": 5.00,
    "min_views": 1000,              // OPTIONAL
    "max_views": 100000,            // OPTIONAL
    "total_budget": 100000,
    "budget_spent": 0,
    "terms_conditions": "...",
    "flat_fee_bonus_cents": 1000    // OPTIONAL (NEW)
  }
}
```

---

## Code Changes

### TypeScript Types:

```typescript
export interface CpmContestDetails {
  cpm_rate_usd: number;
  min_views?: number;
  max_views?: number;
  total_budget: number;
  budget_spent?: number;
  terms_conditions: string;
  flat_fee_bonus_cents?: number; // OPTIONAL
}

export interface LeaderboardContestDetails {
  prizes: { position: number; amount: number }[];
  total_prize: number;
  winner_count: number;
  flat_fee_bonus_cents?: number; // OPTIONAL
}
```

### Database Schema:

```sql
-- No separate column needed!
-- It's stored in contest_based_details JSONB

COMMENT ON COLUMN public.contests.contest_based_details IS 
'Contains contest-type-specific details including optional flat_fee_bonus_cents...';
```

### Form Logic:

```typescript
// Only include if brand enters a value
const flatFeeBonusCents = flatFeeBonus && parseFloat(flatFeeBonus.toString()) > 0 
  ? Math.round(parseFloat(flatFeeBonus.toString()) * 100) 
  : undefined;

contestBasedDetails = {
  leaderboard_contest: {
    prizes: prizesArray,
    total_prize: totalPrizePool,
    winner_count: winnerCount,
    ...(flatFeeBonusCents && { flat_fee_bonus_cents: flatFeeBonusCents }), // Spread only if set
  },
};
```

---

## Benefits in Practice

### For Brands:
- Seamless experience - just enter amount or leave blank
- No difference in UI

### For Developers:
- Consistent pattern to follow for future optional fields
- Cleaner queries: `contest_based_details->>'flat_fee_bonus_cents'`
- Type-safe with TypeScript interfaces

### For Database:
- No additional column overhead
- JSONB automatically handles optional fields
- Easy to add more optional parameters later

---

## Future Extensions

This pattern can be easily extended for:
- ✅ Tiered flat fees (different amounts for different submission ranks)
- ✅ Time-based bonuses (early bird submissions)
- ✅ Performance thresholds (bonus if views > X)
- ✅ Any other contest-specific optional parameters

All can be added to `contest_based_details` without schema changes!

---

## Migration Notes

Since this decision was made during initial implementation, no migration from old structure is needed. If `flat_fee_bonus_cents` had been a column, migration would be:

```sql
-- Hypothetical migration (not needed)
UPDATE contests 
SET contest_based_details = jsonb_set(
  contest_based_details, 
  '{leaderboard_contest,flat_fee_bonus_cents}', 
  to_jsonb(flat_fee_bonus_cents)
)
WHERE flat_fee_bonus_cents IS NOT NULL;

ALTER TABLE contests DROP COLUMN flat_fee_bonus_cents;
```

---

## Conclusion

Storing optional contest parameters in `contest_based_details` JSONB is the right architectural choice for scalability, consistency, and maintainability.

✅ Cleaner  
✅ Consistent  
✅ Flexible  
✅ Type-Safe  

