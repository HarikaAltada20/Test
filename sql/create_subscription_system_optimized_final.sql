-- Game of Creators Subscription System - FINAL OPTIMIZED VERSION
-- Uses REAL Stripe IDs from GOC sandbox environment
-- Optimized for scalability with client-side plan validation

-- ⚠️  WARNING: This script will DROP and RECREATE the subscriptions table!
-- ⚠️  ALL existing subscription data will be LOST!
-- ⚠️  Make sure to backup your database before running this script!

-- ============================================================================
-- 1. DROP OLD TABLES (Clean Slate)
-- ============================================================================

-- Drop old subscription-related tables if they exist
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE; -- Drop existing subscriptions table to recreate with new structure


-- ============================================================================
-- 2. CREATE ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE pricing_type AS ENUM ('one_time', 'recurring');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pricing_interval AS ENUM ('day', 'week', 'month', 'year');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM (
        'active', 
        'canceled', 
        'incomplete', 
        'incomplete_expired', 
        'past_due', 
        'trialing', 
        'unpaid'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 3. CREATE PRODUCTS TABLE (Real Stripe Product IDs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  id TEXT NOT NULL, -- Real Stripe product ID (e.g., prod_Sduka9mKXu35Ii)
  active BOOLEAN NOT NULL DEFAULT true,
  name TEXT NOT NULL UNIQUE, -- EXPLORER, STARTER, BUILDER, CHAMPION
  description TEXT,
  display_name TEXT NOT NULL, -- "Explorer Plan", "Starter Plan"
  plan_features JSONB NOT NULL DEFAULT '{}', -- All plan limits and features
  created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- 4. CREATE PRICES TABLE (Real Stripe Price IDs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prices (
  id TEXT NOT NULL, -- Real Stripe price ID (e.g., price_1RicueDCKN2LN0QeqyngXhRM)
  product_id TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  unit_amount BIGINT NOT NULL, -- Amount in cents (0 for free plans)
  currency TEXT NOT NULL DEFAULT 'usd', -- Keep as 'usd' - amount is in cents
  type pricing_type NOT NULL DEFAULT 'recurring',
  interval pricing_interval, -- NULL for one_time, required for recurring
  interval_count INTEGER NOT NULL DEFAULT 1,
  trial_period_days INTEGER NOT NULL DEFAULT 0,
  billing_scheme TEXT NOT NULL DEFAULT 'per_unit',
  description TEXT, -- "Monthly billing", "Annual billing - Save 20%", etc.
  created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT prices_pkey PRIMARY KEY (id),
  CONSTRAINT prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT prices_currency_check CHECK (char_length(currency) = 3),
  CONSTRAINT prices_unit_amount_check CHECK (unit_amount >= 0),
  CONSTRAINT prices_interval_required_for_recurring CHECK (
    (type = 'recurring' AND interval IS NOT NULL) OR 
    (type = 'one_time' AND interval IS NULL)
  )
);

-- ============================================================================
-- 5. CREATE SUBSCRIPTIONS TABLE (User Subscription Instances)
-- ============================================================================

CREATE TABLE subscriptions (
  id TEXT NOT NULL, -- Real Stripe subscription ID (e.g., sub_abc123xyz)
  user_id UUID NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  price_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  
  -- Core timestamps
  created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Cancellation timestamps (both needed for different purposes)
  ended_at TIMESTAMP WITH TIME ZONE, -- When subscription actually ended
  cancel_at TIMESTAMP WITH TIME ZONE, -- Future date when subscription WILL cancel
  canceled_at TIMESTAMP WITH TIME ZONE, -- Past date when user REQUESTED cancellation
  
  -- Trial timestamps (if applicable)
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  
  -- Metadata and notes
  stripe_metadata JSONB DEFAULT '{}',
  internal_notes TEXT, -- For support/admin notes
  
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT subscriptions_price_id_fkey FOREIGN KEY (price_id) REFERENCES prices (id),
  -- Note: One active subscription per user enforced by application logic
  CONSTRAINT subscriptions_period_logic CHECK (current_period_end > current_period_start)
);

-- ============================================================================
-- 6. UPDATE ADVERTISER_PROFILES (Clean JSONB - NULL by default)
-- ============================================================================

-- Remove old subscription columns
ALTER TABLE advertiser_profiles DROP COLUMN IF EXISTS subscription_plan;
ALTER TABLE advertiser_profiles DROP COLUMN IF EXISTS current_product_id;
ALTER TABLE advertiser_profiles DROP COLUMN IF EXISTS subscription_expires_at;
ALTER TABLE advertiser_profiles DROP COLUMN IF EXISTS subscription_last_synced;

-- Add clean subscription_info JSONB (NULL by default - cleaner approach)
ALTER TABLE advertiser_profiles 
ADD COLUMN IF NOT EXISTS subscription_info JSONB DEFAULT NULL;

-- ============================================================================
-- 7. UPDATE CONTESTS TABLE (Drop view first, then modify table)
-- ============================================================================

-- Drop the view first since it depends on the column we're removing
DROP VIEW IF EXISTS contests_with_status;

-- Remove old text column and add new JSONB column
ALTER TABLE contests DROP COLUMN IF EXISTS subscription_plan_of_user;
ALTER TABLE contests 
ADD COLUMN IF NOT EXISTS subscription_info_of_user JSONB DEFAULT NULL;

-- ============================================================================
-- 8. POPULATE WITH REAL STRIPE DATA (Fixed Typo)
-- ============================================================================

-- Insert products with REAL Stripe product IDs and actual plan features
INSERT INTO products (id, active, name, description, display_name, plan_features) VALUES 

-- EXPLORER (Free Plan)
(
  'prod_Sduka9mKXu35Ii', -- REAL Stripe product ID from your sandbox
  true,
  'EXPLORER',
  'Entry-level users, startups, or small businesses wanting to test the platform',
  'Explorer Plan',
  '{
    "maxActiveContests": 1,
    "minContestBudget": 10000,
    "maxWinnersPerContest": 3,
    "commissionPercentage": 50,
    "contestTypes": ["leaderboard"],
    "analytics": "basic",
    "support": "basic",
    "description": "Entry-level users, startups, or small businesses wanting to test the platform"
  }'::jsonb
),

-- STARTER Plan
(
  'prod_Sdum3O1ZM4wK1v', -- REAL Stripe product ID from your sandbox
  true,
  'STARTER',
  'Small to medium-sized businesses that want to run more contests and grow their presence',
  'Starter Plan',
  '{
    "maxActiveContests": 5,
    "minContestBudget": 10000,
    "maxWinnersPerContest": 10,
    "commissionPercentage": 20,
    "contestTypes": ["leaderboard", "cpm"],
    "analytics": "basic",
    "support": "basic",
    "description": "Small to medium-sized businesses that want to run more contests and grow their presence"
  }'::jsonb
),

-- BUILDER Plan
(
  'prod_SdunoupDPLZfkU', -- REAL Stripe product ID from your sandbox
  true,
  'BUILDER',
  'Medium to large brands scaling their presence and want more contests and flexibility',
  'Builder Plan',
  '{
    "maxActiveContests": 15,
    "minContestBudget": 7500,
    "maxWinnersPerContest": 25,
    "commissionPercentage": 12,
    "contestTypes": ["leaderboard", "cpm"],
    "analytics": "advanced",
    "support": "priority",
    "description": "Medium to large brands scaling their presence and want more contests and flexibility"
  }'::jsonb
),

-- CHAMPION Plan
(
  'prod_Sdunp5Rbb6V8Ax', -- REAL Stripe product ID from your sandbox
  true,
  'CHAMPION',
  'Large businesses, agencies, and enterprises looking to run high-volume campaigns with premium support',
  'Champion Plan',
  '{
    "maxActiveContests": 50,
    "minContestBudget": 5000,
    "maxWinnersPerContest": 50,
    "commissionPercentage": 10,
    "contestTypes": ["leaderboard", "cpm"],
    "analytics": "comprehensive",
    "support": "premium",
    "description": "Large businesses, agencies, and enterprises looking to run high-volume campaigns with premium support"
  }'::jsonb
)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  plan_features = EXCLUDED.plan_features;

-- Insert prices with REAL Stripe price IDs and descriptions
INSERT INTO prices (id, product_id, active, unit_amount, currency, type, interval, interval_count, trial_period_days, description) VALUES 

-- EXPLORER - Free Monthly
('price_1RicueDCKN2LN0QeqyngXhRM', 'prod_Sduka9mKXu35Ii', true, 0, 'usd', 'recurring', 'month', 1, 0, 'Free monthly access'),

-- STARTER - Monthly & Yearly
('price_1RicwmDCKN2LN0QeMBwxwt1K', 'prod_Sdum3O1ZM4wK1v', true, 10000, 'usd', 'recurring', 'month', 1, 0, 'Monthly billing'),
('price_1Rid6wDCKN2LN0Qemz2ugwmI', 'prod_Sdum3O1ZM4wK1v', true, 100000, 'usd', 'recurring', 'year', 1, 0, 'Annual billing - Save $200'),

-- BUILDER - Monthly & Yearly  
('price_1RicxUDCKN2LN0Qe3f13Nmel', 'prod_SdunoupDPLZfkU', true, 25000, 'usd', 'recurring', 'month', 1, 0, 'Monthly billing'),
('price_1Rid7PDCKN2LN0QeDCQwHKCB', 'prod_SdunoupDPLZfkU', true, 250000, 'usd', 'recurring', 'year', 1, 0, 'Annual billing - Save $500'),

-- CHAMPION - Monthly & Yearly
('price_1RicyCDCKN2LN0Qe7g4JO6RF', 'prod_Sdunp5Rbb6V8Ax', true, 50000, 'usd', 'recurring', 'month', 1, 0, 'Monthly billing'),
('price_1Rid7nDCKN2LN0QesH6RO4pO', 'prod_Sdunp5Rbb6V8Ax', true, 500000, 'usd', 'recurring', 'year', 1, 0, 'Annual billing - Save $1000')

ON CONFLICT (id) DO UPDATE SET
  unit_amount = EXCLUDED.unit_amount,
  description = EXCLUDED.description,
  active = EXCLUDED.active;

-- ============================================================================
-- 9. CREATE PERFORMANCE INDEXES
-- ============================================================================

-- Products (small table - will be cached client-side)
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Prices (small table - will be cached client-side)
CREATE INDEX IF NOT EXISTS idx_prices_product_id ON prices(product_id);
CREATE INDEX IF NOT EXISTS idx_prices_active ON prices(active);
CREATE INDEX IF NOT EXISTS idx_prices_amount_interval ON prices(unit_amount, interval);

-- Subscriptions (main table for user queries)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_price_id ON subscriptions(price_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_users ON subscriptions(user_id, status);

-- Advertiser Profiles (JSONB GIN index for fast subscription_info queries)
CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_subscription_info ON advertiser_profiles USING GIN(subscription_info);

-- Contests (JSONB GIN index for subscription_info_of_user queries)
CREATE INDEX IF NOT EXISTS idx_contests_subscription_info_of_user ON contests USING GIN(subscription_info_of_user);

-- ============================================================================
-- 10. OPTIMIZED SUBSCRIPTION MANAGEMENT FUNCTIONS (Called by Stripe Webhooks)
-- ============================================================================

-- Create new subscription (when user subscribes) - COMPLETE STRIPE FIELDS
CREATE OR REPLACE FUNCTION create_subscription(
    stripe_subscription_id TEXT,
    user_uuid UUID,
    stripe_price_id TEXT,
    subscription_status TEXT DEFAULT 'active',
    period_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
    period_end TIMESTAMP WITH TIME ZONE DEFAULT now() + INTERVAL '1 month',
    subscription_quantity INTEGER DEFAULT 1,
    cancel_at_period_end_param BOOLEAN DEFAULT false,
    cancel_at_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    trial_start_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    trial_end_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    stripe_metadata_param JSONB DEFAULT '{}',
    internal_notes_param TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    product_id_var TEXT;
BEGIN
    -- Validate price_id exists and get product_id
    SELECT product_id INTO product_id_var 
    FROM prices 
    WHERE id = stripe_price_id AND active = true;
    
    IF product_id_var IS NULL THEN
        RAISE EXCEPTION 'Active price ID % not found', stripe_price_id;
    END IF;
    
    -- Validate trial period logic
    IF (trial_start_param IS NOT NULL AND trial_end_param IS NULL) OR 
       (trial_start_param IS NULL AND trial_end_param IS NOT NULL) THEN
        RAISE EXCEPTION 'Both trial_start and trial_end must be provided together or both NULL';
    END IF;
    
    IF trial_start_param IS NOT NULL AND trial_end_param IS NOT NULL AND trial_end_param <= trial_start_param THEN
        RAISE EXCEPTION 'trial_end must be after trial_start';
    END IF;
    
    BEGIN
        -- Check for existing active subscription (since we can't use partial unique constraint)
        IF EXISTS (SELECT 1 FROM subscriptions WHERE user_id = user_uuid AND status = 'active') THEN
            RAISE EXCEPTION 'User % already has an active subscription', user_uuid;
        END IF;
        
        -- Create complete subscription record
        INSERT INTO subscriptions (
            id, user_id, status, price_id, quantity, cancel_at_period_end,
            current_period_start, current_period_end, cancel_at,
            trial_start, trial_end, stripe_metadata, internal_notes
        ) VALUES (
            stripe_subscription_id, user_uuid, subscription_status::subscription_status, stripe_price_id,
            subscription_quantity, cancel_at_period_end_param, period_start, period_end, cancel_at_param,
            trial_start_param, trial_end_param, stripe_metadata_param, internal_notes_param
        );
        
        -- Update advertiser profile with minimal essential info
        UPDATE advertiser_profiles 
        SET subscription_info = jsonb_build_object(
            'product_id', product_id_var,
            'price_id', stripe_price_id,
            'subscription_id', stripe_subscription_id,
            'last_synced', now()
        )
        WHERE id = user_uuid;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'User % not found in advertiser_profiles', user_uuid;
        END IF;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to create subscription: %', SQLERRM;
    END;
    
    RETURN stripe_subscription_id;
END;
$$;

-- Update existing subscription (COMPLETE STRIPE FIELDS SUPPORT)
CREATE OR REPLACE FUNCTION update_subscription(
    stripe_subscription_id TEXT,
    new_status TEXT DEFAULT NULL,
    new_price_id TEXT DEFAULT NULL,
    new_period_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    new_period_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    new_quantity INTEGER DEFAULT NULL,
    cancel_at_period_end_param BOOLEAN DEFAULT NULL,
    cancel_at_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    canceled_at_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ended_at_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    trial_start_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    trial_end_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    stripe_metadata_param JSONB DEFAULT NULL,
    internal_notes_param TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_uuid UUID;
    current_subscription_record RECORD;
    product_id_var TEXT;
    final_price_id TEXT;
    final_period_end TIMESTAMP WITH TIME ZONE;
    final_status subscription_status;
    final_quantity INTEGER;
BEGIN
    -- Get current subscription data in one query
    SELECT user_id, price_id, current_period_end, status, quantity
    INTO current_subscription_record
    FROM subscriptions 
    WHERE id = stripe_subscription_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription % not found', stripe_subscription_id;
    END IF;
    
    user_uuid := current_subscription_record.user_id;
    final_price_id := COALESCE(new_price_id, current_subscription_record.price_id);
    final_period_end := COALESCE(new_period_end, current_subscription_record.current_period_end);
    final_status := COALESCE(new_status::subscription_status, current_subscription_record.status);
    final_quantity := COALESCE(new_quantity, current_subscription_record.quantity);
    
    -- Validate trial period logic if provided
    IF (trial_start_param IS NOT NULL AND trial_end_param IS NULL) OR 
       (trial_start_param IS NULL AND trial_end_param IS NOT NULL) THEN
        RAISE EXCEPTION 'Both trial_start and trial_end must be provided together or both NULL';
    END IF;
    
    IF trial_start_param IS NOT NULL AND trial_end_param IS NOT NULL AND trial_end_param <= trial_start_param THEN
        RAISE EXCEPTION 'trial_end must be after trial_start';
    END IF;
    
    -- Validate new price_id if provided
    IF new_price_id IS NOT NULL THEN
        SELECT product_id INTO product_id_var 
        FROM prices 
        WHERE id = new_price_id AND active = true;
        
        IF product_id_var IS NULL THEN
            RAISE EXCEPTION 'Active price ID % not found', new_price_id;
        END IF;
    ELSE
        -- Get product_id for current price
        SELECT product_id INTO product_id_var 
        FROM prices 
        WHERE id = final_price_id;
    END IF;
    
    BEGIN
        -- Update subscription record with ALL possible fields
        UPDATE subscriptions SET
            status = final_status,
            price_id = final_price_id,
            quantity = final_quantity,
            current_period_start = COALESCE(new_period_start, current_period_start),
            current_period_end = final_period_end,
            cancel_at_period_end = COALESCE(cancel_at_period_end_param, cancel_at_period_end),
            cancel_at = COALESCE(cancel_at_param, cancel_at),
            canceled_at = COALESCE(canceled_at_param, canceled_at),
            ended_at = COALESCE(ended_at_param, ended_at),
            trial_start = COALESCE(trial_start_param, trial_start),
            trial_end = COALESCE(trial_end_param, trial_end),
            stripe_metadata = COALESCE(stripe_metadata_param, stripe_metadata),
            internal_notes = COALESCE(internal_notes_param, internal_notes),
            updated = now()
        WHERE id = stripe_subscription_id;
        
        -- Update advertiser profile ONLY if subscription is still active
        IF final_status = 'active' THEN
            UPDATE advertiser_profiles 
            SET subscription_info = jsonb_build_object(
                'product_id', product_id_var,
                'price_id', final_price_id,
                'subscription_id', stripe_subscription_id,
                'last_synced', now()
            )
            WHERE id = user_uuid;
        ELSE
            -- If subscription is no longer active, set to free plan
            UPDATE advertiser_profiles 
            SET subscription_info = jsonb_build_object(
                'product_id', 'prod_Sduka9mKXu35Ii', -- EXPLORER (free)
                'price_id', 'price_1RicueDCKN2LN0QeqyngXhRM', -- Free price
                'subscription_id', null,
                'last_synced', now()
            )
            WHERE id = user_uuid;
        END IF;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to update subscription: %', SQLERRM;
    END;
END;
$$;

-- Cancel subscription (COMPLETE CANCELLATION HANDLING)
CREATE OR REPLACE FUNCTION cancel_subscription(
    stripe_subscription_id TEXT,
    canceled_at_param TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ended_at_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    cancel_at_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    cancellation_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_uuid UUID;
    current_notes TEXT;
BEGIN
    -- Get user_id and current notes for this subscription
    SELECT user_id, internal_notes INTO user_uuid, current_notes
    FROM subscriptions 
    WHERE id = stripe_subscription_id;
    
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'Subscription % not found', stripe_subscription_id;
    END IF;
    
    BEGIN
        -- Update subscription to canceled with complete cancellation data
        UPDATE subscriptions SET
            status = 'canceled',
            canceled_at = canceled_at_param,
            ended_at = COALESCE(ended_at_param, canceled_at_param),
            cancel_at = cancel_at_param, -- Future cancellation date if different
            internal_notes = CASE 
                WHEN cancellation_reason IS NOT NULL THEN
                    COALESCE(current_notes || E'\n', '') || 
                    'CANCELED: ' || canceled_at_param::text || ' - ' || cancellation_reason
                ELSE current_notes
            END,
            updated = now()
        WHERE id = stripe_subscription_id;
        
        -- Set user back to EXPLORER (free plan)
        UPDATE advertiser_profiles 
        SET subscription_info = jsonb_build_object(
            'product_id', 'prod_Sduka9mKXu35Ii', -- EXPLORER
            'price_id', 'price_1RicueDCKN2LN0QeqyngXhRM', -- Free price
            'subscription_id', null,
            'last_synced', now()
        )
        WHERE id = user_uuid;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to cancel subscription: %', SQLERRM;
    END;
END;
$$;



-- ============================================================================
-- 11. RECREATE CONTESTS_WITH_STATUS VIEW (With new subscription_info_of_user column)
-- ============================================================================

-- Recreate the view with subscription_info_of_user column (was dropped earlier)

CREATE VIEW contests_with_status AS
SELECT
  contests.id,
  contests.advertiser_id,
  contests.title,
  contests.platform,
  contests.start_date,
  contests.end_date,
  contests.thumbnail_url,
  contests.resources,
  contests.category,
  contests.inspiration_links,
  contests.created_at,
  contests.subscription_info_of_user, -- Only this JSONB column for subscription data
  contests.updated_at,
  contests.contest_type,
  contests.contest_based_details,
  contests.live_submission_count,
  contests.post_contest_status,
  contests.brief_html,
  contests.brief_json,
  contests.last_metrics_updated,
  contests.rules_html,
  contests.rules_json,
  contests.moderation_status,
  contests.submitted_for_approval_at,
  contests.approved_at,
  contests.approved_by,
  contests.published_at,
  contests.rejection_reason,
  contests.payment_details,
  CASE
    WHEN contests.moderation_status <> 'published'::contest_moderation_status_enum THEN NULL::text
    WHEN contests.start_date IS NULL OR contests.end_date IS NULL THEN 'incomplete'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) < contests.start_date THEN 'upcoming'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.start_date
    AND (now() AT TIME ZONE 'UTC'::text) < contests.end_date THEN 'active'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.end_date THEN 'ended'::text
    ELSE 'unknown'::text
  END AS status
FROM contests;

-- ============================================================================
-- 12. INITIALIZE EXISTING USERS TO EXPLORER PLAN
-- ============================================================================

-- ⚠️  IMPORTANT: Since we dropped the old subscriptions table, ALL users will be reset to free plan
-- Users with active Stripe subscriptions will need to be re-synced via webhook or manual process

-- Set ALL users to EXPLORER (free) plan since we recreated the subscriptions table
UPDATE advertiser_profiles 
SET subscription_info = jsonb_build_object(
    'product_id', 'prod_Sduka9mKXu35Ii',
    'price_id', 'price_1RicueDCKN2LN0QeqyngXhRM',
    'subscription_id', null,
    'last_synced', now()
);

-- ============================================================================
-- 13. ROW LEVEL SECURITY
-- ============================================================================

-- Users can only see their own subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_user_policy ON subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- Products and prices are public (read-only) - will be cached client-side
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_public_read ON products
    FOR SELECT USING (true);

CREATE POLICY prices_public_read ON prices
    FOR SELECT USING (true);

-- ============================================================================
-- MIGRATION COMPLETE - OPTIMIZED VERSION FOR GAME OF CREATORS!
-- ============================================================================

COMMENT ON TABLE products IS 'Game of Creators subscription plans synced with real Stripe products';
COMMENT ON TABLE prices IS 'Pricing options with descriptions - monthly/yearly billing';
COMMENT ON TABLE subscriptions IS 'User subscription instances - only 1 active per user allowed';
COMMENT ON COLUMN advertiser_profiles.subscription_info IS 'Clean JSONB: {product_id, price_id, subscription_id, last_synced} - Client fetches details from respective tables';
COMMENT ON COLUMN contests.subscription_info_of_user IS 'JSONB snapshot of complete user subscription info at contest creation time: {product_id, plan_name, price_id, subscription_id, expires_at, plan_features, etc}';

COMMENT ON COLUMN subscriptions.cancel_at IS 'Future date when subscription WILL be canceled (user clicked "cancel at period end")';
COMMENT ON COLUMN subscriptions.canceled_at IS 'Past date when user REQUESTED cancellation';

-- Performance Note: Plan validation should be done CLIENT-SIDE by:
-- 1. Cache products table (4 rows, rarely changes)
-- 2. Get user.subscription_info (only 4 fields: product_id, price_id, subscription_id, last_synced)
-- 3. Look up plan_features in cached products[product_id]
-- 4. Look up pricing in cached prices[price_id] 
-- 5. Query subscriptions table only if detailed subscription data needed
-- This avoids database JOINs and scales to 1000+ concurrent users

-- Webhook Usage:
-- Stripe webhook calls these COMPLETE functions to manage subscription lifecycle:
-- 
-- create_subscription(subscription_id, user_id, price_id, status, period_start, period_end, 
--                    quantity, cancel_at_period_end, cancel_at, trial_start, trial_end, 
--                    metadata, internal_notes)
-- 
-- update_subscription(subscription_id, status, price_id, period_start, period_end, quantity,
--                    cancel_at_period_end, cancel_at, canceled_at, ended_at, trial_start, 
--                    trial_end, metadata, internal_notes)
-- 
-- cancel_subscription(subscription_id, canceled_at, ended_at, cancel_at, cancellation_reason)

-- Contest Usage:
-- When creating contests, copy user's subscription_info plus plan details:
-- subscription_info_of_user = {
--   product_id: 'prod_Sdum3O1ZM4wK1v',
--   price_id: 'price_1RicwmDCKN2LN0QeMBwxwt1K',
--   subscription_id: 'sub_123abc',
--   last_synced: '2024-01-01T00:00:00Z',
-- }

-- Final verification
SELECT 'GAME OF CREATORS SUBSCRIPTION MIGRATION COMPLETED! 🎉' as status,
       'Features: Real Stripe IDs + COMPLETE Function Support + Optimized Performance + Clean JSONB Contest Tracking + Scalability' as message,
       'Functions now handle ALL Stripe subscription fields: quantity, trials, cancellation dates, metadata, notes, etc.' as details,
       'NEXT STEP: Re-sync existing Stripe subscriptions by calling your webhook endpoints or running a Stripe subscription sync script' as next_action; 