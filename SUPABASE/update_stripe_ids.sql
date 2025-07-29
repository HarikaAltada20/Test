-- Update Stripe Product and Price IDs in Supabase Database
-- This script deletes existing data and inserts new data with updated IDs

-- First, delete all existing data from both tables
DELETE FROM "public"."prices";
DELETE FROM "public"."products";

-- Reset sequences if they exist (optional, but good practice)
-- ALTER SEQUENCE IF EXISTS "public"."prices_id_seq" RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS "public"."products_id_seq" RESTART WITH 1;

-- Insert new products with updated IDs
INSERT INTO "public"."products" ("id", "active", "name", "description", "display_name", "plan_features", "created", "updated") VALUES 
('prod_Slij7SgNUxACLp', 'true', 'EXPLORER', 'Entry-level users, startups, or small businesses wanting to test the platform', 'Explorer Plan', '{"support":"basic","analytics":"basic","description":"Entry-level users, startups, or small businesses wanting to test the platform","contestTypes":["leaderboard"],"minContestBudget":10000,"maxActiveContests":1,"commissionPercentage":50,"maxWinnersPerContest":3}', '2025-07-08 19:35:56.034633+00', '2025-07-08 19:35:56.034633+00'),
('prod_SlilUeFqolEC7W', 'true', 'STARTER', 'Small to medium-sized businesses that want to run more contests and grow their presence', 'Starter Plan', '{"support":"basic","analytics":"basic","description":"Small to medium-sized businesses that want to run more contests and grow their presence","contestTypes":["leaderboard","cpm"],"minContestBudget":10000,"maxActiveContests":5,"commissionPercentage":20,"maxWinnersPerContest":10}', '2025-07-08 19:35:56.034633+00', '2025-07-08 19:35:56.034633+00'),
('prod_Slinc7mb1e30Ef', 'true', 'BUILDER', 'Medium to large brands scaling their presence and want more contests and flexibility', 'Builder Plan', '{"support":"priority","analytics":"advanced","description":"Medium to large brands scaling their presence and want more contests and flexibility","contestTypes":["leaderboard","cpm"],"minContestBudget":7500,"maxActiveContests":15,"commissionPercentage":12,"maxWinnersPerContest":25}', '2025-07-08 19:35:56.034633+00', '2025-07-08 19:35:56.034633+00'),
('prod_SlioxThbvGeLga', 'true', 'CHAMPION', 'Large businesses, agencies, and enterprises looking to run high-volume campaigns with premium support', 'Champion Plan', '{"support":"premium","analytics":"comprehensive","description":"Large businesses, agencies, and enterprises looking to run high-volume campaigns with premium support","contestTypes":["leaderboard","cpm"],"minContestBudget":5000,"maxActiveContests":50,"commissionPercentage":10,"maxWinnersPerContest":50}', '2025-07-08 19:35:56.034633+00', '2025-07-08 19:35:56.034633+00');

-- Insert new prices with updated IDs
INSERT INTO "public"."prices" ("id", "product_id", "active", "unit_amount", "currency", "type", "interval", "interval_count", "trial_period_days", "billing_scheme", "description", "created", "updated") VALUES 
-- Explorer Plan (Free) - Monthly only
('price_1RqBIUDCKN2LN0Qe2c097HHM', 'prod_Slij7SgNUxACLp', 'true', '0', 'usd', 'recurring', 'month', '1', '0', 'per_unit', 'Free monthly access', '2025-07-08 19:35:56.034633+00', '2025-07-08 19:35:56.034633+00'),

-- Starter Plan - Monthly and Yearly
('price_1RqBK8DCKN2LN0QeVe68F0Ec', 'prod_SlilUeFqolEC7W', 'true', '10000', 'usd', 'recurring', 'month', '1', '0', 'per_unit', 'Monthly billing', '2025-07-08 19:35:56.034633+00', '2025-07-08 19:35:56.034633+00'),
('price_1RqBKXDCKN2LN0Qe81Nq90bP', 'prod_SlilUeFqolEC7W', 'true', '100000', 'usd', 'recurring', 'year', '1', '0', 'per_unit', 'Annual billing - Save $200', '2025-07-08 19:35:56.034633+00', '2025-07-08 19:35:56.034633+00'),

-- Builder Plan - Monthly and Yearly
('price_1RqBLcDCKN2LN0QendahSoUJ', 'prod_Slinc7mb1e30Ef', 'true', '25000', 'usd', 'recurring', 'month', '1', '0', 'per_unit', 'Monthly billing', '2025-07-08 19:35:56.034633+00', '2025-07-08 19:35:56.034633+00'),
('price_1RqBLcDCKN2LN0QeoHdipPyN', 'prod_Slinc7mb1e30Ef', 'true', '250000', 'usd', 'recurring', 'year', '1', '0', 'per_unit', 'Annual billing - Save $500', '2025-07-08 19:35:56.034633+00', '2025-07-08 19:35:56.034633+00'),

-- Champion Plan - Monthly and Yearly
('price_1RqBMjDCKN2LN0QenUgKtYgD', 'prod_SlioxThbvGeLga', 'true', '50000', 'usd', 'recurring', 'month', '1', '0', 'per_unit', 'Monthly billing', '2025-07-08 19:35:56.034633+00', '2025-07-08 19:35:56.034633+00'),
('price_1RqBMjDCKN2LN0QeFgcfIR2I', 'prod_SlioxThbvGeLga', 'true', '500000', 'usd', 'recurring', 'year', '1', '0', 'per_unit', 'Annual billing - Save $1000', '2025-07-08 19:35:56.034633+00', '2025-07-08 19:35:56.034633+00');

-- Verify the data was inserted correctly
SELECT 'Products count:' as info, COUNT(*) as count FROM "public"."products"
UNION ALL
SELECT 'Prices count:' as info, COUNT(*) as count FROM "public"."prices";