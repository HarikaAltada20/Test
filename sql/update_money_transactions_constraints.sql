-- Update money_transactions table constraints to include all transaction types used in the application

-- Drop existing constraints
ALTER TABLE money_transactions DROP CONSTRAINT IF EXISTS money_transactions_type_check;
ALTER TABLE money_transactions DROP CONSTRAINT IF EXISTS money_transactions_status_check;

-- Add updated constraints with all required types
ALTER TABLE money_transactions ADD CONSTRAINT money_transactions_type_check 
CHECK (type = ANY (ARRAY['deposit'::text, 'contest_payment'::text, 'refund'::text, 'withdrawal'::text, 'reward'::text]));

ALTER TABLE money_transactions ADD CONSTRAINT money_transactions_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'cancelled'::text]));

-- Ensure currency column exists
ALTER TABLE money_transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Ensure withdrawal_request_id column exists
ALTER TABLE money_transactions ADD COLUMN IF NOT EXISTS withdrawal_request_id UUID REFERENCES withdrawal_requests(id) ON DELETE SET NULL;

-- Add comment to document the cent storage
COMMENT ON COLUMN money_transactions.amount IS 'Amount stored in cents for consistency across the system'; 