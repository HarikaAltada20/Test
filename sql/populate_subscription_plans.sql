-- Populate subscription_plans table with sample plans
-- This matches your existing subscription system architecture

INSERT INTO subscription_plans (name, price, json_features, stripe_price_id, razorpay_plan_id) 
VALUES 
(
  'free',
  0,
  '{
    "maxActiveContests": 1,
    "minContestBudget": 10000,
    "maxWinnersPerContest": 1,
    "commissionPercentage": 15,
    "contestTypes": ["content_creation"],
    "analytics": "basic",
    "support": "community",
    "description": "Perfect for getting started with contests"
  }'::jsonb,
  NULL,
  NULL
),
(
  'basic',
  2999,
  '{
    "maxActiveContests": 3,
    "minContestBudget": 5000,
    "maxWinnersPerContest": 3,
    "commissionPercentage": 10,
    "contestTypes": ["content_creation", "influencer_marketing"],
    "analytics": "standard",
    "support": "email",
    "description": "Great for small businesses running regular contests"
  }'::jsonb,
  'price_1234567890', -- Replace with actual Stripe price ID
  'plan_basic_monthly'  -- Replace with actual Razorpay plan ID
),
(
  'premium',
  9999,
  '{
    "maxActiveContests": 10,
    "minContestBudget": 2500,
    "maxWinnersPerContest": 5,
    "commissionPercentage": 8,
    "contestTypes": ["content_creation", "influencer_marketing", "brand_partnerships"],
    "analytics": "advanced",
    "support": "priority",
    "description": "Perfect for agencies and growing brands"
  }'::jsonb,
  'price_0987654321', -- Replace with actual Stripe price ID
  'plan_premium_monthly'  -- Replace with actual Razorpay plan ID
),
(
  'enterprise',
  24999,
  '{
    "maxActiveContests": 50,
    "minContestBudget": 1000,
    "maxWinnersPerContest": 10,
    "commissionPercentage": 5,
    "contestTypes": ["content_creation", "influencer_marketing", "brand_partnerships", "custom_campaigns"],
    "analytics": "enterprise",
    "support": "dedicated",
    "description": "For large enterprises with high-volume contest needs"
  }'::jsonb,
  'price_enterprise_123', -- Replace with actual Stripe price ID
  'plan_enterprise_monthly'  -- Replace with actual Razorpay plan ID
)
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  json_features = EXCLUDED.json_features,
  stripe_price_id = EXCLUDED.stripe_price_id,
  razorpay_plan_id = EXCLUDED.razorpay_plan_id;

-- Ensure all existing users have valid subscription plans
UPDATE advertiser_profiles 
SET subscription_plan = 'free' 
WHERE subscription_plan IS NULL 
   OR subscription_plan NOT IN (SELECT name FROM subscription_plans); 