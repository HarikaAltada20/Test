-- Add columns to snapshot payout details, track cancellations, and define amount_type
ALTER TABLE public.withdrawal_requests
ADD COLUMN IF NOT EXISTS amount_type TEXT, -- Example: 'coins', 'cash'. Consider creating an ENUM.
ADD COLUMN IF NOT EXISTS payout_method_type_snapshot TEXT, -- Stores the type like 'crypto', 'upi', 'bank'
ADD COLUMN IF NOT EXISTS payout_method_details_snapshot JSONB, -- Stores the actual address/details
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NULL;

COMMENT ON COLUMN public.withdrawal_requests.amount_type IS 'Specifies the type of withdrawal, e.g., cash or coins';

-- Note: ENUM types for amount_type or payout_method_type_snapshot can be added in a future migration if desired.

-- Optional: Create an ENUM for amount_type if you prefer more type safety
-- CREATE TYPE public.withdrawal_amount_type_enum AS ENUM ('cash', 'coins');
-- ALTER TABLE public.withdrawal_requests
-- ALTER COLUMN amount_type TYPE public.withdrawal_amount_type_enum USING amount_type::withdrawal_amount_type_enum;

-- Optional: Consider creating and using an ENUM for payout_method_type_snapshot if appropriate
-- (If you have a payout_method_type_enum for payout_methods.method_type, you can reuse it or create a similar one)
-- CREATE TYPE public.payout_method_type_enum AS ENUM ('crypto', 'upi', 'bank_transfer'); -- If not exists
-- ALTER TABLE public.withdrawal_requests
-- ALTER COLUMN payout_method_type_snapshot TYPE public.payout_method_type_enum USING payout_method_type_snapshot::public.payout_method_type_enum; 