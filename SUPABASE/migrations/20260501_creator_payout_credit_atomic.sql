-- Atomic creator payout: update withdrawable_balance + total_money_won together with reward row.
-- Optional idempotency_key + advisory lock prevent double-credit under retries/concurrency.

ALTER TABLE public.money_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS money_transactions_user_reward_idempotency_key
ON public.money_transactions (user_id, idempotency_key)
WHERE idempotency_key IS NOT NULL
  AND type::text = 'reward';

COMMENT ON COLUMN public.money_transactions.idempotency_key IS
  'Optional deterministic key per user for idempotent payouts (reward type).';

CREATE OR REPLACE FUNCTION public.creator_payout_credit_atomic(
  p_creator_id uuid,
  p_amount_cents bigint,
  p_description text,
  p_remarks text,
  p_metadata jsonb,
  p_idempotency_key text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id uuid;
  v_bal bigint;
  v_key text := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  IF v_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(p_creator_id::text),
      hashtext(v_key)
    );

    SELECT mt.id INTO v_tx_id
    FROM public.money_transactions mt
    WHERE mt.user_id = p_creator_id
      AND mt.type = 'reward'
      AND mt.idempotency_key = v_key
    LIMIT 1;

    IF v_tx_id IS NOT NULL THEN
      SELECT COALESCE(cp.withdrawable_balance, 0)::bigint INTO v_bal
      FROM public.creator_profiles cp
      WHERE cp.id = p_creator_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'creator profile not found for %', p_creator_id;
      END IF;

      RETURN json_build_object(
        'new_balance', v_bal,
        'transaction_id', v_tx_id::text,
        'already_applied', true
      );
    END IF;
  END IF;

  UPDATE public.creator_profiles cp
  SET
    withdrawable_balance = COALESCE(cp.withdrawable_balance, 0) + p_amount_cents,
    total_money_won = COALESCE(cp.total_money_won, 0) + p_amount_cents
  WHERE cp.id = p_creator_id
  RETURNING cp.withdrawable_balance INTO v_bal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'creator profile not found for %', p_creator_id;
  END IF;

  INSERT INTO public.money_transactions (
    user_id,
    type,
    status,
    amount,
    description,
    remarks,
    metadata,
    currency,
    payment_method,
    created_at,
    updated_at,
    idempotency_key
  )
  VALUES (
    p_creator_id,
    'reward',
    'success',
    p_amount_cents,
    p_description,
    NULLIF(trim(p_remarks), ''),
    p_metadata,
    'USD',
    NULL,
    now(),
    now(),
    v_key
  )
  RETURNING id INTO v_tx_id;

  RETURN json_build_object(
    'new_balance', v_bal,
    'transaction_id', v_tx_id::text,
    'already_applied', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.creator_payout_credit_atomic(uuid, bigint, text, text, jsonb, text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.creator_payout_credit_atomic(uuid, bigint, text, text, jsonb, text)
TO service_role;
