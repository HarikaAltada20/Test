-- Add remarks column to money_transactions table for user-friendly messages
-- Run this in Supabase SQL Editor

-- Add the remarks column
ALTER TABLE money_transactions 
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Add index for performance when filtering by remarks
CREATE INDEX IF NOT EXISTS idx_money_transactions_remarks 
ON money_transactions(remarks) 
WHERE remarks IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN money_transactions.remarks IS 'User-friendly message explaining transaction status and context';

-- Update the existing database function to handle remarks
CREATE OR REPLACE FUNCTION update_transaction_status_by_payment_intent_fast(
  p_payment_intent_id text,
  p_new_status text,
  p_new_description text DEFAULT NULL,
  p_remarks text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  -- Direct update using indexed column
  UPDATE money_transactions
  SET 
    status = p_new_status,
    updated_at = NOW(),
    description = COALESCE(p_new_description, description),
    remarks = COALESCE(p_remarks, remarks)
  WHERE payment_intent_id = p_payment_intent_id
  AND status = 'pending';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  RETURN rows_updated > 0;
END;
$$;

-- Grant permissions on updated function
GRANT EXECUTE ON FUNCTION update_transaction_status_by_payment_intent_fast(text, text, text, text) TO service_role; 