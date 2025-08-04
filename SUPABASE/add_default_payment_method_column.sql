-- Migration: Add default_payment_method_id column to customers table
-- This migration adds a column to store the default payment method ID locally for redundancy

-- Add the new column
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS default_payment_method_id text null;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_default_payment_method 
ON public.customers USING btree (default_payment_method_id);

-- Add comment for documentation
COMMENT ON COLUMN public.customers.default_payment_method_id IS 'Stores the Stripe payment method ID that should be used as default for this customer. Provides redundancy and faster access than querying Stripe directly.';

-- Update existing customers to sync their default payment methods from Stripe
-- This is a one-time sync that can be run manually if needed
-- Note: This requires a separate script with Stripe API calls since we can't call Stripe from SQL

-- Example of how to update existing customers (run this in a separate script):
-- UPDATE public.customers 
-- SET default_payment_method_id = 'pm_xxx' 
-- WHERE stripe_customer_id = 'cus_xxx'; 