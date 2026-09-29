-- Atomic creator payout reversal: debit withdrawable_balance + total_money_won under row lock.
-- Prevents lost updates when bulk-reversing many submissions for the same creator in parallel.

CREATE OR REPLACE FUNCTION public.creator_payout_debit_atomic(
  p_creator_id uuid,
  p_amount_cents bigint
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bal bigint;
  v_won bigint;
  v_new_bal bigint;
  v_new_won bigint;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('creator_wallet_debit'),
    hashtext(p_creator_id::text)
  );

  SELECT
    COALESCE(cp.withdrawable_balance, 0)::bigint,
    COALESCE(cp.total_money_won, 0)::bigint
  INTO v_bal, v_won
  FROM public.creator_profiles cp
  WHERE cp.id = p_creator_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'creator profile not found for %', p_creator_id;
  END IF;

  IF v_bal < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient withdrawable balance to reverse % cents (have %)', p_amount_cents, v_bal;
  END IF;

  v_new_bal := v_bal - p_amount_cents;
  v_new_won := GREATEST(0::bigint, v_won - p_amount_cents);

  UPDATE public.creator_profiles cp
  SET
    withdrawable_balance = v_new_bal,
    total_money_won = v_new_won
  WHERE cp.id = p_creator_id;

  RETURN json_build_object(
    'new_balance', v_new_bal,
    'new_total_won', v_new_won
  );
END;
$$;

REVOKE ALL ON FUNCTION public.creator_payout_debit_atomic(uuid, bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.creator_payout_debit_atomic(uuid, bigint) TO service_role;
