# Test Database Setup Guide for Twitter Integration

This guide will help you set up a test database in Supabase for testing Twitter integration features.

## Prerequisites

1. Supabase account (you already have one: `rjprmbjqetxkramwbrqo`)
2. Access to Supabase Dashboard
3. SQL Editor access

## Option 1: Create a New Test Project in Supabase (Recommended)

### Step 1: Create New Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Name**: `GoViral Twitter Test` (or any name)
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is fine for testing
4. Click **"Create new project"**
5. Wait 2-3 minutes for project to initialize

### Step 2: Get Connection Details

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key**
   - **service_role key** (keep secret!)

### Step 3: Run Base Schema Migration

1. Go to **SQL Editor** in Supabase Dashboard
2. You'll need to run your existing schema first. Options:
   - **Option A**: If you have a complete schema dump, run it
   - **Option B**: Run migrations in order from your `SUPABASE/` folder
   - **Option C**: Use Supabase CLI to link and push schema

### Step 4: Run Twitter Integration Migration

1. Open **SQL Editor** in Supabase Dashboard
2. Copy the contents of `add_twitter_integration.sql`
3. Paste and click **"Run"**
4. Verify success (should see "Success. No rows returned")

### Step 5: Seed Test Data

1. **First, get your test user IDs:**
   ```sql
   -- Create test users if they don't exist
   -- You'll need to create these via your app's signup flow
   -- OR manually insert them (see below)
   ```

2. **Update the test user IDs in `seed_twitter_test_data.sql`:**
   - Replace `test_advertiser_id` with actual advertiser UUID
   - Replace `test_creator_id` with actual creator UUID

3. **Run the seed script:**
   - Copy contents of `seed_twitter_test_data.sql`
   - Paste in SQL Editor
   - Click **"Run"**

### Step 6: Update Environment Variables

Create a `.env.test` file for your developer:

```env
# Test Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-test-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-test-service-role-key

# Test Twitter API (if you have test credentials)
TWITTER_API_KEY=test_key
TWITTER_API_SECRET=test_secret
TWITTER_BEARER_TOKEN=test_bearer_token

# Other test configs...
```

---

## Option 2: Use Existing Project with Test Schema Prefix

If you want to test in your existing project but keep data separate:

### Step 1: Create Test Schema

```sql
-- Create a separate schema for testing
CREATE SCHEMA IF NOT EXISTS test_twitter;

-- Copy tables to test schema (optional, or just use existing tables)
```

### Step 2: Run Migrations with Test Prefix

Modify table names in migration to use `test_` prefix:

```sql
-- Example: test_twitter_campaign_tweets instead of twitter_campaign_tweets
```

---

## Option 3: Use Local Supabase (Docker)

For local development:

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Initialize Supabase Locally

```bash
cd "d:\Persist Ventures\GoViral"
supabase init
```

### Step 3: Start Local Supabase

```bash
supabase start
```

This will:
- Start PostgreSQL, PostgREST, GoTrue, etc.
- Give you local connection details
- Create local database

### Step 4: Run Migrations

```bash
# Link to your project (optional, for schema sync)
supabase link --project-ref rjprmbjqetxkramwbrqo

# Run migrations
supabase db reset  # This runs all migrations in supabase/migrations/
```

### Step 5: Run Twitter Migration

```bash
# Copy migration to migrations folder
cp SUPABASE/add_twitter_integration.sql supabase/migrations/$(date +%Y%m%d%H%M%S)_add_twitter_integration.sql

# Reset database to apply
supabase db reset
```

---

## Quick Setup Script for Developer

Create this script to help your developer set up quickly:

### `setup-test-db.sh` (or `.bat` for Windows)

```bash
#!/bin/bash

echo "🚀 Setting up Twitter Integration Test Database..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Initialize if needed
if [ ! -f "supabase/config.toml" ]; then
    echo "📦 Initializing Supabase..."
    supabase init
fi

# Start Supabase
echo "🔄 Starting local Supabase..."
supabase start

# Run migrations
echo "📝 Running migrations..."
supabase db reset

echo "✅ Test database setup complete!"
echo ""
echo "Connection details:"
supabase status
```

---

## Verification Checklist

After setup, verify everything works:

### ✅ Database Tables Created

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'twitter%'
ORDER BY table_name;
```

Expected tables:
- `twitter_campaign_participants`
- `twitter_campaign_tweets`
- `twitter_campaign_leaderboard`

### ✅ Test Data Seeded

```sql
-- Check test contest
SELECT id, title, platform, campaign_content_type 
FROM contests 
WHERE platform = 'twitter';

-- Check test tweets
SELECT COUNT(*) as tweet_count 
FROM twitter_campaign_tweets;

-- Check leaderboard
SELECT * FROM twitter_campaign_leaderboard;
```

### ✅ Indexes Created

```sql
-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename LIKE 'twitter%';
```

---

## Common Issues & Solutions

### Issue: "relation already exists"

**Solution**: Tables already exist. Either:
- Drop and recreate: `DROP TABLE IF EXISTS twitter_campaign_tweets CASCADE;`
- Or use `IF NOT EXISTS` in migration (already included)

### Issue: "permission denied"

**Solution**: Make sure you're using the service role key, not anon key for admin operations.

### Issue: "foreign key constraint fails"

**Solution**: Make sure base tables exist first:
- `contests`
- `users`
- `creator_profiles`

### Issue: "test user IDs not found"

**Solution**: 
1. Create test users first via your app
2. Or manually insert test users
3. Update UUIDs in seed script

---

## Test User Creation (Manual)

If you need to create test users manually:

```sql
-- Create test advertiser
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test-advertiser@example.com',
  crypt('testpassword123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

INSERT INTO public.users (id, email, username, user_type, full_name)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test-advertiser@example.com',
  'test_advertiser',
  'advertiser',
  'Test Advertiser'
);

-- Create test creator (similar)
-- ... (repeat for creator)
```

---

## Next Steps for Developer

1. ✅ Database setup complete
2. ✅ Test data seeded
3. 🔄 Connect to test database in app
4. 🔄 Test Twitter OAuth flow
5. 🔄 Test tweet fetching
6. 🔄 Test leaderboard refresh
7. 🔄 Test campaign creation

---

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs
2. Check migration errors in SQL Editor
3. Verify RLS policies if using Row Level Security
4. Check foreign key constraints

---

**Last Updated**: 2025-01-XX
