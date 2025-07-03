-- Add payment_details column to contests table
-- This will store comprehensive payment information as JSONB

ALTER TABLE contests 
ADD COLUMN payment_details JSONB DEFAULT NULL;

-- Add comment to explain the column structure
COMMENT ON COLUMN contests.payment_details IS 'Stores payment information in JSONB format: {
  "total_prize_pool": 10000,         // cents (original budget/prize pool)
  "commission_amount": 1000,         // cents  
  "total_amount_paid": 11000,        // cents (prize pool + commission)
  "commission_percentage": 10.0,     // decimal
  "wallet_amount_used": 5000,        // cents
  "stripe_amount_paid": 6000,        // cents
  "payment_intent_id": "pi_xxx",     // string
  "payment_status": "completed",     // pending/completed/failed
  "paid_at": "2024-01-15T10:30:00Z" // timestamp
}';

SELECT 'Payment details column added to contests table successfully!' as message; 