-- Comprehensive Subscription System Database Schema Upgrade
-- This script adds all necessary fields and functions for the subscription system

-- Step 1: Update advertiser_profiles table to support subscription system
ALTER TABLE public.advertiser_profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS current_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_start_date DATE,
ADD COLUMN IF NOT EXISTS subscription_end_date DATE,
ADD COLUMN IF NOT EXISTS is_subscription_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pending_plan_id TEXT,
ADD COLUMN IF NOT EXISTS scheduled_upgrade_at DATE,
ADD COLUMN IF NOT EXISTS is_scheduled_upgrade BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_subscription_update TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Step 2: Create subscription_payments table for historical tracking
CREATE TABLE IF NOT EXISTS public.subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subscription_id TEXT NOT NULL, -- Stripe subscription ID
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    stripe_invoice_id TEXT,
    stripe_payment_intent_id TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_stripe_customer_id 
ON public.advertiser_profiles(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_subscription_status 
ON public.advertiser_profiles(is_subscription_active, subscription_end_date);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_user_id 
ON public.subscription_payments(user_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id 
ON public.subscription_payments(subscription_id);

-- Step 4: Enable RLS on new table
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for subscription_payments
CREATE POLICY "Users can view their own subscription payments"
ON public.subscription_payments FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role can manage subscription payments"
ON public.subscription_payments FOR ALL
TO service_role
USING (true);

-- Step 6: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO service_role;

-- Step 7: Create function to get user's current subscription details
CREATE OR REPLACE FUNCTION get_user_subscription_details(user_uuid UUID)
RETURNS TABLE (
    plan_id TEXT,
    plan_name TEXT,
    plan_price INTEGER,
    plan_features JSONB,
    is_active BOOLEAN,
    subscription_end_date DATE,
    pending_plan_id TEXT,
    scheduled_upgrade_at DATE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ap.subscription_plan::TEXT as plan_id,
        sp.name as plan_name,
        sp.price::INTEGER as plan_price,
        sp.json_features as plan_features,
        COALESCE(ap.is_subscription_active, false) as is_active,
        ap.subscription_end_date,
        ap.pending_plan_id,
        ap.scheduled_upgrade_at
    FROM public.advertiser_profiles ap
    LEFT JOIN public.subscription_plans sp ON ap.subscription_plan = sp.id::TEXT
    WHERE ap.id = user_uuid;
END;
$$;

-- Step 8: Create function to update subscription status
CREATE OR REPLACE FUNCTION update_subscription_status(
    user_uuid UUID,
    new_plan_id TEXT DEFAULT NULL,
    new_subscription_id TEXT DEFAULT NULL,
    new_stripe_customer_id TEXT DEFAULT NULL,
    new_start_date DATE DEFAULT NULL,
    new_end_date DATE DEFAULT NULL,
    new_is_active BOOLEAN DEFAULT NULL,
    clear_pending_upgrade BOOLEAN DEFAULT false
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.advertiser_profiles 
    SET 
        subscription_plan = COALESCE(new_plan_id, subscription_plan),
        current_subscription_id = COALESCE(new_subscription_id, current_subscription_id),
        stripe_customer_id = COALESCE(new_stripe_customer_id, stripe_customer_id),
        subscription_start_date = COALESCE(new_start_date, subscription_start_date),
        subscription_end_date = COALESCE(new_end_date, subscription_end_date),
        is_subscription_active = COALESCE(new_is_active, is_subscription_active),
        pending_plan_id = CASE 
            WHEN clear_pending_upgrade THEN NULL 
            ELSE pending_plan_id 
        END,
        scheduled_upgrade_at = CASE 
            WHEN clear_pending_upgrade THEN NULL 
            ELSE scheduled_upgrade_at 
        END,
        is_scheduled_upgrade = CASE 
            WHEN clear_pending_upgrade THEN false 
            ELSE is_scheduled_upgrade 
        END,
        last_subscription_update = now()
    WHERE id = user_uuid;
    
    RETURN FOUND;
END;
$$;

-- Step 9: Create function to schedule subscription upgrade
CREATE OR REPLACE FUNCTION schedule_subscription_upgrade(
    user_uuid UUID,
    new_plan_id TEXT,
    upgrade_date DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.advertiser_profiles 
    SET 
        pending_plan_id = new_plan_id,
        scheduled_upgrade_at = upgrade_date,
        is_scheduled_upgrade = true,
        last_subscription_update = now()
    WHERE id = user_uuid;
    
    RETURN FOUND;
END;
$$;

-- Step 10: Create function to apply scheduled upgrades
CREATE OR REPLACE FUNCTION apply_scheduled_upgrades()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    upgrade_count INTEGER := 0;
BEGIN
    -- Apply upgrades that are due
    UPDATE public.advertiser_profiles 
    SET 
        subscription_plan = pending_plan_id,
        subscription_start_date = scheduled_upgrade_at,
        subscription_end_date = scheduled_upgrade_at + INTERVAL '1 month',
        pending_plan_id = NULL,
        scheduled_upgrade_at = NULL,
        is_scheduled_upgrade = false,
        last_subscription_update = now()
    WHERE pending_plan_id IS NOT NULL 
      AND scheduled_upgrade_at IS NOT NULL
      AND scheduled_upgrade_at <= CURRENT_DATE;
    
    GET DIAGNOSTICS upgrade_count = ROW_COUNT;
    
    RETURN upgrade_count;
END;
$$;

-- Step 11: Create trigger to automatically update last_subscription_update
CREATE OR REPLACE FUNCTION update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_subscription_update = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_advertiser_subscription_timestamp ON public.advertiser_profiles;
CREATE TRIGGER update_advertiser_subscription_timestamp
    BEFORE UPDATE ON public.advertiser_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_timestamp();

-- Step 12: Add comments for documentation
COMMENT ON COLUMN public.advertiser_profiles.stripe_customer_id IS 'Stripe customer ID for subscription management';
COMMENT ON COLUMN public.advertiser_profiles.current_subscription_id IS 'Current Stripe subscription ID';
COMMENT ON COLUMN public.advertiser_profiles.subscription_start_date IS 'Start date of current subscription period';
COMMENT ON COLUMN public.advertiser_profiles.subscription_end_date IS 'End date of current subscription period';
COMMENT ON COLUMN public.advertiser_profiles.is_subscription_active IS 'Whether the subscription is currently active';
COMMENT ON COLUMN public.advertiser_profiles.pending_plan_id IS 'Plan ID for scheduled upgrade';
COMMENT ON COLUMN public.advertiser_profiles.scheduled_upgrade_at IS 'Date when scheduled upgrade will be applied';
COMMENT ON COLUMN public.advertiser_profiles.is_scheduled_upgrade IS 'Whether user has a scheduled upgrade';

COMMENT ON TABLE public.subscription_payments IS 'Historical record of all subscription payments';
COMMENT ON FUNCTION get_user_subscription_details(UUID) IS 'Get complete subscription details for a user';
COMMENT ON FUNCTION update_subscription_status(UUID, TEXT, TEXT, TEXT, DATE, DATE, BOOLEAN, BOOLEAN) IS 'Update subscription status with flexible parameters';
COMMENT ON FUNCTION schedule_subscription_upgrade(UUID, TEXT, DATE) IS 'Schedule a subscription upgrade for future date';
COMMENT ON FUNCTION apply_scheduled_upgrades() IS 'Apply all scheduled upgrades that are due';

-- Step 13: Migrate existing data to set proper defaults
UPDATE public.advertiser_profiles 
SET 
    is_subscription_active = CASE 
        WHEN subscription_plan IS NULL OR subscription_plan = 'free' OR subscription_plan = 'a28ef5c0-3391-44a1-a9ef-f9b999ff0198' THEN false
        ELSE true
    END,
    subscription_start_date = CASE 
        WHEN subscription_plan IS NOT NULL AND subscription_plan != 'free' AND subscription_plan != 'a28ef5c0-3391-44a1-a9ef-f9b999ff0198' THEN created_at::DATE
        ELSE NULL
    END,
    subscription_end_date = CASE 
        WHEN subscription_plan IS NOT NULL AND subscription_plan != 'free' AND subscription_plan != 'a28ef5c0-3391-44a1-a9ef-f9b999ff0198' THEN (created_at + INTERVAL '1 month')::DATE
        ELSE NULL
    END,
    subscription_created_at = CASE 
        WHEN subscription_plan IS NOT NULL AND subscription_plan != 'free' AND subscription_plan != 'a28ef5c0-3391-44a1-a9ef-f9b999ff0198' THEN created_at
        ELSE NULL
    END
WHERE stripe_customer_id IS NULL;

-- Step 14: Create view for subscription management
CREATE OR REPLACE VIEW public.subscription_overview AS
SELECT 
    u.id,
    u.full_name,
    u.email,
    ap.subscription_plan,
    sp.name as plan_name,
    sp.price as plan_price_cents,
    sp.json_features as plan_features,
    ap.is_subscription_active,
    ap.subscription_start_date,
    ap.subscription_end_date,
    ap.pending_plan_id,
    ap.scheduled_upgrade_at,
    ap.is_scheduled_upgrade,
    ap.stripe_customer_id,
    ap.current_subscription_id,
    ap.last_subscription_update
FROM public.users u
JOIN public.advertiser_profiles ap ON u.id = ap.id
LEFT JOIN public.subscription_plans sp ON ap.subscription_plan = sp.id::TEXT
WHERE u.user_type = 'advertiser';

-- Grant permissions on the view
GRANT SELECT ON public.subscription_overview TO authenticated;
GRANT SELECT ON public.subscription_overview TO service_role;

-- Step 15: Create function to get subscription metrics
CREATE OR REPLACE FUNCTION get_subscription_metrics()
RETURNS TABLE (
    total_subscribers INTEGER,
    active_subscribers INTEGER,
    subscribers_by_plan JSONB,
    scheduled_upgrades INTEGER,
    monthly_revenue INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM public.advertiser_profiles WHERE subscription_plan IS NOT NULL) as total_subscribers,
        (SELECT COUNT(*)::INTEGER FROM public.advertiser_profiles WHERE is_subscription_active = true) as active_subscribers,
        (SELECT json_agg(json_build_object('plan_name', sp.name, 'subscriber_count', plan_counts.count))::JSONB
         FROM (
             SELECT subscription_plan, COUNT(*) as count
             FROM public.advertiser_profiles 
             WHERE is_subscription_active = true
             GROUP BY subscription_plan
         ) plan_counts
         JOIN public.subscription_plans sp ON plan_counts.subscription_plan = sp.id::TEXT
        ) as subscribers_by_plan,
        (SELECT COUNT(*)::INTEGER FROM public.advertiser_profiles WHERE is_scheduled_upgrade = true) as scheduled_upgrades,
        (SELECT COALESCE(SUM(sp.price), 0)::INTEGER 
         FROM public.advertiser_profiles ap
         JOIN public.subscription_plans sp ON ap.subscription_plan = sp.id::TEXT
         WHERE ap.is_subscription_active = true
        ) as monthly_revenue;
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_subscription_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_subscription_details(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION update_subscription_status(UUID, TEXT, TEXT, TEXT, DATE, DATE, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION schedule_subscription_upgrade(UUID, TEXT, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION apply_scheduled_upgrades() TO service_role;
GRANT EXECUTE ON FUNCTION get_subscription_metrics() TO service_role;

-- Final step: Verify the upgrade
SELECT 'Subscription system database upgrade completed successfully' as status; 