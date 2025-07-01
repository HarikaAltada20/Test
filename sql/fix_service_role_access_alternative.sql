-- Alternative fix for service role access using SECURITY DEFINER functions
-- This bypasses RLS without modifying the reserved service_role

-- Grant direct table access to service_role (this should work)
GRANT ALL PRIVILEGES ON TABLE money_transactions TO service_role;

-- Create helper functions that run with elevated privileges (SECURITY DEFINER)
-- These functions run as the creator (admin) regardless of who calls them

-- Function to get pending transaction by payment intent
CREATE OR REPLACE FUNCTION get_pending_transaction_by_payment_intent(payment_intent_id text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  type text,
  status text,
  amount integer,
  description text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER  -- This is key - runs with admin privileges
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mt.id,
    mt.user_id,
    mt.type,
    mt.status,
    mt.amount,
    mt.description,
    mt.created_at,
    mt.updated_at
  FROM money_transactions mt
  WHERE mt.status = 'pending'
  AND mt.description ILIKE '%' || payment_intent_id || '%'
  ORDER BY mt.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to update transaction status by payment intent
CREATE OR REPLACE FUNCTION update_transaction_status_by_payment_intent(
  payment_intent_id text,
  new_status text,
  new_description text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- This is key - runs with admin privileges
AS $$
DECLARE
  transaction_record RECORD;
  rows_updated INTEGER;
BEGIN
  -- Find the transaction
  SELECT id INTO transaction_record
  FROM money_transactions
  WHERE status = 'pending'
  AND description ILIKE '%' || payment_intent_id || '%'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if transaction found
  IF transaction_record.id IS NULL THEN
    RETURN false;
  END IF;

  -- Update the transaction
  UPDATE money_transactions
  SET 
    status = new_status,
    updated_at = NOW(),
    description = COALESCE(new_description, description)
  WHERE id = transaction_record.id;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  RETURN rows_updated > 0;
END;
$$;

-- Function to get transaction count (for testing)
CREATE OR REPLACE FUNCTION get_total_transactions_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count integer;
BEGIN
  SELECT COUNT(*) INTO total_count FROM money_transactions;
  RETURN total_count;
END;
$$;

-- Grant execute permissions on functions to service_role
GRANT EXECUTE ON FUNCTION get_pending_transaction_by_payment_intent(text) TO service_role;
GRANT EXECUTE ON FUNCTION update_transaction_status_by_payment_intent(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION get_total_transactions_count() TO service_role;

-- Test the functions work
SELECT 'Function test results:' as test_type;

SELECT 
  'Total transactions via function:' as test,
  get_total_transactions_count() as count;

SELECT 
  'Functions available:' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'get_pending_transaction_by_payment_intent'
    ) THEN 'YES - Helper functions created'
    ELSE 'NO - Functions missing'
  END as status;

-- Show recent transactions to verify function access
SELECT 
  'Recent transactions via function:' as test,
  COUNT(*) as recent_count
FROM get_pending_transaction_by_payment_intent('test') -- This will return 0 but tests access

UNION ALL

SELECT 
  'Direct table access test:' as test,
  COUNT(*) as total_count
FROM money_transactions;

DO $$
BEGIN
  RAISE NOTICE '✅ Alternative service role fix applied:';
  RAISE NOTICE '   • SECURITY DEFINER functions created';
  RAISE NOTICE '   • Functions run with admin privileges (bypass RLS)';
  RAISE NOTICE '   • Service role granted execute permissions';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Available functions for webhooks:';
  RAISE NOTICE '   • get_pending_transaction_by_payment_intent(payment_intent_id)';
  RAISE NOTICE '   • update_transaction_status_by_payment_intent(payment_intent_id, status, description)';
  RAISE NOTICE '   • get_total_transactions_count()';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next: Update webhook code to use these functions!';
END $$; 