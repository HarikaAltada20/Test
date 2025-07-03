-- Add payment_method column to money_transactions table
-- This will help track how each payment was made for better clarity

ALTER TABLE money_transactions 
ADD COLUMN payment_method VARCHAR(20) DEFAULT NULL;

-- Add comment to explain the column values
COMMENT ON COLUMN money_transactions.payment_method IS 'Payment method used: wallet, stripe, split, or refund';

-- Create an index for faster filtering by payment method
CREATE INDEX idx_money_transactions_payment_method ON money_transactions(payment_method);

-- Update existing records to set payment_method based on transaction type and description
UPDATE money_transactions 
SET payment_method = CASE 
    WHEN type = 'refund' THEN 'refund'
    WHEN type = 'deposit' THEN 'stripe'
    WHEN type = 'contest_payment' AND description LIKE '%wallet%' THEN 'wallet'
    WHEN type = 'contest_payment' AND description LIKE '%split%' THEN 'split'
    WHEN type = 'contest_payment' AND payment_intent_id IS NOT NULL THEN 'stripe'
    WHEN type = 'contest_payment' AND payment_intent_id IS NULL THEN 'wallet'
    ELSE NULL
END;

SELECT 'Payment method column added to money_transactions table successfully!' as message; 