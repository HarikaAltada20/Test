# Phase 1 - Testing & Deployment Guide

**Date:** October 1, 2025  
**Status:** Ready for Testing ✅

---

## ⚠️ IMPORTANT: Backward Compatibility

**All new features are OPTIONAL and backward compatible!**
- Existing contests will continue to work unchanged
- New columns have safe defaults
- No data migration needed
- Old contest creation flow still works

---

## 🚀 Deployment Steps

### Step 1: Run Database Migrations

**Files:** 
- `SUPABASE/add_new_contest_features.sql` (adds columns)
- `SUPABASE/update_contests_with_status_view.sql` (updates view)

#### In Supabase Dashboard:

**Migration 1: Add Columns**
1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Create new query
4. Copy the entire content of `SUPABASE/add_new_contest_features.sql`
5. **Review the SQL**
6. Click **Run** ✅
7. Wait for success message

**Migration 2: Update View**
8. In SQL Editor, click "New query"
9. Copy the entire content of `SUPABASE/update_contests_with_status_view.sql`
10. **Review the SQL**
11. Click **Run** ✅
12. Wait for success message

#### Migration SQL (Safe for Production):

```sql
-- Migration: Add new contest features
-- Date: 2025-10-01
-- Description: Adds multiple submissions, flat fee bonus, content type, bonus section, and earnings cap features

-- Add new columns to contests table
ALTER TABLE public.contests
ADD COLUMN IF NOT EXISTS multiple_submissions_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_submissions_per_creator INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS content_type TEXT CHECK (content_type IN ('ugc', 'clipping', 'other')) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bonus_details JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_earnings_per_creator INTEGER DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.contests.multiple_submissions_enabled IS 'Whether creators can submit multiple entries to this contest';
COMMENT ON COLUMN public.contests.max_submissions_per_creator IS 'Maximum number of submissions allowed per creator (2-100). Defaults to 1 for single submission contests.';
COMMENT ON COLUMN public.contests.content_type IS 'Type of content required: ugc (User Generated Content), clipping (Short clips/repurposed content), or other (Check Rules)';
COMMENT ON COLUMN public.contests.bonus_details IS 'Additional bonus opportunities in JSONB format with rich text content: {
  "description_html": "<ul><li>Top 3 creators get $100 each</li></ul>",
  "description_json": {...}
}';
COMMENT ON COLUMN public.contests.max_earnings_per_creator IS 'Maximum total earnings cap per creator across all submissions in cents. Creator can still submit after reaching cap but won''t earn more.';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contests_content_type ON public.contests(content_type) WHERE content_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contests_multiple_submissions ON public.contests(multiple_submissions_enabled) WHERE multiple_submissions_enabled = true;

-- Update contest_based_details comment to include flat_fee_bonus_cents documentation
COMMENT ON COLUMN public.contests.contest_based_details IS 'Contains contest-type-specific details. Money values (total_prize, total_budget, flat_fee_bonus_cents) are stored in cents as integers.

For Leaderboard contests:
{
  "leaderboard_contest": {
    "prizes": [{"position": 1, "amount": 10000}, ...],
    "total_prize": 50000,
    "winner_count": 3,
    "flat_fee_bonus_cents": 1000  // OPTIONAL - flat fee per verified submission
  }
}

For CPM contests:
{
  "cpm_contest": {
    "cpm_rate_usd": 5.00,
    "min_views": 1000,              // OPTIONAL
    "max_views": 100000,            // OPTIONAL
    "total_budget": 100000,
    "budget_spent": 0,
    "terms_conditions": "...",
    "flat_fee_bonus_cents": 1000    // OPTIONAL - flat fee per verified submission
  }
}

Note: min_views, max_views, and flat_fee_bonus_cents are all optional and apply to ALL submissions when multiple submissions are enabled.';
```

#### ✅ Why This is Safe:

- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` - Won't break if run multiple times
- `DEFAULT false` and `DEFAULT 1` - All existing contests get safe defaults
- `DEFAULT NULL` - Nullable columns, no data required
- `CREATE INDEX IF NOT EXISTS` - Safe to re-run
- **No data modification** - Only adds new columns

---

### Step 2: Verify Migration Success

Run this query in Supabase SQL Editor:

```sql
-- Verify new columns exist
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'contests'
  AND column_name IN (
    'multiple_submissions_enabled',
    'max_submissions_per_creator',
    'content_type',
    'bonus_details',
    'max_earnings_per_creator'
  )
ORDER BY column_name;
```

**Expected Result:**
```
column_name                        | data_type | column_default | is_nullable
-----------------------------------|-----------|----------------|-------------
bonus_details                      | jsonb     | NULL           | YES
content_type                       | text      | NULL           | YES
max_earnings_per_creator     | integer   | NULL           | YES
max_submissions_per_creator        | integer   | 1              | YES
multiple_submissions_enabled       | boolean   | false          | YES
```

---

### Step 3: Verify Existing Data (Backward Compatibility Check)

```sql
-- Check existing contests still work
SELECT 
  id,
  title,
  contest_type,
  moderation_status,
  multiple_submissions_enabled,
  max_submissions_per_creator,
  content_type,
  bonus_details,
  max_earnings_per_creator
FROM contests
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:**
- All existing contests have:
  - `multiple_submissions_enabled = false`
  - `max_submissions_per_creator = 1`
  - `content_type = NULL`
  - `bonus_details = NULL`
  - `max_earnings_per_creator = NULL`

✅ **This means they work exactly as before!**

---

### Step 4: Deploy Frontend Code

No special deployment needed - just deploy as normal:

```bash
# If using Vercel/similar
git add .
git commit -m "feat: add multiple submissions and bonus features"
git push origin main

# Vercel will auto-deploy
```

**No environment variables needed!**  
**No additional setup required!**

---

## 🧪 Testing Checklist

### Test 1: Existing Contests Still Work ✅

**What to test:**
1. Open an existing draft contest
2. Edit it
3. Save changes
4. Submit for payment

**Expected:** Everything works unchanged

---

### Test 2: Create Traditional Contest (No New Features) ✅

**What to test:**
1. Go to Create Contest
2. **DON'T** use any new features (leave everything default)
3. Create a normal Leaderboard or CPM contest
4. Complete payment

**Expected:**
- Contest created successfully
- New fields remain at defaults
- Contest behaves exactly like before

---

### Test 3: Create Contest with Multiple Submissions ✅

**What to test:**
1. Create new contest
2. Enable "Multiple Submissions" toggle
3. Set max submissions to 5
4. Complete rest of form (traditional)
5. Save and submit

**Expected:**
- Contest saved with `multiple_submissions_enabled = true`
- `max_submissions_per_creator = 5`
- Other new fields remain null/default

**Verify in Supabase:**
```sql
SELECT 
  title,
  multiple_submissions_enabled,
  max_submissions_per_creator
FROM contests
WHERE id = 'YOUR_CONTEST_ID';
```

---

### Test 4: Create Contest with Content Type ✅

**What to test:**
1. Create new contest
2. Select content type: "UGC"
3. Complete form
4. Save and submit

**Expected:**
- Contest saved with `content_type = 'ugc'`

**Verify:**
```sql
SELECT title, content_type
FROM contests
WHERE id = 'YOUR_CONTEST_ID';
```

---

### Test 5: Create Contest with Flat Fee Bonus ✅

**What to test:**
1. Create new contest
2. In Prize step, enter Flat Fee Bonus: $10
3. Complete form
4. Save and submit

**Expected:**
- Flat fee stored in `contest_based_details`
- For Leaderboard: `contest_based_details->>'leaderboard_contest'->>'flat_fee_bonus_cents' = 1000`
- For CPM: `contest_based_details->>'cpm_contest'->>'flat_fee_bonus_cents' = 1000`

**Verify:**
```sql
SELECT 
  title,
  contest_type,
  contest_based_details->'leaderboard_contest'->>'flat_fee_bonus_cents' as leaderboard_bonus,
  contest_based_details->'cpm_contest'->>'flat_fee_bonus_cents' as cpm_bonus
FROM contests
WHERE id = 'YOUR_CONTEST_ID';
```

---

### Test 6: Create Contest with Bonus Section ✅

**What to test:**
1. Create new contest
2. Enable "Additional Bonus Opportunities" toggle
3. Use rich text editor to add:
   ```
   • Top 3 get $100 each
   • Affiliate link: https://example.com
   • Special rewards available
   ```
4. Preview it
5. Save and submit

**Expected:**
- `bonus_details` contains HTML and JSON
- Preview shows formatted text

**Verify:**
```sql
SELECT 
  title,
  bonus_details->>'description_html' as bonus_html
FROM contests
WHERE id = 'YOUR_CONTEST_ID';
```

---

### Test 7: Create Contest with Earnings Cap ✅

**What to test:**
1. Create new contest with multiple submissions
2. Set max earnings per creator: $500
3. Save and submit

**Expected:**
- `max_earnings_per_creator = 50000`

**Verify:**
```sql
SELECT 
  title,
  max_earnings_per_creator
FROM contests
WHERE id = 'YOUR_CONTEST_ID';
```

---

### Test 8: Create Contest with ALL Features ✅

**What to test:**
1. Enable multiple submissions (5 per creator)
2. Select content type (UGC)
3. Add flat fee bonus ($10)
4. Enable bonus section with formatted text
5. Set earnings cap ($500)
6. Complete and submit

**Expected:** All fields saved correctly!

**Verify:**
```sql
SELECT 
  title,
  multiple_submissions_enabled,
  max_submissions_per_creator,
  content_type,
  contest_based_details,
  bonus_details,
  max_earnings_per_creator
FROM contests
WHERE id = 'YOUR_CONTEST_ID';
```

---

### Test 9: Draft Saving ✅

**What to test:**
1. Start creating contest with new features
2. Click "Save as Draft" at any step
3. Refresh page
4. Come back and continue

**Expected:** All new feature values preserved

---

### Test 10: Contest Edit ✅

**What to test:**
1. Create contest with new features
2. Go back to edit it
3. Modify values
4. Save changes

**Expected:** Changes saved correctly

---

## 🔍 Things to Watch For

### Potential Issues:

1. **Rich Text Editor Not Loading**
   - Check browser console for errors
   - Verify Novel editor is loading correctly
   - Test in different browsers

2. **Values Not Saving**
   - Check browser console for API errors
   - Verify Supabase connection
   - Check network tab for failed requests

3. **Old Contests Breaking**
   - Should NOT happen (backward compatible)
   - If issues occur, check if migration ran correctly
   - Verify defaults were applied

---

## 🚨 Rollback Plan (Just in Case)

If something goes wrong, you can rollback:

```sql
-- Rollback: Remove new columns (ONLY if absolutely necessary)
ALTER TABLE public.contests
DROP COLUMN IF EXISTS multiple_submissions_enabled,
DROP COLUMN IF EXISTS max_submissions_per_creator,
DROP COLUMN IF EXISTS content_type,
DROP COLUMN IF EXISTS bonus_details,
DROP COLUMN IF EXISTS max_earnings_per_creator;

-- Drop indexes
DROP INDEX IF EXISTS idx_contests_content_type;
DROP INDEX IF EXISTS idx_contests_multiple_submissions;
```

**Then redeploy previous version of frontend.**

---

## ✅ Success Criteria

Phase 1 is successful when:

- [ ] Migration runs without errors
- [ ] Existing contests still work perfectly
- [ ] Can create traditional contests (no new features)
- [ ] Can create contests with each new feature individually
- [ ] Can create contests with all features combined
- [ ] Draft saving works with new features
- [ ] No console errors
- [ ] No broken UI elements

---

## 📊 Monitoring After Deployment

### In Supabase:

**Monitor new feature adoption:**
```sql
-- How many contests use multiple submissions?
SELECT 
  COUNT(*) FILTER (WHERE multiple_submissions_enabled = true) as with_multiple,
  COUNT(*) FILTER (WHERE multiple_submissions_enabled = false) as single,
  COUNT(*) as total
FROM contests
WHERE created_at > NOW() - INTERVAL '7 days';

-- How many use flat fee bonus?
SELECT 
  COUNT(*) FILTER (
    WHERE contest_based_details->'leaderboard_contest'->'flat_fee_bonus_cents' IS NOT NULL
    OR contest_based_details->'cpm_contest'->'flat_fee_bonus_cents' IS NOT NULL
  ) as with_flat_fee,
  COUNT(*) as total_contests
FROM contests
WHERE created_at > NOW() - INTERVAL '7 days';

-- Content type distribution
SELECT 
  content_type,
  COUNT(*) as count
FROM contests
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY content_type;
```

---

## 📞 Support

If you encounter any issues during testing:

1. Check browser console for errors
2. Check Supabase logs
3. Verify migration ran successfully
4. Review the testing checklist above
5. Check that all files were deployed

---

## 🎉 Next Steps After Successful Testing

Once Phase 1 testing is complete:

1. **Monitor for a few days** - Watch for any issues
2. **Collect user feedback** - Do brands find the UI intuitive?
3. **Plan Phase 2** - Multiple submission UI for creators
4. **Document learnings** - Any improvements needed?

---

## Summary

✅ Migration is **safe** and **backward compatible**  
✅ Existing contests **will not break**  
✅ New features are **optional**  
✅ Can rollback if needed  
✅ Comprehensive testing checklist provided  

**Ready to test! 🚀**

