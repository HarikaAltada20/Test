# Twitter Integration Migration Guide

This guide explains how to apply the Twitter integration changes from the test database to the main/production database.

## Overview

The Twitter integration adds support for Twitter/X campaigns with the following features:
- Creator Twitter account connection
- Automated tweet fetching and tracking
- Campaign leaderboards
- Moderation system
- Raid and awareness campaign types
- Manual points adjustment

## ⚠️ CRITICAL: Backup Your Database First!

**DO NOT proceed without backing up your database!**

See **[DATABASE_BACKUP_GUIDE.md](./DATABASE_BACKUP_GUIDE.md)** for detailed backup instructions.

### Quick Backup (Supabase Dashboard):
1. Go to **Settings** → **Database** → **Backups**
2. Click **Create backup** or **New backup**
3. Name it: `pre_twitter_migration_YYYY-MM-DD`
4. Wait for completion
5. Verify the backup appears in the list

### Quick Backup (Command Line):
```bash
pg_dump "postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres" \
  --file=backup_pre_twitter_migration_$(date +%Y%m%d_%H%M%S).sql
```

**Only proceed to the next step after you have confirmed your backup is complete!**

## Migration File

**File:** `migrate_twitter_to_main.sql`

This consolidated migration file includes all Twitter-related database changes in the correct order:
1. Extended existing tables (creator_profiles)
2. Twitter campaign participants table
3. Twitter campaign tweets table
4. Twitter campaign leaderboard table
5. Twitter campaign metrics table
6. Triggers and functions
7. JSONB indexes for performance
8. Helper functions
9. View updates

## How to Apply

### Option 1: Using Supabase Dashboard (Recommended)

1. Log in to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the file `SUPABASE/migrate_twitter_to_main.sql`
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** to execute

### Option 2: Using Supabase CLI

```bash
# Make sure you're authenticated
supabase login

# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Run the migration
supabase db execute --file SUPABASE/migrate_twitter_to_main.sql
```

### Option 3: Using psql

```bash
psql -h your-db-host -U postgres -d postgres -f SUPABASE/migrate_twitter_to_main.sql
```

## What Gets Created

### Tables
- `twitter_campaign_participants` - Tracks creators who joined campaigns
- `twitter_campaign_tweets` - Individual tweets fetched and tracked
- `twitter_campaign_leaderboard` - Aggregated leaderboard per creator
- `twitter_campaign_metrics` - Campaign-level metrics and targets

### Columns Added
- `creator_profiles.twitter_account` - JSONB column for Twitter account data

### Indexes
- Multiple performance indexes for fast queries
- JSONB GIN indexes for Twitter campaign queries
- Composite indexes for common query patterns

### Functions & Triggers
- `update_twitter_tweet_updated_at()` - Auto-updates timestamps
- `increment_participant_tweet_count()` - Updates participant stats
- `get_twitter_campaign_type()` - Helper function for queries

### Views
- `contests_with_status` - Updated to include all necessary columns

## Verification

After running the migration, verify it was successful:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'twitter_%' 
ORDER BY table_name;

-- Should return:
-- twitter_campaign_leaderboard
-- twitter_campaign_metrics
-- twitter_campaign_participants
-- twitter_campaign_tweets

-- Check twitter_account column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'creator_profiles' 
AND column_name = 'twitter_account';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_twitter_%' 
ORDER BY indexname;
```

## Safety Features

The migration is designed to be **idempotent** (safe to run multiple times):
- Uses `IF NOT EXISTS` for tables
- Uses `IF NOT EXISTS` for indexes
- Uses `IF NOT EXISTS` / `IF EXISTS` for columns
- Uses `CREATE OR REPLACE` for functions and views
- Uses `DROP TRIGGER IF EXISTS` before creating triggers

## Rollback

If you need to rollback (not recommended in production), you would need to:
1. Drop the tables (in reverse order due to foreign keys)
2. Remove the column from creator_profiles
3. Drop indexes
4. Drop functions
5. Restore the original view

**Note:** This migration does NOT include a rollback script. Make sure to backup your database before running.

## Dependencies

This migration assumes:
- `contests` table exists
- `users` table exists
- `creator_profiles` table exists
- `contest_moderation_status_enum` enum type exists

## Post-Migration

After running the migration:

1. **Test the integration:**
   - Try connecting a Twitter account
   - Create a test Twitter campaign
   - Verify tweet fetching works

2. **Monitor performance:**
   - Check query performance on new tables
   - Monitor index usage

3. **Set up RLS policies (if needed):**
   - Currently, the migration doesn't include RLS policies
   - You may want to add policies based on your security requirements

## Troubleshooting

### Error: "relation already exists"
- This is normal if you've run the migration before
- The migration uses `IF NOT EXISTS` so it should skip existing objects
- If you see this error, check if the table structure matches

### Error: "column already exists"
- The migration uses `IF NOT EXISTS` for columns
- If you see this, the column might have been added manually
- Check the column definition matches

### Error: "permission denied"
- Make sure you're running as a user with sufficient privileges
- In Supabase, use the service role key or admin user

## Support

If you encounter issues:
1. Check the Supabase logs
2. Verify all dependencies are met
3. Check the verification queries above
4. Review the error message for specific table/column names

## Next Steps

After successful migration:
1. Update your application code to use the new Twitter features
2. Test thoroughly in a staging environment
3. Monitor for any performance issues
4. Consider adding RLS policies if needed
