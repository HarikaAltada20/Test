-- Minimal script to add subscription payment support to existing money_transactions table
-- Only adds metadata column and new transaction types

-- 1. Add metadata column for flexible JSON storage
ALTER TABLE money_transactions 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 2. Update type constraint to include subscription_payment and subscription_refund
ALTER TABLE money_transactions DROP CONSTRAINT IF EXISTS money_transactions_type_check;

ALTER TABLE money_transactions ADD CONSTRAINT money_transactions_type_check 
CHECK (type = ANY (ARRAY[
  'withdrawal'::text,
  'reward'::text,
  'deposit'::text,
  'contest_payment'::text,
  'refund'::text,
  'subscription_payment'::text,
  'subscription_refund'::text
]));

-- 3. Add index for metadata queries
CREATE INDEX IF NOT EXISTS idx_money_transactions_metadata 
ON money_transactions USING GIN (metadata);

-- Success message
SELECT 'Subscription payment support added to money_transactions table successfully!' as message;