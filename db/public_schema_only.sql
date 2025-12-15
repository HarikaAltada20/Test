--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: contest_moderation_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contest_moderation_status_enum AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'published',
    'rejected'
);


--
-- Name: contest_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contest_type_enum AS ENUM (
    'leaderboard',
    'cpm'
);


--
-- Name: post_contest_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.post_contest_status_enum AS ENUM (
    'pending_review',
    'in_review',
    'verification_complete',
    'payouts_processed'
);


--
-- Name: pricing_interval; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pricing_interval AS ENUM (
    'day',
    'week',
    'month',
    'year'
);


--
-- Name: pricing_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pricing_type AS ENUM (
    'one_time',
    'recurring'
);


--
-- Name: submission_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.submission_status_enum AS ENUM (
    'pending',
    'verified',
    'rejected',
    'paid'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'past_due',
    'trialing',
    'unpaid'
);


--
-- Name: archive_old_transactions(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_old_transactions(p_days_old integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move old completed transactions to archive table (create if needed)
  CREATE TABLE IF NOT EXISTS money_transactions_archive (LIKE money_transactions INCLUDING ALL);
  
  WITH archived AS (
    DELETE FROM money_transactions 
    WHERE status IN ('success', 'failed') 
    AND created_at < NOW() - INTERVAL '1 day' * p_days_old
    RETURNING *
  )
  INSERT INTO money_transactions_archive 
  SELECT * FROM archived;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  RETURN archived_count;
END;
$$;


--
-- Name: batch_update_transaction_statuses(text[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.batch_update_transaction_statuses(p_payment_intent_ids text[], p_new_status text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE money_transactions
  SET 
    status = p_new_status,
    updated_at = NOW()
  WHERE payment_intent_id = ANY(p_payment_intent_ids)
  AND status = 'pending';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  RETURN rows_updated;
END;
$$;


--
-- Name: cancel_advertiser_withdrawal_request_by_user(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_advertiser_withdrawal_request_by_user(p_request_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_request public.withdrawal_requests%ROWTYPE;
BEGIN
    -- 1. Fetch the request
    SELECT * INTO v_request
    FROM public.withdrawal_requests wr
    WHERE wr.id = p_request_id AND wr.user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal request not found or access denied';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Withdrawal request is not in a cancellable state';
    END IF;

    -- 2. Update the request status
    UPDATE public.withdrawal_requests
    SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'Cancelled by advertiser', updated_at = NOW()
    WHERE id = p_request_id;

    -- 3. Restore the user's balance
    IF v_request.amount_type = 'cash' THEN
        UPDATE public.advertiser_profiles
        SET withdrawable_balance = withdrawable_balance + v_request.amount
        WHERE id = p_user_id;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins + v_request.amount
        WHERE id = p_user_id;
    END IF;

    -- 4. Update transaction records (simple, like creator)
    IF v_request.amount_type = 'cash' THEN
        UPDATE public.money_transactions
        SET status = 'cancelled'
        WHERE type = 'withdrawal' AND description LIKE 'Advertiser withdrawal request ID: ' || v_request.id::text;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.coin_transactions
        SET status = 'cancelled'
        WHERE type = 'redemption' AND description LIKE 'Advertiser coin redemption: %' AND user_id = p_user_id;
    END IF;

    RETURN TRUE;
END;
$$;


--
-- Name: cancel_subscription(text, timestamp with time zone, timestamp with time zone, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_subscription(stripe_subscription_id text, canceled_at_param timestamp with time zone DEFAULT now(), ended_at_param timestamp with time zone DEFAULT NULL::timestamp with time zone, cancel_at_param timestamp with time zone DEFAULT NULL::timestamp with time zone, cancellation_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$DECLARE
    user_uuid UUID;
    current_notes TEXT;
BEGIN
    -- Get user_id and current notes for this subscription
    SELECT user_id, internal_notes INTO user_uuid, current_notes
    FROM subscriptions 
    WHERE id = stripe_subscription_id;
    
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'Subscription % not found', stripe_subscription_id;
    END IF;
    
    BEGIN
        -- Update subscription to canceled with complete cancellation data
        UPDATE subscriptions SET
            status = 'canceled',
            canceled_at = canceled_at_param,
            ended_at = COALESCE(ended_at_param, canceled_at_param),
            cancel_at = cancel_at_param, -- Future cancellation date if different
            internal_notes = CASE 
                WHEN cancellation_reason IS NOT NULL THEN
                    COALESCE(current_notes || E'\n', '') || 
                    'CANCELED: ' || canceled_at_param::text || ' - ' || cancellation_reason
                ELSE current_notes
            END,
            updated = now()
        WHERE id = stripe_subscription_id;
        
        -- Set user back to EXPLORER (free plan)
        UPDATE advertiser_profiles 
        SET subscription_info = jsonb_build_object(
            'product_id', 'prod_SgtEmTCYKfROTo', -- EXPLORER
            'price_id', 'price_1RlVS3JEc43ljUHzS4i9LI2Y', -- Free price
            'subscription_id', null,
            'last_synced', now()
        )
        WHERE id = user_uuid;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to cancel subscription: %', SQLERRM;
    END;
END;$$;


--
-- Name: cancel_withdrawal_request_by_user(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_withdrawal_request_by_user(p_request_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_request public.withdrawal_requests%ROWTYPE;
BEGIN
    -- 1. Fetch the withdrawal request and ensure it belongs to the user and is pending
    SELECT * INTO v_request
    FROM public.withdrawal_requests wr
    WHERE wr.id = p_request_id AND wr.user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal request (ID: %) not found for user (ID: %) or access denied.', p_request_id, p_user_id;
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Withdrawal request (ID: %) is not in a cancellable state. Current status: %.', p_request_id, v_request.status;
    END IF;

    -- 2. Update the withdrawal request status
    UPDATE public.withdrawal_requests
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = 'Cancelled by user', -- You could make this a parameter
        updated_at = NOW()
    WHERE id = p_request_id;

    -- 3. Restore the user's balance
    IF v_request.amount_type = 'cash' THEN
        UPDATE public.creator_profiles
        SET withdrawable_balance = withdrawable_balance + v_request.amount
        WHERE id = p_user_id; -- Assuming creator_profiles.id is the user_id (often the case)
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins + v_request.amount
        WHERE id = p_user_id;
    ELSE
        -- This should ideally not be reached if amount_type is validated properly
        RAISE WARNING 'Unknown amount_type (%) for withdrawal request ID: % during cancellation. Balance not restored.', v_request.amount_type, p_request_id;
    END IF;

    -- 4. Update status of related transaction records (money_transactions, coin_transactions)
    IF v_request.amount_type = 'cash' THEN
        UPDATE public.money_transactions
        SET status = 'cancelled'
        WHERE type = 'withdrawal' -- <<< CRITICAL: Must be 'withdrawal'
          AND withdrawal_request_id = v_request.id
          AND user_id = p_user_id;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.coin_transactions
        SET status = 'cancelled'
        WHERE type = 'redemption' -- <<< CRITICAL: Must be 'redemption'
          AND withdrawal_request_id = v_request.id -- Ensure this FK name is correct for coin_transactions
          AND user_id = p_user_id;
    END IF;

    RETURN TRUE; -- Indicate success

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error for debugging
        RAISE WARNING 'Error during cancellation of withdrawal request ID % for user ID %: SQLSTATE: %, SQLERRM: %', p_request_id, p_user_id, SQLSTATE, SQLERRM;
        RETURN FALSE; -- Indicate failure
END;
$$;


--
-- Name: FUNCTION cancel_withdrawal_request_by_user(p_request_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cancel_withdrawal_request_by_user(p_request_id uuid, p_user_id uuid) IS 'Cancels a pending withdrawal request. Uses creator_profiles.withdrawable_balance (numeric, stores cents) for cash refunds.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: withdrawal_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawal_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    payout_method_id uuid,
    amount bigint NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    processed_at timestamp with time zone,
    transaction_reference text,
    admin_notes text,
    user_notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    amount_type text,
    payout_method_type_snapshot text,
    payout_method_details_snapshot jsonb,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    redeemed_item_description jsonb,
    CONSTRAINT withdrawal_requests_amount_cents_check CHECK ((amount > 0))
);


--
-- Name: TABLE withdrawal_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.withdrawal_requests IS 'Tracks user requests to withdraw funds from their cash balance.';


--
-- Name: COLUMN withdrawal_requests.payout_method_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.withdrawal_requests.payout_method_id IS 'The specific payout method selected by the user for this withdrawal.';


--
-- Name: COLUMN withdrawal_requests.amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.withdrawal_requests.amount IS 'The numeric value of the request. Interpreted as cents if amount_type is ''cash'', or coin quantity if amount_type is ''coins''.';


--
-- Name: COLUMN withdrawal_requests.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.withdrawal_requests.status IS 'Current status of the withdrawal request (e.g., pending, approved, rejected, processed, failed).';


--
-- Name: COLUMN withdrawal_requests.admin_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.withdrawal_requests.admin_notes IS 'Notes by admin during review or processing of the request.';


--
-- Name: COLUMN withdrawal_requests.user_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.withdrawal_requests.user_notes IS 'Optional notes provided by the user when submitting the withdrawal request.';


--
-- Name: COLUMN withdrawal_requests.amount_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.withdrawal_requests.amount_type IS 'Indicates if the withdrawal is for - coins or cash';


--
-- Name: COLUMN withdrawal_requests.redeemed_item_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.withdrawal_requests.redeemed_item_description IS 'Structured details (JSONB) of the item redeemed with coins, e.g., { "product_id": "xyz", "name": "Cool Badge", "variant": "Gold" }';


--
-- Name: create_advertiser_withdrawal_request(uuid, uuid, integer, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_advertiser_withdrawal_request(p_user_id uuid, p_payout_method_id uuid, p_amount integer, p_currency text, p_amount_type text, p_user_notes text DEFAULT NULL::text, p_redeemed_item_description jsonb DEFAULT NULL::jsonb) RETURNS SETOF public.withdrawal_requests
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_payout_method_type TEXT := NULL;
    v_payout_method_details JSONB := NULL;
    new_request public.withdrawal_requests;
    current_coin_balance INTEGER;
    current_cash_balance INTEGER;
BEGIN
    -- 1. Check user's balance
    IF p_amount_type = 'cash' THEN
        SELECT COALESCE(ap.withdrawable_balance, 0) INTO current_cash_balance 
        FROM public.advertiser_profiles ap WHERE ap.id = p_user_id;
        IF current_cash_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient cash balance. Requested: %, Available: %', p_amount, current_cash_balance;
        END IF;
    ELSIF p_amount_type = 'coins' THEN
        SELECT COALESCE(u.coins, 0) INTO current_coin_balance 
        FROM public.users u WHERE u.id = p_user_id;
        IF current_coin_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient coin balance. Requested: %, Available: %', p_amount, current_coin_balance;
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid amount type specified: %', p_amount_type;
    END IF;

    -- 2. Fetch payout method details if ID is provided
    IF p_payout_method_id IS NOT NULL THEN
        SELECT pm.method_type, pm.details INTO v_payout_method_type, v_payout_method_details
        FROM public.payout_methods pm
        WHERE pm.id = p_payout_method_id AND pm.user_id = p_user_id;

        IF v_payout_method_type IS NULL THEN
            RAISE EXCEPTION 'Payout method not found or does not belong to the user';
        END IF;
    ELSIF p_amount_type = 'cash' THEN
        RAISE EXCEPTION 'Payout method ID is required for cash withdrawals';
    END IF;

    -- 3. Create the withdrawal request
    INSERT INTO public.withdrawal_requests (
        user_id, payout_method_id, amount, currency, amount_type, status, user_notes,
        payout_method_type_snapshot, payout_method_details_snapshot, redeemed_item_description
    )
    VALUES (
        p_user_id, p_payout_method_id, p_amount, p_currency, p_amount_type, 'pending', p_user_notes,
        v_payout_method_type, v_payout_method_details,
        CASE WHEN p_amount_type = 'coins' THEN p_redeemed_item_description ELSE NULL END
    )
    RETURNING * INTO new_request;

    -- 4. Deduct from user's balance
    IF p_amount_type = 'cash' THEN
        UPDATE public.advertiser_profiles
        SET withdrawable_balance = withdrawable_balance - p_amount
        WHERE id = p_user_id;
    ELSIF p_amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins - p_amount
        WHERE id = p_user_id;
    END IF;

    -- 5. Create transaction record (simple, like creator)
    IF p_amount_type = 'cash' THEN
        INSERT INTO public.money_transactions (user_id, type, status, amount, description)
        VALUES (p_user_id, 'withdrawal', 'pending', p_amount, 'Advertiser withdrawal request ID: ' || new_request.id::text);
    ELSIF p_amount_type = 'coins' THEN
        INSERT INTO public.coin_transactions (user_id, type, status, coins, description)
        VALUES (p_user_id, 'redemption', 'pending', p_amount, 'Advertiser coin redemption: ' || COALESCE((p_redeemed_item_description->>'name')::text, 'Item'));
    END IF;

    RETURN NEXT new_request;
    RETURN;
END;
$$;


--
-- Name: create_subscription(text, uuid, text, text, timestamp with time zone, timestamp with time zone, integer, boolean, timestamp with time zone, timestamp with time zone, timestamp with time zone, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_subscription(stripe_subscription_id text, user_uuid uuid, stripe_price_id text, subscription_status text DEFAULT 'active'::text, period_start timestamp with time zone DEFAULT now(), period_end timestamp with time zone DEFAULT (now() + '1 mon'::interval), subscription_quantity integer DEFAULT 1, cancel_at_period_end_param boolean DEFAULT false, cancel_at_param timestamp with time zone DEFAULT NULL::timestamp with time zone, trial_start_param timestamp with time zone DEFAULT NULL::timestamp with time zone, trial_end_param timestamp with time zone DEFAULT NULL::timestamp with time zone, stripe_metadata_param jsonb DEFAULT '{}'::jsonb, internal_notes_param text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    product_id_var TEXT;
BEGIN
    -- Validate price_id exists and get product_id
    SELECT product_id INTO product_id_var 
    FROM prices 
    WHERE id = stripe_price_id AND active = true;
    
    IF product_id_var IS NULL THEN
        RAISE EXCEPTION 'Active price ID % not found', stripe_price_id;
    END IF;
    
    -- Validate trial period logic
    IF (trial_start_param IS NOT NULL AND trial_end_param IS NULL) OR 
       (trial_start_param IS NULL AND trial_end_param IS NOT NULL) THEN
        RAISE EXCEPTION 'Both trial_start and trial_end must be provided together or both NULL';
    END IF;
    
    IF trial_start_param IS NOT NULL AND trial_end_param IS NOT NULL AND trial_end_param <= trial_start_param THEN
        RAISE EXCEPTION 'trial_end must be after trial_start';
    END IF;
    
    BEGIN
        -- Check for existing active subscription (since we can't use partial unique constraint)
        IF EXISTS (SELECT 1 FROM subscriptions WHERE user_id = user_uuid AND status = 'active') THEN
            RAISE EXCEPTION 'User % already has an active subscription', user_uuid;
        END IF;
        
        -- Create complete subscription record
        INSERT INTO subscriptions (
            id, user_id, status, price_id, quantity, cancel_at_period_end,
            current_period_start, current_period_end, cancel_at,
            trial_start, trial_end, stripe_metadata, internal_notes
        ) VALUES (
            stripe_subscription_id, user_uuid, subscription_status::subscription_status, stripe_price_id,
            subscription_quantity, cancel_at_period_end_param, period_start, period_end, cancel_at_param,
            trial_start_param, trial_end_param, stripe_metadata_param, internal_notes_param
        );
        
        -- Update advertiser profile with minimal essential info
        UPDATE advertiser_profiles 
        SET subscription_info = jsonb_build_object(
            'product_id', product_id_var,
            'price_id', stripe_price_id,
            'subscription_id', stripe_subscription_id,
            'last_synced', now()
        )
        WHERE id = user_uuid;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'User % not found in advertiser_profiles', user_uuid;
        END IF;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to create subscription: %', SQLERRM;
    END;
    
    RETURN stripe_subscription_id;
END;
$$;


--
-- Name: create_withdrawal_request(uuid, uuid, integer, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_withdrawal_request(p_user_id uuid, p_payout_method_id uuid, p_amount integer, p_currency text, p_amount_type text, p_user_notes text, p_redeemed_item_description jsonb DEFAULT NULL::jsonb) RETURNS SETOF public.withdrawal_requests
    LANGUAGE plpgsql
    AS $$DECLARE
    v_payout_method_type TEXT := NULL;
    v_payout_method_details JSONB := NULL;
    new_request public.withdrawal_requests;
    current_coin_balance integer;
    current_cash_balance integer;
BEGIN
    -- 1. Check user's balance
    IF p_amount_type = 'cash' THEN
        SELECT cp.withdrawable_balance INTO current_cash_balance FROM public.creator_profiles cp WHERE cp.id = p_user_id;
        IF current_cash_balance IS NULL OR current_cash_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient cash balance. Requested: %, Available: %', p_amount, COALESCE(current_cash_balance, 0);
        END IF;
    ELSIF p_amount_type = 'coins' THEN
        SELECT u.coins INTO current_coin_balance FROM public.users u WHERE u.id = p_user_id;
        IF current_coin_balance IS NULL OR current_coin_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient coin balance. Requested: %, Available: %', p_amount, COALESCE(current_coin_balance, 0);
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid amount type specified: %', p_amount_type;
    END IF;

    -- 2. Fetch payout method details if ID is provided
    IF p_payout_method_id IS NOT NULL THEN
        SELECT pm.method_type, pm.details INTO v_payout_method_type, v_payout_method_details
        FROM public.payout_methods pm
        WHERE pm.id = p_payout_method_id AND pm.user_id = p_user_id;

        IF v_payout_method_type IS NULL THEN
            RAISE EXCEPTION 'Payout method (ID: %) not found or does not belong to the user.', p_payout_method_id;
        END IF;
    ELSIF p_amount_type = 'cash' THEN
        RAISE EXCEPTION 'Payout method ID is required for cash withdrawals.';
    END IF;

    -- 3. Create the withdrawal/redemption request
    INSERT INTO public.withdrawal_requests (
        user_id,
        payout_method_id,
        amount, -- Renamed column
        currency,
        amount_type,
        status,
        user_notes,
        payout_method_type_snapshot,
        payout_method_details_snapshot,
        redeemed_item_description
    )
    VALUES (
        p_user_id,
        p_payout_method_id,
        p_amount, -- Renamed parameter
        p_currency,
        p_amount_type,
        'pending',
        p_user_notes,
        v_payout_method_type,
        v_payout_method_details,
        CASE
            WHEN p_amount_type = 'coins' THEN p_redeemed_item_description
            ELSE NULL
        END
    )
    RETURNING * INTO new_request;

    -- 4. Deduct from user's balance
    IF p_amount_type = 'cash' THEN
        UPDATE public.creator_profiles
        SET withdrawable_balance = withdrawable_balance - p_amount -- Use renamed parameter
        WHERE id = p_user_id;
    ELSIF p_amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins - p_amount -- Use renamed parameter
        WHERE id = p_user_id;
    END IF;

    -- 5. Create a transaction record
    IF p_amount_type = 'cash' THEN
        -- Assuming money_transactions.amount stores cents if renamed from amount_cents
        INSERT INTO public.money_transactions (user_id, type, status, amount, currency, description, withdrawal_request_id)
        VALUES (p_user_id, 'withdrawal', 'pending', p_amount, p_currency, 'Cash withdrawal request initiated.', new_request.id);
    ELSIF p_amount_type = 'coins' THEN
        INSERT INTO public.coin_transactions (user_id, type, status, coins, description, related_withdrawal_id)
        VALUES (p_user_id, 'redemption_request', 'pending', p_amount, 'Coin redemption request: ' || COALESCE((p_redeemed_item_description->>'name')::text, 'Item'), new_request.id);
    END IF;

    RETURN NEXT new_request;
    RETURN;
END;$$;


--
-- Name: credit_advertiser_cash_atomic(uuid, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.credit_advertiser_cash_atomic(p_user_id uuid, p_amount_cents integer, p_description text, p_remarks text) RETURNS TABLE(new_balance integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_balance integer;
begin
  update public.advertiser_profiles
  set available_deposit_balance = coalesce(available_deposit_balance, 0) + p_amount_cents,
      updated_at = now()
  where id = p_user_id
  returning available_deposit_balance into v_balance;

  if not found then
    raise exception 'advertiser profile not found for %', p_user_id;
  end if;

  insert into public.money_transactions (
    user_id, type, status, amount, currency, description, remarks, payment_method, created_at, updated_at
  ) values (
    p_user_id, 'reward', 'success', p_amount_cents, 'USD', p_description, p_remarks, 'wallet', now(), now()
  );

  return query select v_balance;
end;
$$;


--
-- Name: credit_creator_cash_atomic(uuid, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.credit_creator_cash_atomic(p_user_id uuid, p_amount_cents integer, p_description text, p_remarks text) RETURNS TABLE(new_balance integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_balance integer;
begin
  update public.creator_profiles
  set withdrawable_balance = coalesce(withdrawable_balance, 0) + p_amount_cents,
      updated_at = now()
  where id = p_user_id
  returning withdrawable_balance into v_balance;

  if not found then
    raise exception 'creator profile not found for %', p_user_id;
  end if;

  insert into public.money_transactions (
    user_id, type, status, amount, currency, description, remarks, payment_method, created_at, updated_at
  ) values (
    p_user_id, 'reward', 'success', p_amount_cents, 'USD', p_description, p_remarks, 'wallet', now(), now()
  );

  return query select v_balance;
end;
$$;


--
-- Name: expire_old_payment_requests(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_old_payment_requests() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_pending_transaction_by_payment_intent(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pending_transaction_by_payment_intent(payment_intent_id text) RETURNS TABLE(id uuid, user_id uuid, type text, status text, amount integer, description text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mt.id,
    mt.user_id,
    mt.type,
    mt.status,
    mt.amount,
    mt.description,
    mt.created_at,
    mt.updated_at
  FROM money_transactions mt
  WHERE mt.status = 'pending'
  AND mt.description ILIKE '%' || payment_intent_id || '%'
  ORDER BY mt.created_at DESC
  LIMIT 1;
END;
$$;


--
-- Name: get_pending_transaction_by_payment_intent_fast(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pending_transaction_by_payment_intent_fast(p_payment_intent_id text) RETURNS TABLE(id uuid, user_id uuid, type text, status text, amount integer, description text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mt.id,
    mt.user_id,
    mt.type,
    mt.status,
    mt.amount,
    mt.description,
    mt.created_at,
    mt.updated_at
  FROM money_transactions mt
  WHERE mt.payment_intent_id = p_payment_intent_id  -- Using parameter prefix to avoid ambiguity
  AND mt.status = 'pending'
  ORDER BY mt.created_at DESC
  LIMIT 1;
END;
$$;


--
-- Name: get_total_transactions_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_total_transactions_count() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  total_count integer;
BEGIN
  SELECT COUNT(*) INTO total_count FROM money_transactions;
  RETURN total_count;
END;
$$;


--
-- Name: get_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT user_type FROM public.users WHERE id = auth.uid();
$$;


--
-- Name: grant_referral_cash_bonus(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_referral_cash_bonus(p_user_id uuid, p_ref_code text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$BEGIN
  IF p_ref_code IS NOT NULL AND p_ref_code <> ''
     AND EXISTS (
       SELECT 1 FROM users 
       WHERE referral_code = p_ref_code
     )
     AND NOT EXISTS (
       SELECT 1 FROM money_transactions 
       WHERE user_id = p_user_id 
         AND type = 'referral_signup_bonus'
     ) THEN

    UPDATE public.creator_profiles
    SET withdrawable_balance = COALESCE(withdrawable_balance, 0) + 50
    WHERE id = p_user_id;

  UPDATE public.users

  SET other_earnings = COALESCE(other_earnings, 0) + 50

  WHERE id = p_user_id;

    INSERT INTO public.money_transactions (
      user_id, type, status, amount, description, created_at
    ) VALUES (
      p_user_id,
      'referral_signup_bonus',
      'success',
      50,
      'Referral cash bonus: You used referral code ' || p_ref_code,
      NOW()
    );
  END IF;
END;$$;


--
-- Name: grant_welcome_bonus(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_welcome_bonus(new_user_id uuid, p_user_type text, p_user_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$BEGIN
  -- Check if a welcome bonus has already been granted to prevent duplicates
  IF NOT EXISTS (SELECT 1 FROM coin_transactions WHERE user_id = new_user_id AND type = 'welcome_bonus') THEN
    -- Award Welcome Bonus to the new user
    UPDATE users 
    SET 
      coins = COALESCE(coins, 0) + 100,
      total_lifetime_coins_earned = COALESCE(total_lifetime_coins_earned, 0) + 100
    WHERE id = new_user_id;

    INSERT INTO coin_transactions (
      user_id, 
      type, 
      status, 
      coins, 
      description,
      created_at
    ) VALUES (
      new_user_id, 
      'welcome_bonus', 
      'success', 
      100, 
      'Welcome bonus for joining as ' || p_user_type || ': ' || p_user_name, 
      NOW()
    );
  END IF;
END;$$;


--
-- Name: FUNCTION grant_welcome_bonus(new_user_id uuid, p_user_type text, p_user_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.grant_welcome_bonus(new_user_id uuid, p_user_type text, p_user_name text) IS 'Grants a 100 coin welcome bonus to a new user and logs the transaction. Idempotent.';


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: increment_affilate_earnings(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_affilate_earnings(p_user_id uuid, p_amount integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$declare rows_updated integer;
begin
  update public.users
  set affiliate_earnings = coalesce(affiliate_earnings, 0) + p_amount,
      updated_at = now()
  where id = p_user_id;
  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;$$;


--
-- Name: increment_contest_submission_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_contest_submission_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    BEGIN
        UPDATE public.contests
        SET live_submission_count = COALESCE(live_submission_count, 0) + 1
        WHERE id = NEW.contest_id; -- NEW.contest_id refers to the contest_id of the newly inserted submission
        RETURN NEW; -- The result of a trigger function is ignored for AFTER triggers, but it's good practice.
    END;
    $$;


--
-- Name: increment_creator_submissions_made(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_creator_submissions_made() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Simple increment - no need to count anything
  UPDATE public.creator_profiles 
  SET total_submissions_made = COALESCE(total_submissions_made, 0) + 1
  WHERE id = NEW.creator_id;
  
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION increment_creator_submissions_made(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.increment_creator_submissions_made() IS 'Increments total_submissions_made when a submission is created (O(1) operation)';


--
-- Name: lock_verified_submission_views(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_verified_submission_views(p_contest_id uuid) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with upd as (
    update submissions
       set views_locked = coalesce(views, 0)
     where contest_id = p_contest_id
       and status = 'verified'
       and (views_locked is distinct from coalesce(views, 0))
     returning 1
  )
  select count(*)::int from upd;
$$;


--
-- Name: FUNCTION lock_verified_submission_views(p_contest_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.lock_verified_submission_views(p_contest_id uuid) IS 'Snapshot verified submissions: views_locked := views for a given contest (idempotent). Returns number of rows updated.';


--
-- Name: process_referral_signup(uuid, text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_referral_signup(p_referred_id uuid, p_ref_code text, p_referrer_id uuid, p_referred_user_type text, p_referred_user_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$DECLARE

  referrer_user_name TEXT;

  referred_user_current_name TEXT; 
BEGIN

  -- Fetch referred user's name using raw_user_meta_data
  SELECT COALESCE(raw_user_meta_data->>'user_name', raw_user_meta_data->>'full_name', p_referred_user_name, id::text) 
  INTO referred_user_current_name 
  FROM auth.users WHERE id = p_referred_id;

  -- 1. Grant Welcome Bonus to the new (referred) user (Idempotent call)
  PERFORM grant_welcome_bonus(p_referred_id, p_referred_user_type, referred_user_current_name);

  -- 2. Award Referral Signup Bonus to the new (referred) user for using the code
  IF NOT EXISTS (
    SELECT 1 FROM coin_transactions 
    WHERE user_id = p_referred_id 
      AND type = 'referral_signup_bonus' 
      AND description LIKE ('%referral code ' || p_ref_code || '%')
  ) THEN
    UPDATE users
    SET
      coins = COALESCE(coins, 0) + 100, 
      total_lifetime_coins_earned = COALESCE(total_lifetime_coins_earned, 0) + 100,
      referred_by = p_ref_code 
    WHERE id = p_referred_id;

    INSERT INTO coin_transactions (
      user_id, type, status, coins, description, created_at
    ) VALUES (
      p_referred_id, 
      'referral_signup_bonus', 
      'success', 
      100, 
      'Referral bonus: Used code ' || p_ref_code,
      NOW()
    );
  END IF;
  
  -- 4. Grant Referral Cash Bonus to creators only
  IF p_referred_user_type = 'creator' THEN
    PERFORM grant_referral_cash_bonus(p_referred_id, p_ref_code);
  END IF;

  -- Fetch referrer's name using raw_user_meta_data
  SELECT COALESCE(raw_user_meta_data->>'user_name', raw_user_meta_data->>'full_name', id::text) 
  INTO referrer_user_name 
  FROM auth.users WHERE id = p_referrer_id;

  -- 3. Award Referral Earning to the Referrer
  IF NOT EXISTS (
    SELECT 1 FROM coin_transactions
    WHERE user_id = p_referrer_id
      AND type = 'referral_earning'
      AND description LIKE ('%New ' || p_referred_user_type || ' (' || referred_user_current_name || ') joined%')
  ) THEN
    UPDATE users 
    SET 
      coins = COALESCE(coins, 0) + 100,
      total_lifetime_coins_earned = COALESCE(total_lifetime_coins_earned, 0) + 100,
      creators_referred = CASE 
                            WHEN p_referred_user_type = 'creator' THEN COALESCE(creators_referred, 0) + 1 
                            ELSE COALESCE(creators_referred, 0) 
                          END,
      advertisers_referred = CASE 
                               WHEN p_referred_user_type != 'creator' THEN COALESCE(advertisers_referred, 0) + 1 
                               ELSE COALESCE(advertisers_referred, 0) 
                             END
    WHERE id = p_referrer_id;
    
    INSERT INTO coin_transactions (
      user_id, type, status, coins, description, created_at
    ) VALUES (
      p_referrer_id, 
      'referral_earning', 
      'success', 
      100, 
     'Referral bonus: ' || COALESCE(referred_user_current_name, 'Someone') || ' joined',
      NOW()
    );
  END IF;
  
END;$$;


--
-- Name: FUNCTION process_referral_signup(p_referred_id uuid, p_ref_code text, p_referrer_id uuid, p_referred_user_type text, p_referred_user_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.process_referral_signup(p_referred_id uuid, p_ref_code text, p_referrer_id uuid, p_referred_user_type text, p_referred_user_name text) IS 'Processes a new user signup with a referral code. Grants welcome bonus, referral signup bonus to new user, and referral earning to referrer. Logs transactions. Idempotent for individual bonuses. Uses raw_user_meta_data.';


--
-- Name: update_creator_contests_participated_on_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_creator_contests_participated_on_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  existing_submission_count INTEGER;
BEGIN
  -- Check if creator already has a submission for this contest
  SELECT COUNT(*) INTO existing_submission_count
  FROM public.submissions
  WHERE creator_id = NEW.creator_id 
    AND contest_id = NEW.contest_id
    AND id != NEW.id; -- Exclude the current submission being inserted
  
  -- If this is the first submission for this contest, increment total_contests_participated
  IF existing_submission_count = 0 THEN
    UPDATE public.creator_profiles
    SET total_contests_participated = COALESCE(total_contests_participated, 0) + 1
    WHERE id = NEW.creator_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION update_creator_contests_participated_on_insert(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_creator_contests_participated_on_insert() IS 'Updates total_contests_participated by checking if this is the first submission for this contest (O(1) query)';


--
-- Name: update_creator_wins_on_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_creator_wins_on_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  existing_contest_win BOOLEAN;
BEGIN
  -- Case 1: Status changed FROM something TO 'paid' (new win)
  IF (OLD.status IS DISTINCT FROM 'paid') AND (NEW.status = 'paid') THEN
    
    -- Increment total_submissions_won
    UPDATE public.creator_profiles
    SET total_submissions_won = COALESCE(total_submissions_won, 0) + 1
    WHERE id = NEW.creator_id;
    
    -- Check if creator already has a contest win for this contest
    SELECT EXISTS (
      SELECT 1 FROM public.creator_contest_wins
      WHERE creator_id = NEW.creator_id AND contest_id = NEW.contest_id
    ) INTO existing_contest_win;
    
    -- If no existing contest win, create one and increment total_contests_won
    IF NOT existing_contest_win THEN
      -- Insert into creator_contest_wins
      INSERT INTO public.creator_contest_wins (creator_id, contest_id, first_win_submission_id, created_at)
      VALUES (NEW.creator_id, NEW.contest_id, NEW.id, NOW())
      ON CONFLICT (creator_id, contest_id) DO NOTHING;
      
      -- Increment total_contests_won (only if insert was successful)
      IF FOUND THEN
        UPDATE public.creator_profiles
        SET total_contests_won = COALESCE(total_contests_won, 0) + 1
        WHERE id = NEW.creator_id;
      END IF;
    END IF;
    
  -- Case 2: Status changed FROM 'paid' TO something else (reversal)
  ELSIF (OLD.status = 'paid') AND (NEW.status IS DISTINCT FROM 'paid') THEN
    
    -- Decrement total_submissions_won
    UPDATE public.creator_profiles
    SET total_submissions_won = GREATEST(0, COALESCE(total_submissions_won, 0) - 1)
    WHERE id = NEW.creator_id;
    
    -- Check if this was the first (and possibly only) win for this contest
    DECLARE
      first_win_id UUID;
      other_wins_count INTEGER;
    BEGIN
      -- Get the first_win_submission_id for this contest
      SELECT first_win_submission_id INTO first_win_id
      FROM public.creator_contest_wins
      WHERE creator_id = NEW.creator_id AND contest_id = NEW.contest_id;
      
      -- If this submission was the first win, we need to handle contest win removal
      IF first_win_id = NEW.id THEN
        -- Check if there are other paid submissions for this contest
        SELECT COUNT(*) INTO other_wins_count
        FROM public.submissions
        WHERE creator_id = NEW.creator_id 
          AND contest_id = NEW.contest_id
          AND id != NEW.id
          AND status = 'paid';
        
        -- If no other wins exist, remove the contest win and decrement total_contests_won
        IF other_wins_count = 0 THEN
          DELETE FROM public.creator_contest_wins
          WHERE creator_id = NEW.creator_id AND contest_id = NEW.contest_id;
          
          UPDATE public.creator_profiles
          SET total_contests_won = GREATEST(0, COALESCE(total_contests_won, 0) - 1)
          WHERE id = NEW.creator_id;
        ELSE
          -- Update first_win_submission_id to another paid submission
          UPDATE public.creator_contest_wins
          SET first_win_submission_id = (
            SELECT id FROM public.submissions
            WHERE creator_id = NEW.creator_id 
              AND contest_id = NEW.contest_id
              AND status = 'paid'
            ORDER BY created_at ASC
            LIMIT 1
          )
          WHERE creator_id = NEW.creator_id AND contest_id = NEW.contest_id;
        END IF;
      END IF;
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION update_creator_wins_on_status_change(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_creator_wins_on_status_change() IS 'Handles total_submissions_won and total_contests_won when submission status changes to/from paid, with full reversal support';


--
-- Name: update_solana_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_solana_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_subscription(text, text, text, timestamp with time zone, timestamp with time zone, integer, boolean, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_subscription(stripe_subscription_id text, new_status text DEFAULT NULL::text, new_price_id text DEFAULT NULL::text, new_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, new_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone, new_quantity integer DEFAULT NULL::integer, cancel_at_period_end_param boolean DEFAULT NULL::boolean, cancel_at_param timestamp with time zone DEFAULT NULL::timestamp with time zone, canceled_at_param timestamp with time zone DEFAULT NULL::timestamp with time zone, ended_at_param timestamp with time zone DEFAULT NULL::timestamp with time zone, trial_start_param timestamp with time zone DEFAULT NULL::timestamp with time zone, trial_end_param timestamp with time zone DEFAULT NULL::timestamp with time zone, stripe_metadata_param jsonb DEFAULT NULL::jsonb, internal_notes_param text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$DECLARE
    user_uuid UUID;
    current_subscription_record RECORD;
    product_id_var TEXT;
    final_price_id TEXT;
    final_period_end TIMESTAMP WITH TIME ZONE;
    final_status subscription_status;
    final_quantity INTEGER;
BEGIN
    -- Get current subscription data in one query
    SELECT user_id, price_id, current_period_end, status, quantity
    INTO current_subscription_record
    FROM subscriptions 
    WHERE id = stripe_subscription_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription % not found', stripe_subscription_id;
    END IF;
    
    user_uuid := current_subscription_record.user_id;
    final_price_id := COALESCE(new_price_id, current_subscription_record.price_id);
    final_period_end := COALESCE(new_period_end, current_subscription_record.current_period_end);
    final_status := COALESCE(new_status::subscription_status, current_subscription_record.status);
    final_quantity := COALESCE(new_quantity, current_subscription_record.quantity);
    
    -- Validate trial period logic if provided
    IF (trial_start_param IS NOT NULL AND trial_end_param IS NULL) OR 
       (trial_start_param IS NULL AND trial_end_param IS NOT NULL) THEN
        RAISE EXCEPTION 'Both trial_start and trial_end must be provided together or both NULL';
    END IF;
    
    IF trial_start_param IS NOT NULL AND trial_end_param IS NOT NULL AND trial_end_param <= trial_start_param THEN
        RAISE EXCEPTION 'trial_end must be after trial_start';
    END IF;
    
    -- Validate new price_id if provided
    IF new_price_id IS NOT NULL THEN
        SELECT product_id INTO product_id_var 
        FROM prices 
        WHERE id = new_price_id AND active = true;
        
        IF product_id_var IS NULL THEN
            RAISE EXCEPTION 'Active price ID % not found', new_price_id;
        END IF;
    ELSE
        -- Get product_id for current price
        SELECT product_id INTO product_id_var 
        FROM prices 
        WHERE id = final_price_id;
    END IF;
    
    BEGIN
        -- Update subscription record with ALL possible fields
        UPDATE subscriptions SET
            status = final_status,
            price_id = final_price_id,
            quantity = final_quantity,
            current_period_start = COALESCE(new_period_start, current_period_start),
            current_period_end = final_period_end,
            cancel_at_period_end = COALESCE(cancel_at_period_end_param, cancel_at_period_end),
            cancel_at = COALESCE(cancel_at_param, cancel_at),
            canceled_at = COALESCE(canceled_at_param, canceled_at),
            ended_at = COALESCE(ended_at_param, ended_at),
            trial_start = COALESCE(trial_start_param, trial_start),
            trial_end = COALESCE(trial_end_param, trial_end),
            stripe_metadata = COALESCE(stripe_metadata_param, stripe_metadata),
            internal_notes = COALESCE(internal_notes_param, internal_notes),
            updated = now()
        WHERE id = stripe_subscription_id;
        
        -- Update advertiser profile ONLY if subscription is still active
        IF final_status = 'active' THEN
            UPDATE advertiser_profiles 
            SET subscription_info = jsonb_build_object(
                'product_id', product_id_var,
                'price_id', final_price_id,
                'subscription_id', stripe_subscription_id,
                'last_synced', now()
            )
            WHERE id = user_uuid;
        ELSE
            -- If subscription is no longer active, set to free plan
            UPDATE advertiser_profiles 
            SET subscription_info = jsonb_build_object(
                'product_id', 'prod_SgtEmTCYKfROTo', -- EXPLORER (free)
                'price_id', 'price_1RlVS3JEc43ljUHzS4i9LI2Y', -- Free price
                'subscription_id', null,
                'last_synced', now()
            )
            WHERE id = user_uuid;
        END IF;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to update subscription: %', SQLERRM;
    END;
END;$$;


--
-- Name: update_transaction_status_by_payment_intent(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_transaction_status_by_payment_intent(payment_intent_id text, new_status text, new_description text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  transaction_record RECORD;
  rows_updated INTEGER;
BEGIN
  -- Find the transaction
  SELECT id INTO transaction_record
  FROM money_transactions
  WHERE status = 'pending'
  AND description ILIKE '%' || payment_intent_id || '%'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if transaction found
  IF transaction_record.id IS NULL THEN
    RETURN false;
  END IF;

  -- Update the transaction
  UPDATE money_transactions
  SET 
    status = new_status,
    updated_at = NOW(),
    description = COALESCE(new_description, description)
  WHERE id = transaction_record.id;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  RETURN rows_updated > 0;
END;
$$;


--
-- Name: update_transaction_status_by_payment_intent_fast(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_transaction_status_by_payment_intent_fast(p_payment_intent_id text, p_new_status text, p_new_description text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  -- Direct update using indexed column (no SELECT needed)
  UPDATE money_transactions
  SET 
    status = p_new_status,
    updated_at = NOW(),
    description = COALESCE(p_new_description, description)
  WHERE payment_intent_id = p_payment_intent_id  -- Using parameter prefix to avoid ambiguity
  AND status = 'pending';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  RETURN rows_updated > 0;
END;
$$;


--
-- Name: update_transaction_status_by_payment_intent_fast(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_transaction_status_by_payment_intent_fast(p_payment_intent_id text, p_new_status text, p_new_description text DEFAULT NULL::text, p_remarks text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  -- Direct update using indexed column
  UPDATE money_transactions
  SET 
    status = p_new_status,
    updated_at = NOW(),
    description = COALESCE(p_new_description, description),
    remarks = COALESCE(p_remarks, remarks)
  WHERE payment_intent_id = p_payment_intent_id
  AND status = 'pending';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  RETURN rows_updated > 0;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: advertiser_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.advertiser_profiles (
    id uuid NOT NULL,
    company_name text,
    website_url text,
    total_contests_run integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    total_money_spent bigint DEFAULT 0,
    available_deposit_balance bigint DEFAULT 0,
    withdrawable_balance bigint DEFAULT 0,
    subscription_info jsonb,
    CONSTRAINT check_positive_balance CHECK ((available_deposit_balance >= 0))
);


--
-- Name: COLUMN advertiser_profiles.total_money_spent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.advertiser_profiles.total_money_spent IS 'Total money spent by advertiser, in cents.';


--
-- Name: COLUMN advertiser_profiles.available_deposit_balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.advertiser_profiles.available_deposit_balance IS 'Available advertiser balance, in cents.';


--
-- Name: COLUMN advertiser_profiles.withdrawable_balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.advertiser_profiles.withdrawable_balance IS 'Withdrawable advertiser balance, in cents.';


--
-- Name: COLUMN advertiser_profiles.subscription_info; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.advertiser_profiles.subscription_info IS 'Clean JSONB: {product_id, price_id, subscription_id, last_synced} - Client fetches details from respective tables';


--
-- Name: CONSTRAINT check_positive_balance ON advertiser_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT check_positive_balance ON public.advertiser_profiles IS 'Prevents negative wallet balances to ensure atomic transaction integrity';


--
-- Name: coin_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text,
    status text,
    coins bigint,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT coin_transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text]))),
    CONSTRAINT coin_transactions_type_check CHECK ((type = ANY (ARRAY['referral_bonus'::text, 'spent'::text, 'earned'::text, 'bonus'::text, 'welcome_bonus'::text, 'referral_signup_bonus'::text, 'referral_earning'::text])))
);


--
-- Name: TABLE coin_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.coin_transactions IS 'Transaction log for all coin-related activities';


--
-- Name: COLUMN coin_transactions.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coin_transactions.type IS 'Type of coin transaction: referral_bonus, spent, earned, bonus, welcome_bonus, referral_signup_bonus, referral_earning, coupon_redemption';


--
-- Name: COLUMN coin_transactions.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coin_transactions.status IS 'Status of the transaction: pending, success, failed';


--
-- Name: COLUMN coin_transactions.coins; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coin_transactions.coins IS 'Amount of coins involved in the transaction (positive for earned, negative for spent)';


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text,
    email text,
    phone text,
    message text
);


--
-- Name: contests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    advertiser_id uuid,
    title text NOT NULL,
    platform text,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    thumbnail_url text,
    resources jsonb,
    category text,
    inspiration_links jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    contest_type public.contest_type_enum,
    contest_based_details jsonb,
    live_submission_count integer DEFAULT 0,
    post_contest_status public.post_contest_status_enum,
    brief_html text,
    brief_json jsonb,
    last_metrics_updated timestamp with time zone,
    rules_html text,
    rules_json jsonb,
    moderation_status public.contest_moderation_status_enum DEFAULT 'draft'::public.contest_moderation_status_enum,
    submitted_for_approval_at timestamp with time zone,
    approved_at timestamp with time zone,
    approved_by uuid,
    published_at timestamp with time zone,
    rejection_reason text,
    payment_details jsonb,
    subscription_info_of_user jsonb,
    views_locked_at timestamp with time zone,
    multiple_submissions_enabled boolean DEFAULT false,
    max_submissions_per_creator integer DEFAULT 1,
    content_type text,
    bonus_details jsonb,
    max_earnings_per_creator integer,
    tracking_links jsonb,
    categories jsonb,
    subcategories jsonb,
    interests jsonb,
    region jsonb,
    CONSTRAINT contests_content_type_check CHECK ((content_type = ANY (ARRAY['ugc'::text, 'clipping'::text, 'other'::text])))
);


--
-- Name: COLUMN contests.contest_based_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contests.contest_based_details IS 'Contains contest-type-specific details. Money values (total_prize, total_budget, flat_fee_bonus) are stored in cents as integers.

For Leaderboard contests:
{
  "leaderboard_contest": {
    "prizes": [{"position": 1, "amount": 10000}, ...],
    "total_prize": 50000,
    "winner_count": 3,
    "flat_fee_bonus": 1000  // OPTIONAL - flat fee per verified submission (in cents)
  }
}

For CPM contests:
{
  "cpm_contest": {
    "cpm_rate_usd": 5.00,
    "min_views": 1000,              // OPTIONAL
    "max_views": 100000,            // OPTIONAL
    "total_budget": 100000,
    "budget_spent": 0,
    "terms_conditions": "...",
    "flat_fee_bonus": 1000    // OPTIONAL - flat fee per verified submission (in cents)
  }
}

Note: min_views, max_views, and flat_fee_bonus are all optional and apply to ALL submissions when multiple submissions are enabled.';


--
-- Name: COLUMN contests.payment_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contests.payment_details IS 'Stores payment information in JSONB format: {
  "total_prize_pool": 10000,         // cents (original budget/prize pool)
  "commission_amount": 1000,         // cents  
  "total_amount_paid": 11000,        // cents (prize pool + commission)
  "commission_percentage": 10.0,     // decimal
  "wallet_amount_used": 5000,        // cents
  "stripe_amount_paid": 6000,        // cents
  "payment_intent_id": "pi_xxx",     // string
  "payment_status": "completed",     // pending/completed/failed
  "paid_at": "2024-01-15T10:30:00Z" // timestamp
}';


--
-- Name: COLUMN contests.subscription_info_of_user; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contests.subscription_info_of_user IS 'JSONB snapshot of complete user subscription info at contest creation time: {product_id, plan_name, price_id, subscription_id, expires_at, plan_features, etc}';


--
-- Name: COLUMN contests.multiple_submissions_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contests.multiple_submissions_enabled IS 'Whether creators can submit multiple entries to this contest';


--
-- Name: COLUMN contests.max_submissions_per_creator; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contests.max_submissions_per_creator IS 'Maximum number of submissions allowed per creator (2-100). Defaults to 1 for single submission contests.';


--
-- Name: COLUMN contests.content_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contests.content_type IS 'Type of content required: ugc (User Generated Content), clipping (Short clips/repurposed content), or other (Check Rules)';


--
-- Name: COLUMN contests.bonus_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contests.bonus_details IS 'Additional bonus opportunities in JSONB format with rich text content: {
  "description_html": "<ul><li>Top 3 creators get $100 each</li></ul>",
  "description_json": {...}
}';


--
-- Name: COLUMN contests.max_earnings_per_creator; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contests.max_earnings_per_creator IS 'Maximum total earnings cap per creator for THIS CONTEST ONLY (stored in cents). This is per-campaign, not platform-wide. Creator can still submit after reaching cap but won''t earn more from this specific contest. Does not affect earnings from other contests.';


--
-- Name: contests_with_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.contests_with_status AS
 SELECT contests.id,
    contests.advertiser_id,
    contests.title,
    contests.platform,
    contests.start_date,
    contests.end_date,
    contests.thumbnail_url,
    contests.resources,
    contests.category,
    contests.inspiration_links,
    contests.tracking_links,
    contests.created_at,
    contests.subscription_info_of_user,
    contests.updated_at,
    contests.contest_type,
    contests.contest_based_details,
    contests.live_submission_count,
    contests.post_contest_status,
    contests.brief_html,
    contests.brief_json,
    contests.last_metrics_updated,
    contests.rules_html,
    contests.rules_json,
    contests.moderation_status,
    contests.submitted_for_approval_at,
    contests.approved_at,
    contests.approved_by,
    contests.published_at,
    contests.rejection_reason,
    contests.payment_details,
        CASE
            WHEN (contests.moderation_status <> 'published'::public.contest_moderation_status_enum) THEN NULL::text
            WHEN ((contests.start_date IS NULL) OR (contests.end_date IS NULL)) THEN 'incomplete'::text
            WHEN ((now() AT TIME ZONE 'UTC'::text) < contests.start_date) THEN 'upcoming'::text
            WHEN (((now() AT TIME ZONE 'UTC'::text) >= contests.start_date) AND ((now() AT TIME ZONE 'UTC'::text) < contests.end_date)) THEN 'active'::text
            WHEN ((now() AT TIME ZONE 'UTC'::text) >= contests.end_date) THEN 'ended'::text
            ELSE 'unknown'::text
        END AS status,
    contests.views_locked_at,
    contests.multiple_submissions_enabled,
    contests.max_submissions_per_creator,
    contests.content_type,
    contests.bonus_details,
    contests.max_earnings_per_creator,
    contests.categories,
    contests.subcategories,
    contests.interests,
    contests.region
   FROM public.contests;


--
-- Name: VIEW contests_with_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.contests_with_status IS 'View that includes all contest columns (including new features: multiple submissions, content type, bonus details, earnings cap) plus computed status field for easy querying';


--
-- Name: coupon_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: creator_contest_wins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_contest_wins (
    creator_id uuid NOT NULL,
    contest_id uuid NOT NULL,
    first_win_submission_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE creator_contest_wins; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.creator_contest_wins IS 'Tracks contest-level wins to ensure idempotent counting (one win per creator per contest)';


--
-- Name: COLUMN creator_contest_wins.first_win_submission_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.creator_contest_wins.first_win_submission_id IS 'The first submission that won for this creator in this contest';


--
-- Name: creator_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_profiles (
    id uuid NOT NULL,
    bio text,
    youtube_account jsonb,
    instagram_account jsonb,
    total_contests_participated integer DEFAULT 0,
    total_contests_won integer DEFAULT 0,
    total_views bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    total_money_won bigint DEFAULT 0,
    withdrawable_balance bigint DEFAULT 0,
    has_seen_guidelines boolean DEFAULT false NOT NULL,
    total_submissions_made integer DEFAULT 0,
    total_submissions_won integer DEFAULT 0,
    phone_number text,
    date_of_birth date,
    gender text,
    country text,
    state text,
    city text,
    address text,
    languages jsonb,
    categories jsonb,
    subcategories jsonb,
    has_claimed_profile_reward boolean,
    interests jsonb,
    profile_reward_claimed_at timestamp without time zone,
    twitter_account jsonb
);


--
-- Name: COLUMN creator_profiles.total_money_won; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.creator_profiles.total_money_won IS 'Total money won by creator, in cents.';


--
-- Name: COLUMN creator_profiles.withdrawable_balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.creator_profiles.withdrawable_balance IS 'Withdrawable creator balance, in cents.';


--
-- Name: COLUMN creator_profiles.total_submissions_made; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.creator_profiles.total_submissions_made IS 'Total number of submissions made across all contests';


--
-- Name: COLUMN creator_profiles.total_submissions_won; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.creator_profiles.total_submissions_won IS 'Total number of submissions that won (got paid)';


--
-- Name: COLUMN creator_profiles.twitter_account; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.creator_profiles.twitter_account IS 'Twitter/X account connection data stored as JSONB. Structure matches twitterProfile API response:
{
  "username": "creator_handle",              // From twitterProfile.profile
  "name": "Display Name",                    // From twitterProfile.name
  "verified": false,                        // From twitterProfile.blue_verified
  "profile_picture_url": "https://...",      // From twitterProfile.avatar
  "bio": "User bio text...",                // From twitterProfile.desc
  "media_count": 150,                       // From twitterProfile.media_count
  "tweet_count": 1200,                      // From twitterProfile.statuses_count
  "following_count": 200,                   // From twitterProfile.friends_count
  "followers_count": 5000,                  // From twitterProfile.sub_count
  "twitter_id": "1234567890",               // From twitterProfile.rest_id
  "updated_at": "2025-01-15T10:30:00Z"      // ISO timestamp
}';


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid NOT NULL,
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    default_payment_method_id text
);


--
-- Name: TABLE customers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customers IS 'Stripe customer information for all user types';


--
-- Name: COLUMN customers.stripe_customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.stripe_customer_id IS 'Stripe customer ID for billing and payments';


--
-- Name: COLUMN customers.default_payment_method_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.default_payment_method_id IS 'Stores the Stripe payment method ID that should be used as default for this customer. Provides redundancy and faster access than querying Stripe directly.';


--
-- Name: email_change_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_change_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    old_email text,
    new_email text,
    user_id uuid DEFAULT gen_random_uuid()
);


--
-- Name: form_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    submitted_at timestamp with time zone
);


--
-- Name: money_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.money_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text,
    status text,
    amount bigint,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    currency text,
    withdrawal_request_id uuid,
    payment_intent_id text,
    remarks text,
    payment_method character varying(20) DEFAULT NULL::character varying,
    metadata jsonb,
    CONSTRAINT money_transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT money_transactions_type_check CHECK ((type = ANY (ARRAY['withdrawal'::text, 'reward'::text, 'deposit'::text, 'contest_payment'::text, 'refund'::text, 'subscription_payment'::text, 'subscription_refund'::text, 'referral_signup_bonus'::text])))
);


--
-- Name: TABLE money_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.money_transactions IS 'All the transactions which includes money';


--
-- Name: COLUMN money_transactions.amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.money_transactions.amount IS 'Amount In cents';


--
-- Name: COLUMN money_transactions.currency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.money_transactions.currency IS 'The currency code for the transaction amount (e.g., USD).';


--
-- Name: COLUMN money_transactions.withdrawal_request_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.money_transactions.withdrawal_request_id IS 'If this transaction is related to a withdrawal, this stores the ID of that withdrawal_request. NULL otherwise.';


--
-- Name: COLUMN money_transactions.remarks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.money_transactions.remarks IS 'User-friendly message explaining transaction status and context';


--
-- Name: COLUMN money_transactions.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.money_transactions.payment_method IS 'Payment method used: wallet, stripe, split, or refund';


--
-- Name: CONSTRAINT money_transactions_status_check ON money_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT money_transactions_status_check ON public.money_transactions IS 'Ensures the status column contains one of the predefined valid statuses including pending, success, failed, and cancelled.';


--
-- Name: payout_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


--
-- Name: payout_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    method_type text NOT NULL,
    details jsonb NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    friendly_name text
);

ALTER TABLE ONLY public.payout_methods FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE payout_methods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payout_methods IS 'Stores payout methods for users.';


--
-- Name: COLUMN payout_methods.method_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payout_methods.method_type IS 'Type of payout method: crypto, paypal, bank, upi.';


--
-- Name: COLUMN payout_methods.details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payout_methods.details IS 'JSONB object containing method-specific details.';


--
-- Name: COLUMN payout_methods.is_default; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payout_methods.is_default IS 'True if this is the default payout method for the user.';


--
-- Name: COLUMN payout_methods.friendly_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payout_methods.friendly_name IS 'User-defined friendly name for the payout method (e.g., "My Binance USDT", "Primary Savings")';


--
-- Name: prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prices (
    id text NOT NULL,
    product_id text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    unit_amount bigint NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    type public.pricing_type DEFAULT 'recurring'::public.pricing_type NOT NULL,
    "interval" public.pricing_interval,
    interval_count integer DEFAULT 1 NOT NULL,
    trial_period_days integer DEFAULT 0 NOT NULL,
    billing_scheme text DEFAULT 'per_unit'::text NOT NULL,
    description text,
    created timestamp with time zone DEFAULT now() NOT NULL,
    updated timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT prices_currency_check CHECK ((char_length(currency) = 3)),
    CONSTRAINT prices_interval_required_for_recurring CHECK ((((type = 'recurring'::public.pricing_type) AND ("interval" IS NOT NULL)) OR ((type = 'one_time'::public.pricing_type) AND ("interval" IS NULL)))),
    CONSTRAINT prices_unit_amount_check CHECK ((unit_amount >= 0))
);


--
-- Name: TABLE prices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.prices IS 'Pricing options with descriptions - monthly/yearly billing';


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    name text NOT NULL,
    description text,
    display_name text NOT NULL,
    plan_features jsonb DEFAULT '{}'::jsonb NOT NULL,
    created timestamp with time zone DEFAULT now() NOT NULL,
    updated timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE products; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.products IS 'Game of Creators subscription plans synced with real Stripe products';


--
-- Name: queries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_type text,
    query_text text,
    user_id uuid
);


--
-- Name: solana_payment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solana_payment_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reference_id text NOT NULL,
    amount_requested bigint NOT NULL,
    token_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    memo text NOT NULL,
    wallet_address text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT solana_payment_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'expired'::text, 'cancelled'::text]))),
    CONSTRAINT solana_payment_requests_token_type_check CHECK ((token_type = ANY (ARRAY['USDC'::text, 'USDT'::text])))
);


--
-- Name: TABLE solana_payment_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.solana_payment_requests IS 'Payment requests for Phantom Wallet USDC/USDT top-ups';


--
-- Name: COLUMN solana_payment_requests.reference_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.solana_payment_requests.reference_id IS 'Unique reference ID included in transaction memo';


--
-- Name: COLUMN solana_payment_requests.memo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.solana_payment_requests.memo IS 'Full memo format: Username: [username] Amount: [amount] ReferenceID: [ref_id]';


--
-- Name: solana_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solana_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_request_id uuid,
    user_id uuid NOT NULL,
    transaction_signature text NOT NULL,
    amount_received bigint NOT NULL,
    token_type text NOT NULL,
    token_mint_address text NOT NULL,
    from_wallet text NOT NULL,
    to_wallet text NOT NULL,
    memo text,
    block_time timestamp with time zone,
    slot bigint,
    status text DEFAULT 'pending'::text NOT NULL,
    verification_status text DEFAULT 'unverified'::text NOT NULL,
    balance_updated boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT solana_transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text, 'failed'::text]))),
    CONSTRAINT solana_transactions_token_type_check CHECK ((token_type = ANY (ARRAY['USDC'::text, 'USDT'::text]))),
    CONSTRAINT solana_transactions_verification_status_check CHECK ((verification_status = ANY (ARRAY['unverified'::text, 'verified'::text, 'invalid'::text])))
);


--
-- Name: TABLE solana_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.solana_transactions IS 'Verified transactions from Solana blockchain';


--
-- Name: COLUMN solana_transactions.transaction_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.solana_transactions.transaction_signature IS 'Solana transaction signature (unique identifier)';


--
-- Name: COLUMN solana_transactions.verification_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.solana_transactions.verification_status IS 'Whether transaction matches a payment request';


--
-- Name: COLUMN solana_transactions.balance_updated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.solana_transactions.balance_updated IS 'Whether user balance has been credited';


--
-- Name: submission_views_credited; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submission_views_credited (
    submission_id uuid NOT NULL,
    credited_views bigint DEFAULT 0 NOT NULL,
    credited_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contest_id uuid,
    creator_id uuid,
    content_link text,
    views bigint,
    metadata jsonb,
    other_stats jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    video_id text,
    video_title text,
    video_thumbnail_url text,
    updated_at timestamp with time zone DEFAULT now(),
    platform text,
    last_insights_update timestamp with time zone,
    status public.submission_status_enum DEFAULT 'pending'::public.submission_status_enum,
    earnings bigint,
    views_locked bigint,
    affiliate_paid boolean DEFAULT false NOT NULL,
    affiliate_metadata jsonb,
    paid boolean DEFAULT false NOT NULL,
    paid_at timestamp with time zone,
    bonus_paid boolean DEFAULT false NOT NULL,
    bonus_paid_at timestamp with time zone,
    bonus_amount integer DEFAULT 0
);


--
-- Name: TABLE submissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.submissions IS 'Submissions by creators for contests';


--
-- Name: COLUMN submissions.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.submissions.metadata IS 'JSON metadata for submission actions. 
For rejections: {"type": "rejection", "reason": "string", "timestamp": "ISO date", "updatedBy": "user_id"}
For payments: {"type": "payment", "paymentProofUrl": "string", "paymentDescription": "string", "timestamp": "ISO date", "updatedBy": "user_id"}';


--
-- Name: COLUMN submissions.earnings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.submissions.earnings IS 'Earnings for the submission, in cents.';


--
-- Name: COLUMN submissions.paid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.submissions.paid IS 'Indicates if CPM/leaderboard earnings have been paid to creator';


--
-- Name: COLUMN submissions.paid_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.submissions.paid_at IS 'Timestamp when CPM/leaderboard earnings were paid';


--
-- Name: COLUMN submissions.bonus_paid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.submissions.bonus_paid IS 'Indicates if flat fee bonus has been paid to creator';


--
-- Name: COLUMN submissions.bonus_paid_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.submissions.bonus_paid_at IS 'Timestamp when flat fee bonus was paid';


--
-- Name: COLUMN submissions.bonus_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.submissions.bonus_amount IS 'Flat fee bonus amount paid for this submission (in cents). Separate from CPM earnings.';


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id text NOT NULL,
    user_id uuid NOT NULL,
    status public.subscription_status DEFAULT 'active'::public.subscription_status NOT NULL,
    price_id text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    created timestamp with time zone DEFAULT now() NOT NULL,
    updated timestamp with time zone DEFAULT now() NOT NULL,
    current_period_start timestamp with time zone NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    cancel_at timestamp with time zone,
    canceled_at timestamp with time zone,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    stripe_metadata jsonb DEFAULT '{}'::jsonb,
    internal_notes text,
    CONSTRAINT subscriptions_period_logic CHECK ((current_period_end > current_period_start))
);


--
-- Name: TABLE subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscriptions IS 'User subscription instances - only 1 active per user allowed';


--
-- Name: COLUMN subscriptions.cancel_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.cancel_at IS 'Future date when subscription WILL be canceled (user clicked "cancel at period end")';


--
-- Name: COLUMN subscriptions.canceled_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.canceled_at IS 'Past date when user REQUESTED cancellation';


--
-- Name: survey_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid DEFAULT gen_random_uuid(),
    survey_button_clicked boolean,
    survey_reward_claimed boolean,
    survey_button_clicked_at timestamp with time zone,
    survey_reward_claimed_at timestamp with time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    profile_picture_url text,
    email text NOT NULL,
    user_type text NOT NULL,
    referral_code text,
    referred_by text,
    coins bigint,
    advertisers_referred integer DEFAULT 0,
    creators_referred integer DEFAULT 0,
    username text,
    is_active boolean DEFAULT true,
    email_confirmed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    total_lifetime_coins_earned bigint DEFAULT 0,
    login_history jsonb DEFAULT '[]'::jsonb,
    registration_info jsonb DEFAULT '{}'::jsonb,
    affiliate_earnings bigint NOT NULL,
    other_earnings bigint DEFAULT 0 NOT NULL,
    CONSTRAINT users_coins_non_negative CHECK ((coins >= 0)),
    CONSTRAINT users_total_lifetime_coins_non_negative CHECK ((total_lifetime_coins_earned >= 0)),
    CONSTRAINT users_user_type_check CHECK ((user_type = ANY (ARRAY['creator'::text, 'advertiser'::text, 'admin'::text])))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'Users table - which stores all users in the platform';


--
-- Name: COLUMN users.coins; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.coins IS 'Current available coins for the user';


--
-- Name: COLUMN users.total_lifetime_coins_earned; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.total_lifetime_coins_earned IS 'Total coins earned by the user over their lifetime';


--
-- Name: advertiser_profiles advertiser_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advertiser_profiles
    ADD CONSTRAINT advertiser_profiles_pkey PRIMARY KEY (id);


--
-- Name: coin_transactions coin_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: contests contests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contests
    ADD CONSTRAINT contests_pkey PRIMARY KEY (id);


--
-- Name: coupon_redemptions coupon_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_pkey PRIMARY KEY (id);


--
-- Name: creator_contest_wins creator_contest_wins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_contest_wins
    ADD CONSTRAINT creator_contest_wins_pkey PRIMARY KEY (creator_id, contest_id);


--
-- Name: creator_profiles creator_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_profiles
    ADD CONSTRAINT creator_profiles_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: email_change_logs email_change_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_change_logs
    ADD CONSTRAINT email_change_logs_pkey PRIMARY KEY (id);


--
-- Name: form_submissions form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_pkey PRIMARY KEY (id);


--
-- Name: money_transactions money_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.money_transactions
    ADD CONSTRAINT money_transactions_pkey PRIMARY KEY (id);


--
-- Name: payout_jobs payout_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_jobs
    ADD CONSTRAINT payout_jobs_pkey PRIMARY KEY (id);


--
-- Name: payout_methods payout_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_methods
    ADD CONSTRAINT payout_methods_pkey PRIMARY KEY (id);


--
-- Name: prices prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prices
    ADD CONSTRAINT prices_pkey PRIMARY KEY (id);


--
-- Name: products products_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_name_key UNIQUE (name);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: queries queries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queries
    ADD CONSTRAINT queries_pkey PRIMARY KEY (id);


--
-- Name: solana_payment_requests solana_payment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solana_payment_requests
    ADD CONSTRAINT solana_payment_requests_pkey PRIMARY KEY (id);


--
-- Name: solana_payment_requests solana_payment_requests_reference_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solana_payment_requests
    ADD CONSTRAINT solana_payment_requests_reference_id_key UNIQUE (reference_id);


--
-- Name: solana_transactions solana_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solana_transactions
    ADD CONSTRAINT solana_transactions_pkey PRIMARY KEY (id);


--
-- Name: solana_transactions solana_transactions_transaction_signature_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solana_transactions
    ADD CONSTRAINT solana_transactions_transaction_signature_key UNIQUE (transaction_signature);


--
-- Name: submission_views_credited submission_views_credited_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_views_credited
    ADD CONSTRAINT submission_views_credited_pkey PRIMARY KEY (submission_id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: survey_redemptions survey_bonus_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_redemptions
    ADD CONSTRAINT survey_bonus_redemptions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: withdrawal_requests withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);


--
-- Name: idx_advertiser_profiles_subscription_info; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_advertiser_profiles_subscription_info ON public.advertiser_profiles USING gin (subscription_info);


--
-- Name: idx_coin_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_created_at ON public.coin_transactions USING btree (created_at);


--
-- Name: idx_coin_transactions_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_type_status ON public.coin_transactions USING btree (type, status);


--
-- Name: idx_coin_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_user_id ON public.coin_transactions USING btree (user_id);


--
-- Name: idx_contests_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contests_active ON public.contests USING btree (views_locked_at) WHERE (views_locked_at IS NULL);


--
-- Name: idx_contests_approved_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contests_approved_by ON public.contests USING btree (approved_by) WHERE (approved_by IS NOT NULL);


--
-- Name: idx_contests_brief_html; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contests_brief_html ON public.contests USING gin (to_tsvector('english'::regconfig, brief_html));


--
-- Name: idx_contests_content_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contests_content_type ON public.contests USING btree (content_type) WHERE (content_type IS NOT NULL);


--
-- Name: idx_contests_last_metrics_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contests_last_metrics_updated ON public.contests USING btree (last_metrics_updated);


--
-- Name: idx_contests_moderation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contests_moderation_status ON public.contests USING btree (moderation_status);


--
-- Name: idx_contests_multiple_submissions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contests_multiple_submissions ON public.contests USING btree (multiple_submissions_enabled) WHERE (multiple_submissions_enabled = true);


--
-- Name: idx_contests_post_contest_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contests_post_contest_status ON public.contests USING btree (post_contest_status);


--
-- Name: idx_contests_rules_html; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contests_rules_html ON public.contests USING gin (to_tsvector('english'::regconfig, rules_html));


--
-- Name: idx_contests_subscription_info_of_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contests_subscription_info_of_user ON public.contests USING gin (subscription_info_of_user);


--
-- Name: idx_coupon_redemptions_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_coupon_redemptions_unique ON public.coupon_redemptions USING btree (user_id, code);


--
-- Name: idx_creator_contest_wins_contest_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_contest_wins_contest_id ON public.creator_contest_wins USING btree (contest_id);


--
-- Name: idx_creator_contest_wins_creator_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_creator_contest_wins_creator_id ON public.creator_contest_wins USING btree (creator_id);


--
-- Name: idx_customers_default_payment_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_default_payment_method ON public.customers USING btree (default_payment_method_id);


--
-- Name: idx_customers_stripe_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_stripe_customer_id ON public.customers USING btree (stripe_customer_id);


--
-- Name: idx_money_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_money_transactions_created_at ON public.money_transactions USING btree (created_at DESC);


--
-- Name: idx_money_transactions_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_money_transactions_metadata ON public.money_transactions USING gin (metadata);


--
-- Name: idx_money_transactions_payment_intent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_money_transactions_payment_intent_id ON public.money_transactions USING btree (payment_intent_id) WHERE (status = 'pending'::text);


--
-- Name: idx_money_transactions_payment_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_money_transactions_payment_method ON public.money_transactions USING btree (payment_method);


--
-- Name: idx_money_transactions_remarks; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_money_transactions_remarks ON public.money_transactions USING btree (remarks) WHERE (remarks IS NOT NULL);


--
-- Name: idx_money_transactions_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_money_transactions_user_status ON public.money_transactions USING btree (user_id, status);


--
-- Name: idx_money_transactions_webhook_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_money_transactions_webhook_lookup ON public.money_transactions USING btree (payment_intent_id, status, created_at DESC) WHERE (payment_intent_id IS NOT NULL);


--
-- Name: idx_money_tx_submission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_money_tx_submission_id ON public.money_transactions USING btree (((metadata ->> 'submission_id'::text)));


--
-- Name: idx_money_tx_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_money_tx_user_type ON public.money_transactions USING btree (user_id, type);


--
-- Name: idx_payout_jobs_status_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_jobs_status_created_at ON public.payout_jobs USING btree (status, created_at);


--
-- Name: idx_prices_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prices_active ON public.prices USING btree (active);


--
-- Name: idx_prices_amount_interval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prices_amount_interval ON public.prices USING btree (unit_amount, "interval");


--
-- Name: idx_prices_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prices_product_id ON public.prices USING btree (product_id);


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_active ON public.products USING btree (active);


--
-- Name: idx_products_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_name ON public.products USING btree (name);


--
-- Name: idx_solana_payment_requests_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solana_payment_requests_expires_at ON public.solana_payment_requests USING btree (expires_at);


--
-- Name: idx_solana_payment_requests_reference_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solana_payment_requests_reference_id ON public.solana_payment_requests USING btree (reference_id);


--
-- Name: idx_solana_payment_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solana_payment_requests_status ON public.solana_payment_requests USING btree (status);


--
-- Name: idx_solana_payment_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solana_payment_requests_user_id ON public.solana_payment_requests USING btree (user_id);


--
-- Name: idx_solana_transactions_payment_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solana_transactions_payment_request_id ON public.solana_transactions USING btree (payment_request_id);


--
-- Name: idx_solana_transactions_signature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solana_transactions_signature ON public.solana_transactions USING btree (transaction_signature);


--
-- Name: idx_solana_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solana_transactions_status ON public.solana_transactions USING btree (status);


--
-- Name: idx_solana_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solana_transactions_user_id ON public.solana_transactions USING btree (user_id);


--
-- Name: idx_solana_transactions_verification_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solana_transactions_verification_status ON public.solana_transactions USING btree (verification_status);


--
-- Name: idx_submissions_affiliate_paid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_affiliate_paid ON public.submissions USING btree (affiliate_paid);


--
-- Name: idx_submissions_bonus_amount; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_bonus_amount ON public.submissions USING btree (bonus_amount) WHERE (bonus_amount > 0);


--
-- Name: idx_submissions_bonus_paid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_bonus_paid ON public.submissions USING btree (bonus_paid);


--
-- Name: idx_submissions_contest_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_contest_created ON public.submissions USING btree (contest_id, created_at);


--
-- Name: idx_submissions_contest_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_contest_created_at ON public.submissions USING btree (contest_id, created_at DESC);


--
-- Name: idx_submissions_contest_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_contest_id ON public.submissions USING btree (contest_id);


--
-- Name: idx_submissions_contest_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_contest_id_status ON public.submissions USING btree (contest_id, status);


--
-- Name: idx_submissions_contest_paid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_contest_paid ON public.submissions USING btree (contest_id, paid, bonus_paid);


--
-- Name: idx_submissions_contest_status_views; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_contest_status_views ON public.submissions USING btree (contest_id, status, views DESC);


--
-- Name: idx_submissions_contest_status_views_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_contest_status_views_created ON public.submissions USING btree (contest_id, status, views DESC, created_at);


--
-- Name: idx_submissions_contest_views; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_contest_views ON public.submissions USING btree (contest_id, views DESC);


--
-- Name: idx_submissions_creator_contest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_creator_contest ON public.submissions USING btree (creator_id, contest_id);


--
-- Name: idx_submissions_creator_contest_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_creator_contest_created ON public.submissions USING btree (creator_id, contest_id, created_at);


--
-- Name: idx_submissions_creator_contest_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_creator_contest_status ON public.submissions USING btree (creator_id, contest_id, status);


--
-- Name: idx_submissions_creator_id_contest_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_creator_id_contest_id ON public.submissions USING btree (creator_id, contest_id);


--
-- Name: idx_submissions_metadata_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_metadata_timestamp ON public.submissions USING btree (((metadata ->> 'timestamp'::text)));


--
-- Name: idx_submissions_metadata_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_metadata_type ON public.submissions USING btree (((metadata ->> 'type'::text)));


--
-- Name: idx_submissions_paid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_paid ON public.submissions USING btree (paid);


--
-- Name: idx_submissions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_status ON public.submissions USING btree (status);


--
-- Name: idx_submissions_status_contest_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_status_contest_id ON public.submissions USING btree (status, contest_id);


--
-- Name: idx_submissions_verified_by_contest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_verified_by_contest ON public.submissions USING btree (contest_id) WHERE (status = 'verified'::public.submission_status_enum);


--
-- Name: idx_submissions_views_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_views_created_at ON public.submissions USING btree (views DESC, created_at);


--
-- Name: idx_submissions_views_locked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_views_locked ON public.submissions USING btree (views_locked);


--
-- Name: idx_subscriptions_active_users; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_active_users ON public.subscriptions USING btree (user_id, status);


--
-- Name: idx_subscriptions_period_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_period_end ON public.subscriptions USING btree (current_period_end);


--
-- Name: idx_subscriptions_price_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_price_id ON public.subscriptions USING btree (price_id);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);


--
-- Name: idx_users_affiliate_earnings_gt0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_affiliate_earnings_gt0 ON public.users USING btree (affiliate_earnings) WHERE (affiliate_earnings > 0);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: ux_reward_per_submission_cycle; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_reward_per_submission_cycle ON public.money_transactions USING btree (((metadata ->> 'submission_id'::text)), COALESCE((NULLIF((metadata ->> 'payout_cycle'::text), ''::text))::integer, 1)) WHERE (type = 'reward'::text);


--
-- Name: ux_reward_submission_cycle; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_reward_submission_cycle ON public.money_transactions USING btree (((metadata ->> 'submission_id'::text)), ((metadata ->> 'payout_cycle'::text))) WHERE (type = 'reward'::text);


--
-- Name: contests on_contests_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_contests_update BEFORE UPDATE ON public.contests FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: submissions on_new_submission_increment_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_new_submission_increment_count AFTER INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.increment_contest_submission_count();


--
-- Name: submissions on_new_submission_increment_metrics; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_new_submission_increment_metrics AFTER INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.increment_creator_submissions_made();


--
-- Name: submissions on_new_submission_update_participation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_new_submission_update_participation AFTER INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.update_creator_contests_participated_on_insert();


--
-- Name: submissions on_submission_status_change_update_wins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_submission_status_change_update_wins AFTER UPDATE OF status ON public.submissions FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.update_creator_wins_on_status_change();


--
-- Name: payout_methods payout_methods_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payout_methods_updated_at_trigger BEFORE UPDATE ON public.payout_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: advertiser_profiles update_advertiser_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_advertiser_profiles_updated_at BEFORE UPDATE ON public.advertiser_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: creator_profiles update_creator_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_creator_profiles_updated_at BEFORE UPDATE ON public.creator_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: solana_payment_requests update_solana_payment_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_solana_payment_requests_updated_at BEFORE UPDATE ON public.solana_payment_requests FOR EACH ROW EXECUTE FUNCTION public.update_solana_updated_at_column();


--
-- Name: solana_transactions update_solana_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_solana_transactions_updated_at BEFORE UPDATE ON public.solana_transactions FOR EACH ROW EXECUTE FUNCTION public.update_solana_updated_at_column();


--
-- Name: submissions update_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: withdrawal_requests withdrawal_requests_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER withdrawal_requests_updated_at_trigger BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: advertiser_profiles advertiser_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advertiser_profiles
    ADD CONSTRAINT advertiser_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.users(id);


--
-- Name: coin_transactions coin_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: contests contests_advertiser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contests
    ADD CONSTRAINT contests_advertiser_id_fkey FOREIGN KEY (advertiser_id) REFERENCES public.advertiser_profiles(id);


--
-- Name: contests contests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contests
    ADD CONSTRAINT contests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: coupon_redemptions coupon_redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: creator_contest_wins creator_contest_wins_contest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_contest_wins
    ADD CONSTRAINT creator_contest_wins_contest_id_fkey FOREIGN KEY (contest_id) REFERENCES public.contests(id) ON DELETE CASCADE;


--
-- Name: creator_contest_wins creator_contest_wins_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_contest_wins
    ADD CONSTRAINT creator_contest_wins_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: creator_profiles creator_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_profiles
    ADD CONSTRAINT creator_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.users(id);


--
-- Name: customers customers_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: email_change_logs email_change_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_change_logs
    ADD CONSTRAINT email_change_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: money_transactions fk_withdrawal_request; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.money_transactions
    ADD CONSTRAINT fk_withdrawal_request FOREIGN KEY (withdrawal_request_id) REFERENCES public.withdrawal_requests(id) ON DELETE SET NULL;


--
-- Name: form_submissions form_submissions_email_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_email_fkey FOREIGN KEY (email) REFERENCES public.users(email);


--
-- Name: money_transactions money_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.money_transactions
    ADD CONSTRAINT money_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payout_jobs payout_jobs_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_jobs
    ADD CONSTRAINT payout_jobs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: payout_jobs payout_jobs_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_jobs
    ADD CONSTRAINT payout_jobs_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;


--
-- Name: payout_methods payout_methods_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_methods
    ADD CONSTRAINT payout_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: prices prices_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prices
    ADD CONSTRAINT prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: queries queries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queries
    ADD CONSTRAINT queries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: solana_payment_requests solana_payment_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solana_payment_requests
    ADD CONSTRAINT solana_payment_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: solana_transactions solana_transactions_payment_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solana_transactions
    ADD CONSTRAINT solana_transactions_payment_request_id_fkey FOREIGN KEY (payment_request_id) REFERENCES public.solana_payment_requests(id) ON DELETE SET NULL;


--
-- Name: solana_transactions solana_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solana_transactions
    ADD CONSTRAINT solana_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submission_views_credited submission_views_credited_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_views_credited
    ADD CONSTRAINT submission_views_credited_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_contest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_contest_id_fkey FOREIGN KEY (contest_id) REFERENCES public.contests(id);


--
-- Name: submissions submissions_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id);


--
-- Name: subscriptions subscriptions_price_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_price_id_fkey FOREIGN KEY (price_id) REFERENCES public.prices(id);


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: survey_redemptions survey_redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_redemptions
    ADD CONSTRAINT survey_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.users(referral_code);


--
-- Name: withdrawal_requests withdrawal_requests_payout_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_payout_method_id_fkey FOREIGN KEY (payout_method_id) REFERENCES public.payout_methods(id) ON DELETE SET NULL;


--
-- Name: withdrawal_requests withdrawal_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: contests Admins can do everything on contests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can do everything on contests" ON public.contests TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.user_type = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.user_type = 'admin'::text)))));


--
-- Name: payout_methods Admins can manage all payout methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all payout methods" ON public.payout_methods TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND (u.user_type = 'goc_admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND (u.user_type = 'goc_admin'::text)))));


--
-- Name: users Admins can view all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all users" ON public.users FOR SELECT TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: submissions Admins have full access to all submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins have full access to all submissions" ON public.submissions USING ((( SELECT users.user_type
   FROM public.users
  WHERE (users.id = auth.uid())) = 'admin'::text)) WITH CHECK ((( SELECT users.user_type
   FROM public.users
  WHERE (users.id = auth.uid())) = 'admin'::text));


--
-- Name: contests Advertisers can manage their own contests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Advertisers can manage their own contests" ON public.contests TO authenticated USING ((auth.uid() = advertiser_id));


--
-- Name: advertiser_profiles Advertisers can read their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Advertisers can read their own profile" ON public.advertiser_profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: submissions Advertisers can update submissions for their own contests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Advertisers can update submissions for their own contests" ON public.submissions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.contests
  WHERE ((contests.id = submissions.contest_id) AND (contests.advertiser_id = auth.uid())))));


--
-- Name: advertiser_profiles Advertisers can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Advertisers can update their own profile" ON public.advertiser_profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: submissions Advertisers can view submissions for their own contests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Advertisers can view submissions for their own contests" ON public.submissions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.contests
  WHERE ((contests.id = submissions.contest_id) AND (contests.advertiser_id = auth.uid())))));


--
-- Name: advertiser_profiles Advertisers can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Advertisers can view their own profile" ON public.advertiser_profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: submissions Creators can manage their own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can manage their own submissions" ON public.submissions USING ((auth.uid() = creator_id));


--
-- Name: creator_profiles Creators can read their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can read their own profile" ON public.creator_profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: creator_profiles Creators can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can update their own profile" ON public.creator_profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: advertiser_profiles Public can view advertiser profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view advertiser profiles" ON public.advertiser_profiles FOR SELECT USING (true);


--
-- Name: submissions Public can view all submissions for leaderboard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view all submissions for leaderboard" ON public.submissions FOR SELECT USING (true);


--
-- Name: creator_profiles Public can view creator profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view creator profiles" ON public.creator_profiles FOR SELECT USING (true);


--
-- Name: contests Public can view published contests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view published contests" ON public.contests FOR SELECT USING ((moderation_status = 'published'::public.contest_moderation_status_enum));


--
-- Name: subscriptions Service role can delete subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can delete subscriptions" ON public.subscriptions FOR DELETE TO service_role USING (true);


--
-- Name: solana_payment_requests Service role can insert payment requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert payment requests" ON public.solana_payment_requests FOR INSERT WITH CHECK (true);


--
-- Name: subscriptions Service role can insert subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert subscriptions" ON public.subscriptions FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: solana_transactions Service role can insert transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert transactions" ON public.solana_transactions FOR INSERT WITH CHECK (true);


--
-- Name: customers Service role can manage all customer records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all customer records" ON public.customers USING ((auth.role() = 'service_role'::text));


--
-- Name: coin_transactions Service role can manage all transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all transactions" ON public.coin_transactions USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: solana_payment_requests Service role can update payment requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update payment requests" ON public.solana_payment_requests FOR UPDATE USING (true);


--
-- Name: subscriptions Service role can update subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update subscriptions" ON public.subscriptions FOR UPDATE TO service_role USING (true);


--
-- Name: solana_transactions Service role can update transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update transactions" ON public.solana_transactions FOR UPDATE USING (true);


--
-- Name: subscriptions Service role can view all subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can view all subscriptions" ON public.subscriptions FOR SELECT TO service_role USING (true);


--
-- Name: money_transactions Service role full insert access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full insert access" ON public.money_transactions FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: money_transactions Service role full select access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full select access" ON public.money_transactions FOR SELECT TO service_role USING (true);


--
-- Name: money_transactions Service role full update access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full update access" ON public.money_transactions FOR UPDATE TO service_role USING (true);


--
-- Name: money_transactions Users can create own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own transactions" ON public.money_transactions FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: payout_methods Users can delete their own payout methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own payout methods" ON public.payout_methods FOR DELETE TO authenticated USING (((auth.uid() = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND (u.user_type = 'goc_admin'::text)))))));


--
-- Name: customers Users can insert own customer record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own customer record" ON public.customers FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: advertiser_profiles Users can insert their own advertiser profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own advertiser profile" ON public.advertiser_profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: coin_transactions Users can insert their own coin transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own coin transactions" ON public.coin_transactions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: creator_profiles Users can insert their own creator profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own creator profile" ON public.creator_profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: payout_methods Users can insert their own payout methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own payout methods" ON public.payout_methods FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND (u.user_type = 'goc_admin'::text)))))));


--
-- Name: coin_transactions Users can insert their own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own transactions" ON public.coin_transactions FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: users Users can insert their own user record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own user record" ON public.users FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: withdrawal_requests Users can insert their own withdrawal requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own withdrawal requests" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: users Users can read their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own profile" ON public.users FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: customers Users can update own customer record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own customer record" ON public.customers FOR UPDATE USING ((auth.uid() = id));


--
-- Name: money_transactions Users can update own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own transactions" ON public.money_transactions FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND (status = ANY (ARRAY['pending'::text, 'failed'::text])))) WITH CHECK (((auth.uid() = user_id) AND (status = ANY (ARRAY['pending'::text, 'failed'::text, 'cancelled'::text]))));


--
-- Name: creator_profiles Users can update their own creator profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own creator profile" ON public.creator_profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: users Users can update their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own data" ON public.users FOR UPDATE USING ((auth.uid() = id));


--
-- Name: payout_methods Users can update their own payout methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own payout methods" ON public.payout_methods FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND (u.user_type = 'goc_admin'::text))))))) WITH CHECK (((auth.uid() = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND (u.user_type = 'goc_admin'::text)))))));


--
-- Name: users Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: withdrawal_requests Users can update their own withdrawal requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own withdrawal requests" ON public.withdrawal_requests FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: advertiser_profiles Users can view advertiser profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view advertiser profiles" ON public.advertiser_profiles FOR SELECT TO authenticated USING (true);


--
-- Name: users Users can view basic info about other users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view basic info about other users" ON public.users FOR SELECT USING (true);


--
-- Name: customers Users can view own customer record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own customer record" ON public.customers FOR SELECT USING ((auth.uid() = id));


--
-- Name: solana_payment_requests Users can view own payment requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own payment requests" ON public.solana_payment_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: money_transactions Users can view own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own transactions" ON public.money_transactions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: solana_transactions Users can view own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own transactions" ON public.solana_transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: coin_transactions Users can view their own coin transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own coin transactions" ON public.coin_transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: users Users can view their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own data" ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: payout_methods Users can view their own payout methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own payout methods" ON public.payout_methods FOR SELECT TO authenticated USING (((auth.uid() = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND (u.user_type = 'goc_admin'::text)))))));


--
-- Name: coin_transactions Users can view their own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own transactions" ON public.coin_transactions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: users Users can view their own user data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own user data" ON public.users FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: withdrawal_requests Users can view their own withdrawal requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own withdrawal requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: users Users can view user profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view user profiles" ON public.users FOR SELECT TO authenticated USING (true);


--
-- Name: advertiser_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.advertiser_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: coin_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: coin_transactions coin_transactions_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coin_transactions_insert_own ON public.coin_transactions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: coin_transactions coin_transactions_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coin_transactions_select_own ON public.coin_transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: contests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;

--
-- Name: coupon_redemptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: coupon_redemptions coupon_redemptions_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coupon_redemptions_insert_own ON public.coupon_redemptions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: coupon_redemptions coupon_redemptions_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coupon_redemptions_select_own ON public.coupon_redemptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: creator_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: money_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.money_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: payout_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;

--
-- Name: prices prices_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prices_public_read ON public.prices FOR SELECT USING (true);


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products products_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_public_read ON public.products FOR SELECT USING (true);


--
-- Name: solana_payment_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solana_payment_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: solana_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solana_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions subscriptions_user_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscriptions_user_policy ON public.subscriptions USING ((auth.uid() = user_id));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: withdrawal_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

