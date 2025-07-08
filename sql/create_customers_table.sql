-- Create customers table for Stripe customer management
-- This table handles Stripe customer IDs for all user types (advertisers, creators)

CREATE TABLE IF NOT EXISTS customers (
  id UUID NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_stripe_customer_id 
ON customers(stripe_customer_id);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own customer record" ON customers
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own customer record" ON customers  
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role can manage all customer records" ON customers
  FOR ALL USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE customers IS 'Stripe customer information for all user types';
COMMENT ON COLUMN customers.stripe_customer_id IS 'Stripe customer ID for billing and payments';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON customers TO authenticated;
GRANT ALL ON customers TO service_role; 