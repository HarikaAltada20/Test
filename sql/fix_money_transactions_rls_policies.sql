-- Fix RLS policies for money_transactions table to allow webhook access
-- Run this script in your Supabase SQL Editor

-- First, let's see current policies (optional - for reference)
-- SELECT schemaname, tablename, policyname, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'money_transactions';

-- Drop existing service role policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Service role can view all transactions" ON money_transactions;
DROP POLICY IF EXISTS "Service role can insert transactions" ON money_transactions;
DROP POLICY IF EXISTS "Service role can update transactions" ON money_transactions;

-- Create new service role policies for webhooks

-- 1. Allow service role to SELECT all transactions (webhooks need to find pending transactions)
CREATE POLICY "Service role can view all transactions" 
ON money_transactions FOR SELECT 
TO service_role 
USING (true);

-- 2. Allow service role to INSERT transactions (deposit endpoint needs this)
CREATE POLICY "Service role can insert transactions" 
ON money_transactions FOR INSERT 
TO service_role 
WITH CHECK (true);

-- 3. Allow service role to UPDATE transactions (webhooks need to update status)
CREATE POLICY "Service role can update transactions" 
ON money_transactions FOR UPDATE 
TO service_role 
USING (true);

-- Verify the policies were created
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    roles, 
    cmd as operation,
    CASE 
        WHEN cmd = 'SELECT' THEN 'Allows reading transactions'
        WHEN cmd = 'INSERT' THEN 'Allows creating transactions' 
        WHEN cmd = 'UPDATE' THEN 'Allows updating transaction status'
        ELSE cmd
    END as description
FROM pg_policies 
WHERE tablename = 'money_transactions'
ORDER BY cmd, policyname;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies for money_transactions have been updated!';
    RAISE NOTICE '🔧 Service role can now:';
    RAISE NOTICE '   • SELECT transactions (webhooks can find them)';
    RAISE NOTICE '   • INSERT transactions (deposit endpoint works)';
    RAISE NOTICE '   • UPDATE transactions (webhooks can update status)';
    RAISE NOTICE '🎉 Your payment webhooks should now work correctly!';
END $$; 