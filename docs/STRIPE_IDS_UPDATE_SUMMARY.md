# Stripe Product and Price IDs Update Summary

## Overview
This document summarizes the comprehensive update of Stripe product and price IDs throughout the GoViral codebase. All hardcoded values have been replaced with constants to ensure consistency and maintainability.

## New Product and Price IDs

### Product IDs
- **EXPLORER**: `prod_Slij7SgNUxACLp` (was `prod_Sduka9mKXu35Ii`)
- **STARTER**: `prod_SlilUeFqolEC7W` (was `prod_Sdum3O1ZM4wK1v`)
- **BUILDER**: `prod_Slinc7mb1e30Ef` (was `prod_SdunoupDPLZfkU`)
- **CHAMPION**: `prod_SlioxThbvGeLga` (was `prod_Sdunp5Rbb6V8Ax`)

### Price IDs
- **EXPLORER Monthly**: `price_1RqBIUDCKN2LN0Qe2c097HHM` (was `price_1RicueDCKN2LN0QeqyngXhRM`)
- **STARTER Monthly**: `price_1RqBK8DCKN2LN0QeVe68F0Ec` (was `price_1RicwmDCKN2LN0QeMBwxwt1K`)
- **STARTER Yearly**: `price_1RqBKXDCKN2LN0Qe81Nq90bP` (was `price_1Rid6wDCKN2LN0Qemz2ugwmI`)
- **BUILDER Monthly**: `price_1RqBLcDCKN2LN0QendahSoUJ` (was `price_1RicxUDCKN2LN0Qe3f13Nmel`)
- **BUILDER Yearly**: `price_1RqBLcDCKN2LN0QeoHdipPyN` (was `price_1Rid7PDCKN2LN0QeDCQwHKCB`)
- **CHAMPION Monthly**: `price_1RqBMjDCKN2LN0QenUgKtYgD` (was `price_1RicyCDCKN2LN0Qe7g4JO6RF`)
- **CHAMPION Yearly**: `price_1RqBMjDCKN2LN0QeFgcfIR2I` (was `price_1Rid7nDCKN2LN0QesH6RO4pO`)

## Constants Added

### Product IDs Constants
```typescript
export const PRODUCT_IDS = {
  EXPLORER: 'prod_Slij7SgNUxACLp',
  STARTER: 'prod_SlilUeFqolEC7W',
  BUILDER: 'prod_Slinc7mb1e30Ef',
  CHAMPION: 'prod_SlioxThbvGeLga',
} as const;
```

### Price IDs Constants
```typescript
export const PRICE_IDS = {
  EXPLORER_MONTHLY: 'price_1RqBIUDCKN2LN0Qe2c097HHM',
  STARTER_MONTHLY: 'price_1RqBK8DCKN2LN0QeVe68F0Ec',
  STARTER_YEARLY: 'price_1RqBKXDCKN2LN0Qe81Nq90bP',
  BUILDER_MONTHLY: 'price_1RqBLcDCKN2LN0QendahSoUJ',
  BUILDER_YEARLY: 'price_1RqBLcDCKN2LN0QeoHdipPyN',
  CHAMPION_MONTHLY: 'price_1RqBMjDCKN2LN0QenUgKtYgD',
  CHAMPION_YEARLY: 'price_1RqBMjDCKN2LN0QeFgcfIR2I',
} as const;
```

## Files Updated

### 1. Constants File
- **File**: `constants/subscriptionPlans.ts`
- **Changes**: 
  - Added `PRODUCT_IDS` and `PRICE_IDS` constants
  - Updated all subscription plans to use constants instead of hardcoded values

### 2. Frontend Components
- **File**: `app/dashboard/billing/page.tsx`
- **Changes**: Updated hardcoded product ID to use `PRODUCT_IDS.EXPLORER`

- **File**: `app/dashboard/contests/create/client.tsx`
- **Changes**: Updated hardcoded product and price IDs to use constants

- **File**: `app/choose-username/page.tsx`
- **Changes**: Updated hardcoded product and price IDs to use constants

- **File**: `app/auth/verify-otp/verify-otp-form.tsx`
- **Changes**: Updated hardcoded product and price IDs to use constants

### 3. API Routes
- **File**: `app/api/subscriptions/webhook/route.ts`
- **Changes**: Updated hardcoded product and price IDs to use constants

### 4. SQL Files
- **File**: `sql/create_subscription_system_optimized_final.sql`
- **Changes**: Updated all product and price IDs in the schema creation script

- **File**: `sql/update_stripe_ids_migration.sql` (NEW)
- **Changes**: Created migration script to update existing database records

### 5. Script Files
- **File**: `scripts/test-subscription-upgrade-flow.js`
- **Changes**: Updated hardcoded product and price IDs

- **File**: `scripts/fix-subscription-system-permanently.js`
- **Changes**: Updated hardcoded product and price IDs

- **File**: `scripts/debug-scheduled-upgrade-issue.js`
- **Changes**: Updated hardcoded product and price IDs

- **File**: `scripts/complete-subscription-fix.js`
- **Changes**: Updated hardcoded product and price IDs

### 6. Definition Files
- **File**: `DEFINITIONS/stripe_real_ids.txt`
- **Changes**: Updated to reflect new product and price IDs

## Database Migration

### Migration Script
A new migration script has been created: `sql/update_stripe_ids_migration.sql`

This script will:
1. Update all product IDs in the `products` table
2. Update all price IDs in the `prices` table
3. Update all `subscription_info` JSONB fields in `advertiser_profiles` table
4. Provide verification queries to confirm the updates

### Running the Migration
```sql
-- Run this in your Supabase SQL editor
\i sql/update_stripe_ids_migration.sql
```

## Benefits of This Update

1. **Consistency**: All Stripe IDs are now centralized in constants
2. **Maintainability**: Future ID changes only require updating the constants file
3. **Type Safety**: Using `as const` provides better TypeScript support
4. **Error Prevention**: Eliminates the risk of typos in hardcoded IDs
5. **Code Quality**: Follows best practices for configuration management

## Verification Steps

After deploying these changes:

1. **Test Subscription Creation**: Verify that new subscriptions can be created with the new IDs
2. **Test Webhook Processing**: Ensure webhooks process correctly with new IDs
3. **Test Plan Upgrades**: Verify that subscription upgrades work with new IDs
4. **Check Database**: Run the verification queries in the migration script
5. **Test Free Plan**: Ensure the free EXPLORER plan works correctly

## Rollback Plan

If issues arise, the old IDs can be restored by:
1. Reverting the constants file to use old IDs
2. Running a reverse migration script
3. Updating any cached data

## Notes

- All existing functionality should work exactly the same
- The changes are purely ID updates, no business logic was modified
- The migration script is safe to run multiple times (idempotent)
- All hardcoded values have been replaced with constants