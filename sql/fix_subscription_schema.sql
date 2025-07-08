-- Fix Subscription Schema for GoViral
-- These are minimal changes to make your existing architecture work perfectly

-- 1. Add proper foreign key relationship for subscription_plan
-- Currently it's just text, let's make it reference the subscription_plans table
-- We'll use the plan name as the reference since that's more user-friendly

-- First, ensure all existing subscription_plan values are valid
UPDATE advertiser_profiles 
SET subscription_plan = 'free' 
WHERE subscription_plan NOT IN (SELECT name FROM subscription_plans);

-- Add foreign key constraint to ensure data integrity
-- Note: This assumes subscription_plans.name contains values like 'free', 'basic', 'premium', etc.
-- ALTER TABLE advertiser_profiles 
-- ADD CONSTRAINT advertiser_profiles_subscription_plan_fkey 
-- FOREIGN KEY (subscription_plan) REFERENCES subscription_plans(name);

-- 2. Add some missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry_date ON subscriptions(expiry_date);
CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_subscription_plan ON advertiser_profiles(subscription_plan);

-- 3. Add helpful subscription management functions

-- Function to get user's active subscription
CREATE OR REPLACE FUNCTION get_user_active_subscription(user_uuid UUID)
RETURNS TABLE (
    subscription_id UUID,
    plan_id UUID,
    plan_name TEXT,
    plan_price NUMERIC,
    plan_features JSONB,
    status TEXT,
    start_date DATE,
    expiry_date DATE,
    gateway TEXT,
    external_subscription_id TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as subscription_id,
        s.plan_id,
        sp.name as plan_name,
        sp.price as plan_price,
        sp.json_features as plan_features,
        s.status,
        s.start_date,
        s.expiry_date,
        s.gateway,
        s.external_subscription_id
    FROM subscriptions s
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.user_id = user_uuid 
      AND s.status = 'active'
      AND (s.expiry_date IS NULL OR s.expiry_date > CURRENT_DATE)
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$;

-- Function to update user's current subscription plan in advertiser_profiles
CREATE OR REPLACE FUNCTION sync_advertiser_subscription_plan(user_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_plan_name TEXT;
BEGIN
    -- Get the current active subscription plan name
    SELECT sp.name INTO current_plan_name
    FROM subscriptions s
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.user_id = user_uuid 
      AND s.status = 'active'
      AND (s.expiry_date IS NULL OR s.expiry_date > CURRENT_DATE)
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    -- If no active subscription found, set to 'free'
    IF current_plan_name IS NULL THEN
        current_plan_name := 'free';
    END IF;
    
    -- Update advertiser_profiles
    UPDATE advertiser_profiles 
    SET subscription_plan = current_plan_name,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = user_uuid;
END;
$$;

-- Function to create a new subscription record
CREATE OR REPLACE FUNCTION create_subscription(
    user_uuid UUID,
    plan_uuid UUID,
    gateway_name TEXT,
    external_sub_id TEXT DEFAULT NULL,
    trial_days INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_subscription_id UUID;
    start_date DATE;
    expiry_date DATE;
    trial_end_date DATE;
BEGIN
    start_date := CURRENT_DATE;
    
    -- Calculate expiry date (assume monthly billing for now)
    expiry_date := start_date + INTERVAL '1 month';
    
    -- Calculate trial end if applicable
    IF trial_days > 0 THEN
        trial_end_date := start_date + (trial_days || ' days')::INTERVAL;
    END IF;
    
    -- Create subscription record
    INSERT INTO subscriptions (
        user_id,
        plan_id,
        gateway,
        external_subscription_id,
        status,
        start_date,
        expiry_date,
        trial_end,
        created_at,
        updated_at
    ) VALUES (
        user_uuid,
        plan_uuid,
        gateway_name,
        external_sub_id,
        'active',
        start_date,
        expiry_date,
        trial_end_date,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ) RETURNING id INTO new_subscription_id;
    
    -- Sync the subscription plan in advertiser_profiles
    PERFORM sync_advertiser_subscription_plan(user_uuid);
    
    RETURN new_subscription_id;
END;
$$;

-- Function to cancel subscription
CREATE OR REPLACE FUNCTION cancel_subscription(
    user_uuid UUID,
    cancel_immediately BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subscription_record RECORD;
BEGIN
    -- Find active subscription
    SELECT id, expiry_date INTO subscription_record
    FROM subscriptions
    WHERE user_id = user_uuid 
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF subscription_record.id IS NULL THEN
        RETURN FALSE; -- No active subscription found
    END IF;
    
    IF cancel_immediately THEN
        -- Cancel immediately
        UPDATE subscriptions 
        SET status = 'canceled',
            expiry_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = subscription_record.id;
        
        -- Sync to advertiser_profiles immediately
        PERFORM sync_advertiser_subscription_plan(user_uuid);
    ELSE
        -- Cancel at period end
        UPDATE subscriptions 
        SET cancel_at_period_end = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = subscription_record.id;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- 4. Add RLS policies for security (if using RLS)
-- ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can view their own subscriptions" ON subscriptions
--   FOR SELECT USING (auth.uid() = user_id);

-- CREATE POLICY "Service role can manage all subscriptions" ON subscriptions
--   FOR ALL USING (auth.role() = 'service_role');

-- 5. Create a view for easy subscription data access
CREATE OR REPLACE VIEW user_subscription_details AS
SELECT 
    ap.id as user_id,
    ap.subscription_plan as current_plan_name,
    sp.id as current_plan_id,
    sp.price as current_plan_price,
    sp.json_features as current_plan_features,
    sp.stripe_price_id,
    sp.razorpay_plan_id,
    s.id as subscription_id,
    s.gateway,
    s.external_subscription_id,
    s.status as subscription_status,
    s.start_date,
    s.expiry_date,
    s.cancel_at_period_end,
    s.trial_end,
    CASE 
        WHEN s.expiry_date IS NOT NULL AND s.expiry_date <= CURRENT_DATE THEN 'expired'
        WHEN s.trial_end IS NOT NULL AND s.trial_end > CURRENT_DATE THEN 'trial'
        ELSE s.status
    END as effective_status
FROM advertiser_profiles ap
LEFT JOIN subscription_plans sp ON ap.subscription_plan = sp.name
LEFT JOIN LATERAL (
    SELECT * FROM subscriptions 
    WHERE user_id = ap.id 
      AND status = 'active'
    ORDER BY created_at DESC 
    LIMIT 1
) s ON true;

COMMENT ON VIEW user_subscription_details IS 'Unified view of user subscription information combining advertiser_profiles and subscriptions tables'; 