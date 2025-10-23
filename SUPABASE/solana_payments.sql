-- =====================================================
-- Solana Payment System Schema
-- =====================================================
-- This schema handles Phantom Wallet USDC/USDT payments
-- for brand account top-ups via Solana blockchain
-- =====================================================

-- 1. Payment Requests Table
-- Stores payment requests generated for brands
CREATE TABLE IF NOT EXISTS public.solana_payment_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reference_id text NOT NULL UNIQUE,
    amount_requested bigint NOT NULL, -- Amount in cents
    token_type text NOT NULL CHECK (token_type IN ('USDC', 'USDT')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
    memo text NOT NULL,
    wallet_address text NOT NULL, -- Our Phantom wallet address for receiving
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- 2. Solana Transactions Table
-- Stores verified transactions from Solana blockchain
CREATE TABLE IF NOT EXISTS public.solana_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    payment_request_id uuid REFERENCES solana_payment_requests(id) ON DELETE SET NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_signature text NOT NULL UNIQUE,
    amount_received bigint NOT NULL, -- Actual amount received in cents
    token_type text NOT NULL CHECK (token_type IN ('USDC', 'USDT')),
    token_mint_address text NOT NULL,
    from_wallet text NOT NULL, -- Sender's wallet address
    to_wallet text NOT NULL, -- Our wallet address
    memo text,
    block_time timestamp with time zone,
    slot bigint,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'finalized', 'failed')),
    verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'invalid')),
    balance_updated boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_solana_payment_requests_user_id 
    ON public.solana_payment_requests(user_id);
    
CREATE INDEX IF NOT EXISTS idx_solana_payment_requests_reference_id 
    ON public.solana_payment_requests(reference_id);
    
CREATE INDEX IF NOT EXISTS idx_solana_payment_requests_status 
    ON public.solana_payment_requests(status);
    
CREATE INDEX IF NOT EXISTS idx_solana_payment_requests_expires_at 
    ON public.solana_payment_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_solana_transactions_user_id 
    ON public.solana_transactions(user_id);
    
CREATE INDEX IF NOT EXISTS idx_solana_transactions_signature 
    ON public.solana_transactions(transaction_signature);
    
CREATE INDEX IF NOT EXISTS idx_solana_transactions_payment_request_id 
    ON public.solana_transactions(payment_request_id);
    
CREATE INDEX IF NOT EXISTS idx_solana_transactions_status 
    ON public.solana_transactions(status);

CREATE INDEX IF NOT EXISTS idx_solana_transactions_verification_status 
    ON public.solana_transactions(verification_status);

-- 4. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_solana_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_solana_payment_requests_updated_at 
    BEFORE UPDATE ON public.solana_payment_requests
    FOR EACH ROW EXECUTE FUNCTION update_solana_updated_at_column();

CREATE TRIGGER update_solana_transactions_updated_at 
    BEFORE UPDATE ON public.solana_transactions
    FOR EACH ROW EXECUTE FUNCTION update_solana_updated_at_column();

-- 5. RLS Policies
ALTER TABLE public.solana_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solana_transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own payment requests
CREATE POLICY "Users can view own payment requests"
    ON public.solana_payment_requests
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to view their own transactions
CREATE POLICY "Users can view own transactions"
    ON public.solana_transactions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow service role to insert/update (for webhook processing)
CREATE POLICY "Service role can insert payment requests"
    ON public.solana_payment_requests
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update payment requests"
    ON public.solana_payment_requests
    FOR UPDATE
    USING (true);

CREATE POLICY "Service role can insert transactions"
    ON public.solana_transactions
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update transactions"
    ON public.solana_transactions
    FOR UPDATE
    USING (true);

-- 6. Helper function to expire old payment requests
CREATE OR REPLACE FUNCTION expire_old_payment_requests()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.solana_payment_requests
    SET status = 'expired',
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'pending'
    AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Comments for documentation
COMMENT ON TABLE public.solana_payment_requests IS 'Payment requests for Phantom Wallet USDC/USDT top-ups';
COMMENT ON TABLE public.solana_transactions IS 'Verified transactions from Solana blockchain';
COMMENT ON COLUMN public.solana_payment_requests.reference_id IS 'Unique reference ID included in transaction memo';
COMMENT ON COLUMN public.solana_payment_requests.memo IS 'Full memo format: Username: [username] Amount: [amount] ReferenceID: [ref_id]';
COMMENT ON COLUMN public.solana_transactions.transaction_signature IS 'Solana transaction signature (unique identifier)';
COMMENT ON COLUMN public.solana_transactions.verification_status IS 'Whether transaction matches a payment request';
COMMENT ON COLUMN public.solana_transactions.balance_updated IS 'Whether user balance has been credited';

