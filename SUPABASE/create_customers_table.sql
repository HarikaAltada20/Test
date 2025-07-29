-- Create customers table to store Stripe customer IDs
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_stripe_customer_id ON public.customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(id);

-- Add RLS policies
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Users can only see their own customer record
CREATE POLICY "Users can view own customer record" ON public.customers
    FOR SELECT USING (auth.uid() = id);

-- Users can insert their own customer record
CREATE POLICY "Users can insert own customer record" ON public.customers
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own customer record
CREATE POLICY "Users can update own customer record" ON public.customers
    FOR UPDATE USING (auth.uid() = id);

-- Grant permissions
GRANT ALL ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;