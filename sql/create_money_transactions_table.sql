-- Create money_transactions table for payment logging
CREATE TABLE IF NOT EXISTS money_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'contest_payment', 'refund', 'withdrawal', 'reward')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  amount INTEGER NOT NULL, -- Amount stored in cents
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  currency TEXT DEFAULT 'USD',
  withdrawal_request_id UUID REFERENCES withdrawal_requests(id) ON DELETE SET NULL
);

-- Create index for performance
CREATE INDEX idx_money_transactions_user_id ON money_transactions(user_id);
CREATE INDEX idx_money_transactions_status ON money_transactions(status);
CREATE INDEX idx_money_transactions_type ON money_transactions(type);

-- Enable RLS (Row Level Security)
ALTER TABLE money_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Allow users to view their own transactions
CREATE POLICY "Users can view their own transactions"
  ON money_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Allow service role to view all transactions (needed for webhooks)
CREATE POLICY "Service role can view all transactions"
  ON money_transactions FOR SELECT
  USING (auth.role() = 'service_role');

-- Allow service role to insert transactions
CREATE POLICY "Service role can insert transactions"
  ON money_transactions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Allow service role to update transactions (needed for webhooks)
CREATE POLICY "Service role can update transactions"
  ON money_transactions FOR UPDATE
  USING (auth.role() = 'service_role'); 