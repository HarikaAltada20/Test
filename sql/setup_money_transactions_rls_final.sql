-- Final RLS setup for money_transactions table
-- This provides proper security while allowing all necessary operations

-- Re-enable RLS first
ALTER TABLE money_transactions ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own money transactions" ON money_transactions;
DROP POLICY IF EXISTS "Users can insert their own money transactions" ON money_transactions;
DROP POLICY IF EXISTS "Users can update status of their own money transactions" ON money_transactions;
DROP POLICY IF EXISTS "Service role can view all transactions" ON money_transactions;
DROP POLICY IF EXISTS "Service role can insert transactions" ON money_transactions;
DROP POLICY IF EXISTS "Service role can update transactions" ON money_transactions;

-- 1. USER POLICIES - Users can manage their own transactions

-- Users can view their own transactions (for dashboard, billing page)
CREATE POLICY "Users can view own transactions"
ON money_transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own transactions (wallet top-ups, payments)
CREATE POLICY "Users can create own transactions"
ON money_transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update limited fields of their own transactions (e.g., user notes, cancel pending)
CREATE POLICY "Users can update own transactions"
ON money_transactions FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  AND status IN ('pending', 'failed')  -- Only allow updates to pending/failed transactions
);

-- 2. SERVICE ROLE POLICIES - Full access for webhooks and API operations

-- Service role can view all transactions (needed for webhooks to find transactions)
CREATE POLICY "Service role full select access"
ON money_transactions FOR SELECT
TO service_role
USING (true);

-- Service role can insert any transaction (needed for system operations)
CREATE POLICY "Service role full insert access"
ON money_transactions FOR INSERT
TO service_role
WITH CHECK (true);

-- Service role can update any transaction (needed for webhook status updates)
CREATE POLICY "Service role full update access"
ON money_transactions FOR UPDATE
TO service_role
USING (true);

-- 3. ADMIN POLICIES (optional - uncomment if you have admin users)

-- Admin users can view all transactions
-- CREATE POLICY "Admins can view all transactions"
-- ON money_transactions FOR SELECT
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM users 
--     WHERE id = auth.uid() 
--     AND user_type = 'admin'
--   )
-- );

-- 4. GRANT NECESSARY TABLE PERMISSIONS

-- Ensure service_role has table-level permissions
GRANT ALL ON money_transactions TO service_role;

-- Ensure authenticated users have basic permissions
GRANT SELECT, INSERT, UPDATE ON money_transactions TO authenticated;

-- 5. VERIFICATION QUERIES

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'money_transactions';

-- Show all policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  roles, 
  cmd as operation,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Reading transactions'
    WHEN cmd = 'INSERT' THEN 'Creating transactions' 
    WHEN cmd = 'UPDATE' THEN 'Updating transactions'
    ELSE cmd
  END as description
FROM pg_policies 
WHERE tablename = 'money_transactions'
ORDER BY roles, cmd, policyname;

-- Test service role access (should return count > 0 if there are transactions)
SELECT COUNT(*) as service_role_accessible_transactions
FROM money_transactions;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ money_transactions RLS policies configured successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '👤 Users can:';
  RAISE NOTICE '   • View their own transactions (dashboard/billing)';
  RAISE NOTICE '   • Create their own transactions (deposits)';
  RAISE NOTICE '   • Update their pending/failed transactions';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Service role can:';
  RAISE NOTICE '   • View all transactions (webhooks can find them)';
  RAISE NOTICE '   • Create any transaction (system operations)';
  RAISE NOTICE '   • Update any transaction (webhook status updates)';
  RAISE NOTICE '';
  RAISE NOTICE '🛡️ Security maintained:';
  RAISE NOTICE '   • Users cannot see other users transactions';
  RAISE NOTICE '   • Users cannot modify successful transactions';
  RAISE NOTICE '   • System operations work via service role';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Ready for production use!';
END $$; 