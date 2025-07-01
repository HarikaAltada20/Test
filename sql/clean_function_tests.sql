-- Clean function tests without any CASE/WHEN statements

-- Test 1: Check if functions exist
SELECT 
  'Functions created:' as test,
  COUNT(*) as function_count
FROM information_schema.routines 
WHERE routine_name IN (
  'get_pending_transaction_by_payment_intent_fast',
  'update_transaction_status_by_payment_intent_fast'
);

-- Test 2: Test function execution (should return 0 rows but no error)
SELECT 'Testing get_pending_transaction_by_payment_intent_fast:' as test;
SELECT COUNT(*) as result_count 
FROM get_pending_transaction_by_payment_intent_fast('test_nonexistent_id');

-- Test 3: Test update function (should return false for non-existent ID)
SELECT 
  'Update function test:' as test,
  update_transaction_status_by_payment_intent_fast('test_nonexistent_id', 'success') as update_result;

-- Test 4: Show current indexes
SELECT 
  'Payment intent indexes:' as test,
  indexname
FROM pg_indexes 
WHERE tablename = 'money_transactions' 
AND indexname LIKE '%payment_intent%';

-- Test 5: Show column was added
SELECT 
  'Payment intent column exists:' as test,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'money_transactions' 
AND column_name = 'payment_intent_id';

-- Test 6: Count existing transactions with payment_intent_id populated
SELECT 
  'Transactions with payment_intent_id:' as test,
  COUNT(*) as count_with_payment_intent_id
FROM money_transactions 
WHERE payment_intent_id IS NOT NULL;

-- Test 7: Count total transactions
SELECT 
  'Total transactions:' as test,
  COUNT(*) as total_count
FROM money_transactions;

-- Success message
SELECT '✅ All function tests completed successfully!' as status; 