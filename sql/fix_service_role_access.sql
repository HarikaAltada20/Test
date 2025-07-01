-- Fix service role access to money_transactions
-- This ensures webhooks can always access the table

-- Method 1: Grant direct table access to service_role
GRANT ALL PRIVILEGES ON TABLE money_transactions TO service_role;

-- Method 2: Allow service_role to bypass RLS entirely
ALTER ROLE service_role BYPASSRLS;

-- Method 3: Alternative - create a function that runs with security definer
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
SECURITY DEFINER
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

-- Method 4: Create update function for webhooks
CREATE OR REPLACE FUNCTION update_transaction_status_by_payment_intent(
  payment_intent_id text,
  new_status text,
  new_description text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_pending_transaction_by_payment_intent(text) TO service_role;
GRANT EXECUTE ON FUNCTION update_transaction_status_by_payment_intent(text, text, text) TO service_role;

-- Test the fix
SELECT 
  'Service role bypass check:' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_roles 
      WHERE rolname = 'service_role' 
      AND rolbypassrls = true
    ) THEN 'ENABLED - Service role can bypass RLS'
    ELSE 'DISABLED - Service role still bound by RLS'
  END as status;

-- Test function access
SELECT 
  'Function test:' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'get_pending_transaction_by_payment_intent'
    ) THEN 'AVAILABLE - Functions created successfully'
    ELSE 'MISSING - Functions not created'
  END as status;

-- Show current transaction count (should work now)
SELECT COUNT(*) as total_transactions FROM money_transactions;

DO $$
BEGIN
  RAISE NOTICE '🔧 Service role access fixes applied:';
  RAISE NOTICE '   • Service role bypass RLS enabled';
  RAISE NOTICE '   • Direct table permissions granted';
  RAISE NOTICE '   • Helper functions created for webhooks';
  RAISE NOTICE '   • Functions have SECURITY DEFINER (admin privileges)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Webhooks can now use:';
  RAISE NOTICE '   • Direct table access (if bypass works)';
  RAISE NOTICE '   • get_pending_transaction_by_payment_intent() function';
  RAISE NOTICE '   • update_transaction_status_by_payment_intent() function';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Multiple fallback methods ensure webhook success!';
END $$; 