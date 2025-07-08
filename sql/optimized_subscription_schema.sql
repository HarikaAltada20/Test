-- GoViral Optimized Subscription System Schema
-- Designed for real Stripe integration with proper constraints and optimization
-- This schema should be populated AFTER creating products/prices in Stripe

-- ============================================================================
-- 1. CREATE ENUMS (More precise naming and coverage)
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
-- 2. PRODUCTS TABLE (Stripe Product Sync)
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  id TEXT NOT NULL, -- Real Stripe product ID (e.g., prod_abc123xyz)
  active BOOLEAN NOT NULL DEFAULT true,
  name TEXT NOT NULL, -- EXPLORER, STARTER, BUILDER, CHAMPION
  description TEXT, -- Optional longer description
  display_name TEXT NOT NULL, -- "Explorer Plan", "Starter Plan"
  sort_order INTEGER NOT NULL DEFAULT 0, -- For UI ordering
  plan_features JSONB NOT NULL DEFAULT '{}', -- All plan limits/features
  created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_name_unique UNIQUE (name),
  CONSTRAINT products_sort_order_unique UNIQUE (sort_order)
);

-- ============================================================================
-- 3. PRICES TABLE (Stripe Price Sync)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prices (
  id TEXT NOT NULL, -- Real Stripe price ID (e.g., price_def456uvw)
  product_id TEXT NOT NULL, -- FK to products.id (real Stripe product ID)
  active BOOLEAN NOT NULL DEFAULT true,
  unit_amount BIGINT NOT NULL, -- Amount in cents (0 for free plans)
  currency TEXT NOT NULL DEFAULT 'usd',
  type pricing_type NOT NULL DEFAULT 'recurring',
  interval pricing_interval, -- NULL for one_time, required for recurring
  interval_count INTEGER NOT NULL DEFAULT 1,
  trial_period_days INTEGER NOT NULL DEFAULT 0,
  billing_scheme TEXT NOT NULL DEFAULT 'per_unit', -- Stripe billing scheme
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
-- 4. SUBSCRIPTIONS TABLE (User Subscription Instances)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT NOT NULL, -- Real Stripe subscription ID (e.g., sub_abc123xyz)
  user_id UUID NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  price_id TEXT NOT NULL, -- FK to prices.id (real Stripe price ID)
  quantity INTEGER NOT NULL DEFAULT 1,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  
  -- Stripe timestamps (all NOT NULL for active subscriptions)
  created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Optional timestamps (NULL until they occur)
  ended_at TIMESTAMP WITH TIME ZONE,
  cancel_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  
  -- Stripe metadata and internal tracking
  stripe_metadata JSONB DEFAULT '{}',
  internal_notes TEXT, -- For support/admin notes
  
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT subscriptions_price_id_fkey FOREIGN KEY (price_id) REFERENCES prices (id),
  CONSTRAINT subscriptions_one_active_per_user UNIQUE (user_id) WHERE (status = 'active'),
  CONSTRAINT subscriptions_period_logic CHECK (current_period_end > current_period_start),
  CONSTRAINT subscriptions_trial_logic CHECK (
    (trial_start IS NULL AND trial_end IS NULL) OR 
    (trial_start IS NOT NULL AND trial_end IS NOT NULL AND trial_end > trial_start)
  )
);

-- ============================================================================
-- 5. SUBSCRIPTION HISTORY (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'canceled', 'reactivated'
  old_status subscription_status,
  new_status subscription_status,
  old_price_id TEXT,
  new_price_id TEXT,
  reason TEXT, -- Why the change happened
  changed_by UUID, -- admin user who made the change (NULL for automated)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT subscription_history_subscription_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions (id),
  CONSTRAINT subscription_history_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id)
);

-- ============================================================================
-- 6. WEBHOOK EVENTS (Stripe Webhook Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT NOT NULL PRIMARY KEY, -- Stripe event ID (evt_abc123xyz)
  type TEXT NOT NULL, -- invoice.payment_succeeded, customer.subscription.updated, etc.
  object_id TEXT, -- The ID of the related object (subscription, invoice, etc.)
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT, -- If processing failed
  retry_count INTEGER NOT NULL DEFAULT 0,
  created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 7. UPDATE ADVERTISER_PROFILES (Simplified)
-- ============================================================================

-- Remove old subscription_plan column
ALTER TABLE advertiser_profiles DROP COLUMN IF EXISTS subscription_plan;

-- Add optimized subscription reference (denormalized for performance)
ALTER TABLE advertiser_profiles 
ADD COLUMN IF NOT EXISTS current_product_id TEXT REFERENCES products(id),
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_last_synced TIMESTAMP WITH TIME ZONE DEFAULT now();

-- ============================================================================
-- 8. INDEXES FOR OPTIMAL PERFORMANCE
-- ============================================================================

-- Products
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);

-- Prices  
CREATE INDEX IF NOT EXISTS idx_prices_product_id ON prices(product_id);
CREATE INDEX IF NOT EXISTS idx_prices_active ON prices(active);
CREATE INDEX IF NOT EXISTS idx_prices_amount_interval ON prices(unit_amount, interval);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_price_id ON subscriptions(price_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_users ON subscriptions(user_id, status) 
  WHERE status = 'active';

-- Subscription History
CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription_id ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON subscription_history(created_at);

-- Webhook Events
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON stripe_webhook_events(type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON stripe_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_object_id ON stripe_webhook_events(object_id);

-- Advertiser Profiles
CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_product_id ON advertiser_profiles(current_product_id);
CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_expires_at ON advertiser_profiles(subscription_expires_at);

-- ============================================================================
-- 9. OPTIMIZED FUNCTIONS
-- ============================================================================

-- Get user's current subscription with plan details
CREATE OR REPLACE FUNCTION get_user_subscription_details(user_uuid UUID)
RETURNS TABLE (
    subscription_id TEXT,
    subscription_status TEXT,
    product_id TEXT,
    product_name TEXT,
    product_display_name TEXT,
    price_id TEXT,
    amount_cents BIGINT,
    currency TEXT,
    billing_interval TEXT,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN,
    plan_features JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.status::text,
        p.id,
        p.name,
        p.display_name,
        pr.id,
        pr.unit_amount,
        pr.currency,
        pr.interval::text,
        s.current_period_start,
        s.current_period_end,
        s.cancel_at_period_end,
        p.plan_features
    FROM subscriptions s
    JOIN prices pr ON s.price_id = pr.id
    JOIN products p ON pr.product_id = p.id
    WHERE s.user_id = user_uuid 
      AND s.status = 'active'
      AND s.current_period_end > now()
    ORDER BY s.created DESC
    LIMIT 1;
END;
$$;

-- Fast plan validation for contest creation
CREATE OR REPLACE FUNCTION validate_user_plan_limits(
    user_uuid UUID,
    OUT max_active_contests INTEGER,
    OUT min_contest_budget BIGINT,
    OUT max_winners_per_contest INTEGER,
    OUT commission_percentage INTEGER,
    OUT allowed_contest_types TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    user_product_id TEXT;
    features JSONB;
BEGIN
    -- Get current product ID (fast lookup from advertiser_profiles)
    SELECT current_product_id INTO user_product_id 
    FROM advertiser_profiles 
    WHERE id = user_uuid;
    
    -- Default to EXPLORER if no product found
    IF user_product_id IS NULL THEN
        user_product_id := (SELECT id FROM products WHERE name = 'EXPLORER' LIMIT 1);
    END IF;
    
    -- Get plan features
    SELECT plan_features INTO features 
    FROM products 
    WHERE id = user_product_id;
    
    -- Extract limits
    max_active_contests := (features->>'maxActiveContests')::INTEGER;
    min_contest_budget := (features->>'minContestBudget')::BIGINT;
    max_winners_per_contest := (features->>'maxWinnersPerContest')::INTEGER;
    commission_percentage := (features->>'commissionPercentage')::INTEGER;
    allowed_contest_types := ARRAY(SELECT jsonb_array_elements_text(features->'contestTypes'));
END;
$$;

-- Sync advertiser profile with current subscription (called by webhooks)
CREATE OR REPLACE FUNCTION sync_advertiser_subscription_data(user_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    active_sub RECORD;
    explorer_product_id TEXT;
BEGIN
    -- Get current active subscription
    SELECT * INTO active_sub FROM get_user_subscription_details(user_uuid) LIMIT 1;
    
    IF active_sub.subscription_id IS NOT NULL THEN
        -- Update with active subscription
        UPDATE advertiser_profiles 
        SET 
            current_product_id = active_sub.product_id,
            subscription_expires_at = active_sub.current_period_end,
            subscription_last_synced = now()
        WHERE id = user_uuid;
    ELSE
        -- No active subscription, default to EXPLORER
        SELECT id INTO explorer_product_id FROM products WHERE name = 'EXPLORER' LIMIT 1;
        
        UPDATE advertiser_profiles 
        SET 
            current_product_id = explorer_product_id,
            subscription_expires_at = NULL,
            subscription_last_synced = now()
        WHERE id = user_uuid;
    END IF;
END;
$$;

-- ============================================================================
-- 10. TRIGGER FOR AUDIT TRAIL
-- ============================================================================

CREATE OR REPLACE FUNCTION log_subscription_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO subscription_history (
            subscription_id, user_id, action, new_status, new_price_id, reason
        ) VALUES (
            NEW.id, NEW.user_id, 'created', NEW.status, NEW.price_id, 'Subscription created'
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO subscription_history (
            subscription_id, user_id, action, old_status, new_status, 
            old_price_id, new_price_id, reason
        ) VALUES (
            NEW.id, NEW.user_id, 'updated', OLD.status, NEW.status,
            OLD.price_id, NEW.price_id, 'Subscription updated'
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_subscription_audit
    AFTER INSERT OR UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION log_subscription_changes();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE products IS 'Stripe products (subscription plans) - populated from real Stripe product IDs';
COMMENT ON TABLE prices IS 'Stripe prices (monthly/yearly billing) - populated from real Stripe price IDs'; 
COMMENT ON TABLE subscriptions IS 'User subscription instances synced with Stripe subscriptions';
COMMENT ON TABLE subscription_history IS 'Audit trail of all subscription changes';
COMMENT ON TABLE stripe_webhook_events IS 'Tracking of Stripe webhook processing for reliability';

COMMENT ON COLUMN advertiser_profiles.current_product_id IS 'Denormalized current plan for fast access - synced via triggers';
COMMENT ON COLUMN advertiser_profiles.subscription_expires_at IS 'When current subscription expires - for quick validation';

-- ============================================================================
-- SECURITY POLICIES (RLS)
-- ============================================================================

-- Users can only see their own subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_user_policy ON subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- Subscription history follows same pattern
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_history_user_policy ON subscription_history
    FOR SELECT USING (auth.uid() = user_id);

-- Products and prices are public (read-only for users)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_public_read ON products
    FOR SELECT USING (true);

CREATE POLICY prices_public_read ON prices  
    FOR SELECT USING (true); 