-- Update subscription plans to new pricing structure
-- This script updates the existing plans and removes the extra ones

-- Update FREE plan to EXPLORER plan
UPDATE "public"."subscription_plans" 
SET 
    "name" = 'EXPLORER',
    "price" = '0',
    "json_features" = '{"maxActiveContests": 1, "minContestBudget": 10000, "maxWinnersPerContest": 3, "commissionPercentage": 50, "contestTypes": ["leaderboard"], "analytics": "basic", "support": "basic", "description": "Entry-level users, startups, or small businesses wanting to test the platform"}'
WHERE "id" = 'a28ef5c0-3391-44a1-a9ef-f9b999ff0198';

-- Update BRONZE plan to STARTER plan
UPDATE "public"."subscription_plans" 
SET 
    "name" = 'STARTER',
    "price" = '10000',
    "json_features" = '{"maxActiveContests": 5, "minContestBudget": 10000, "maxWinnersPerContest": 10, "commissionPercentage": 20, "contestTypes": ["leaderboard", "cpm"], "analytics": "basic", "support": "basic", "description": "Small to medium-sized businesses that want to run more contests and grow their presence"}'
WHERE "id" = '0477016e-7751-4049-bc57-19012004a05b';

-- Update SILVER plan to BUILDER plan
UPDATE "public"."subscription_plans" 
SET 
    "name" = 'BUILDER',
    "price" = '25000',
    "json_features" = '{"maxActiveContests": 15, "minContestBudget": 7500, "maxWinnersPerContest": 25, "commissionPercentage": 12, "contestTypes": ["leaderboard", "cpm"], "analytics": "advanced", "support": "priority", "description": "Medium to large brands scaling their presence and want more contests and flexibility"}'
WHERE "id" = '4107627f-4ccb-4f1e-ad1a-fdc723e6a5ef';

-- Update GOLD plan to CHAMPION plan
UPDATE "public"."subscription_plans" 
SET 
    "name" = 'CHAMPION',
    "price" = '50000',
    "json_features" = '{"maxActiveContests": 50, "minContestBudget": 5000, "maxWinnersPerContest": 50, "commissionPercentage": 10, "contestTypes": ["leaderboard", "cpm"], "analytics": "comprehensive", "support": "premium", "description": "Large businesses, agencies, and enterprises looking to run high-volume campaigns with premium support"}'
WHERE "id" = '0f094792-1ef6-4334-b169-f98d21ca0fbd';

-- Remove PLATINUM plan (no longer needed)
DELETE FROM "public"."subscription_plans" 
WHERE "id" = 'f7630717-5578-4988-922f-255ca4c985c4';

-- Remove DIAMOND plan (no longer needed)
DELETE FROM "public"."subscription_plans" 
WHERE "id" = '79a96d6b-ba5c-453c-bbca-49937ba05ad6';

-- Update any advertiser profiles that were using the deleted plans to use CHAMPION plan instead
UPDATE "public"."advertiser_profiles" 
SET "subscription_plan" = '0f094792-1ef6-4334-b169-f98d21ca0fbd' 
WHERE "subscription_plan" IN ('f7630717-5578-4988-922f-255ca4c985c4', '79a96d6b-ba5c-453c-bbca-49937ba05ad6');

-- Verify the updates
SELECT "id", "name", "price", "json_features" 
FROM "public"."subscription_plans" 
ORDER BY "price" ASC; 