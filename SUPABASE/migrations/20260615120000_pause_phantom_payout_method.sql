-- Deprecate Phantom Wallet as a payout method type.
-- Users should use Crypto with Solana network (USDC/USDT) instead.
-- Existing withdrawal snapshots and admin history remain readable.

UPDATE public.payout_method_type_settings
SET is_paused = true, updated_at = now()
WHERE method_type = 'phantom';

INSERT INTO public.payout_method_type_settings (method_type, is_paused)
VALUES ('phantom', true)
ON CONFLICT (method_type) DO UPDATE
SET is_paused = true, updated_at = now();
