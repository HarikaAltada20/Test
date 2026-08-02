-- Preserve existing transaction_reference when status updates omit it.
-- Previously Approve (and other status changes) always wrote NULL and wiped a saved UTR.

CREATE OR REPLACE FUNCTION public.admin_set_withdrawal_status(
  p_request_id uuid,
  p_new_status text,
  p_transaction_reference text DEFAULT NULL,
  p_admin_notes text DEFAULT NULL,
  p_in_review_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request public.withdrawal_requests%ROWTYPE;
  v_final_admin_notes text;
  v_tx_status text;
BEGIN
  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  -- When marking in_review, append internal reason to admin_notes
  v_final_admin_notes := COALESCE(p_admin_notes, v_request.admin_notes);
  IF p_new_status = 'in_review' AND p_in_review_reason IS NOT NULL AND btrim(p_in_review_reason) <> '' THEN
    IF v_request.admin_notes IS NOT NULL AND btrim(v_request.admin_notes) <> '' THEN
      v_final_admin_notes := btrim(v_request.admin_notes) || E'\n\n' || 'In review: ' || btrim(p_in_review_reason);
    ELSE
      v_final_admin_notes := 'In review: ' || btrim(p_in_review_reason);
    END IF;
  END IF;

  UPDATE public.withdrawal_requests
  SET
    status = p_new_status,
    updated_at = NOW(),
    -- Only overwrite UTR when a non-null value is supplied (empty string clears)
    transaction_reference = COALESCE(p_transaction_reference, v_request.transaction_reference),
    admin_notes = v_final_admin_notes,
    processed_at = CASE
      WHEN p_new_status = 'processed' THEN NOW()
      WHEN p_new_status IN ('pending', 'in_review', 'approved', 'rejected', 'cancelled', 'failed', 'forfeited')
        THEN NULL
      ELSE processed_at
    END
  WHERE id = p_request_id;

  -- Refund + log for rejected/cancelled
  IF p_new_status IN ('rejected', 'cancelled') THEN
    PERFORM public._admin_refund_withdrawal_request(v_request);

    INSERT INTO public.money_transactions (
      user_id, type, status, amount, currency, description, remarks, metadata, created_at, updated_at
    ) VALUES (
      v_request.user_id,
      'refund',
      'success',
      v_request.amount,
      v_request.currency,
      CASE WHEN p_new_status = 'cancelled'
        THEN 'Withdrawal cancelled - Balance refunded'
        ELSE 'Withdrawal rejected - Balance refunded'
      END,
      CASE WHEN p_new_status = 'cancelled'
        THEN 'Refund for cancelled withdrawal request'
        ELSE 'Refund for rejected withdrawal request'
      END,
      jsonb_build_object(
        'original_withdrawal_id', p_request_id,
        'refund_reason', p_new_status,
        'admin_notes', v_final_admin_notes
      ),
      NOW(),
      NOW()
    );
  END IF;

  -- Update corresponding money transaction (if present)
  IF p_new_status IN ('processed', 'failed', 'cancelled', 'rejected') THEN
    v_tx_status := CASE
      WHEN p_new_status = 'processed' THEN 'success'
      WHEN p_new_status IN ('failed', 'rejected') THEN 'failed'
      ELSE 'cancelled'
    END;

    UPDATE public.money_transactions
    SET
      status = v_tx_status,
      updated_at = NOW(),
      remarks = CASE WHEN v_final_admin_notes IS NOT NULL AND btrim(v_final_admin_notes) <> ''
        THEN 'Admin notes: ' || v_final_admin_notes
        ELSE NULL
      END
    WHERE withdrawal_request_id = p_request_id;
  END IF;
END;
$$;
