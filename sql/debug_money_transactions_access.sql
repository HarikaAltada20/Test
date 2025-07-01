-- Debug script to test service role access to money_transactions
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check current RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'money_transactions';

-- 2. Check all current policies
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'money_transactions'
ORDER BY cmd, policyname;

-- 3. Check table permissions for service_role
SELECT grantee, privilege_type
FROM information_schema.role_table_grants 
WHERE table_name = 'money_transactions' 
AND grantee = 'service_role';

-- 4. Count total transactions (should work regardless of RLS)
SELECT COUNT(*) as total_transactions 
FROM money_transactions;

-- 5. Count recent transactions 
SELECT COUNT(*) as recent_transactions 
FROM money_transactions 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 6. Show recent transactions (may be blocked by RLS)
SELECT id, type, status, amount, description, created_at 
FROM money_transactions 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;

-- TEMPORARY FIX: Disable RLS to test webhook
-- WARNING: This removes security temporarily - only for testing!
-- ALTER TABLE money_transactions DISABLE ROW LEVEL SECURITY;

-- To re-enable RLS later:
-- ALTER TABLE money_transactions ENABLE ROW LEVEL SECURITY;

-- Alternative fix: Grant service_role bypass RLS permission
-- GRANT ALL ON money_transactions TO service_role;
-- ALTER TABLE money_transactions FORCE ROW LEVEL SECURITY; 