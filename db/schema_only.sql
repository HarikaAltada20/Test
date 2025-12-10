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
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: hypopg; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS hypopg WITH SCHEMA extensions;


--
-- Name: EXTENSION hypopg; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION hypopg IS 'Hypothetical indexes for PostgreSQL';


--
-- Name: index_advisor; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS index_advisor WITH SCHEMA extensions;


--
-- Name: EXTENSION index_advisor; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION index_advisor IS 'Query index advisor';


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: pgjwt; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;


--
-- Name: EXTENSION pgjwt; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgjwt IS 'JSON Web Token API for Postgresql';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


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
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


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
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: lock_top_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


--
-- Name: objects_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: objects_update_level_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_level_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


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
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: messages_2025_07_03; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_07_03 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2025_07_04; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_07_04 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2025_07_05; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_07_05 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2025_07_06; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_07_06 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2025_07_07; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_07_07 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: seed_files; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.seed_files (
    path text NOT NULL,
    hash text NOT NULL
);


--
-- Name: messages_2025_07_03; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_07_03 FOR VALUES FROM ('2025-07-03 00:00:00') TO ('2025-07-04 00:00:00');


--
-- Name: messages_2025_07_04; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_07_04 FOR VALUES FROM ('2025-07-04 00:00:00') TO ('2025-07-05 00:00:00');


--
-- Name: messages_2025_07_05; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_07_05 FOR VALUES FROM ('2025-07-05 00:00:00') TO ('2025-07-06 00:00:00');


--
-- Name: messages_2025_07_06; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_07_06 FOR VALUES FROM ('2025-07-06 00:00:00') TO ('2025-07-07 00:00:00');


--
-- Name: messages_2025_07_07; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_07_07 FOR VALUES FROM ('2025-07-07 00:00:00') TO ('2025-07-08 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


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
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_07_03 messages_2025_07_03_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_07_03
    ADD CONSTRAINT messages_2025_07_03_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_07_04 messages_2025_07_04_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_07_04
    ADD CONSTRAINT messages_2025_07_04_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_07_05 messages_2025_07_05_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_07_05
    ADD CONSTRAINT messages_2025_07_05_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_07_06 messages_2025_07_06_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_07_06
    ADD CONSTRAINT messages_2025_07_06_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_07_07 messages_2025_07_07_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_07_07
    ADD CONSTRAINT messages_2025_07_07_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: seed_files seed_files_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.seed_files
    ADD CONSTRAINT seed_files_pkey PRIMARY KEY (path);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


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
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2025_07_03_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2025_07_03_inserted_at_topic_idx ON realtime.messages_2025_07_03 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2025_07_04_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2025_07_04_inserted_at_topic_idx ON realtime.messages_2025_07_04 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2025_07_05_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2025_07_05_inserted_at_topic_idx ON realtime.messages_2025_07_05 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2025_07_06_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2025_07_06_inserted_at_topic_idx ON realtime.messages_2025_07_06 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2025_07_07_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2025_07_07_inserted_at_topic_idx ON realtime.messages_2025_07_07 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: messages_2025_07_03_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_07_03_inserted_at_topic_idx;


--
-- Name: messages_2025_07_03_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_07_03_pkey;


--
-- Name: messages_2025_07_04_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_07_04_inserted_at_topic_idx;


--
-- Name: messages_2025_07_04_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_07_04_pkey;


--
-- Name: messages_2025_07_05_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_07_05_inserted_at_topic_idx;


--
-- Name: messages_2025_07_05_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_07_05_pkey;


--
-- Name: messages_2025_07_06_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_07_06_inserted_at_topic_idx;


--
-- Name: messages_2025_07_06_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_07_06_pkey;


--
-- Name: messages_2025_07_07_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_07_07_inserted_at_topic_idx;


--
-- Name: messages_2025_07_07_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_07_07_pkey;


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
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


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
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

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
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Contest-assets full permission 13wn2vw_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Contest-assets full permission 13wn2vw_0" ON storage.objects FOR SELECT TO authenticated, anon, service_role, supabase_replication_admin, supabase_read_only_user, supabase_realtime_admin USING ((bucket_id = 'contest-assets'::text));


--
-- Name: objects Contest-assets full permission 13wn2vw_1; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Contest-assets full permission 13wn2vw_1" ON storage.objects FOR INSERT TO authenticated, anon, service_role, supabase_replication_admin, supabase_read_only_user, supabase_realtime_admin WITH CHECK ((bucket_id = 'contest-assets'::text));


--
-- Name: objects Contest-assets full permission 13wn2vw_2; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Contest-assets full permission 13wn2vw_2" ON storage.objects FOR UPDATE TO authenticated, anon, service_role, supabase_replication_admin, supabase_read_only_user, supabase_realtime_admin USING ((bucket_id = 'contest-assets'::text));


--
-- Name: objects Contest-assets full permission 13wn2vw_3; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Contest-assets full permission 13wn2vw_3" ON storage.objects FOR DELETE TO authenticated, anon, service_role, supabase_replication_admin, supabase_read_only_user, supabase_realtime_admin USING ((bucket_id = 'contest-assets'::text));


--
-- Name: objects Profile-Images full permission vejz8c_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Profile-Images full permission vejz8c_0" ON storage.objects FOR SELECT TO authenticated, anon, service_role, supabase_replication_admin, supabase_read_only_user, supabase_realtime_admin USING ((bucket_id = 'profile-images'::text));


--
-- Name: objects Profile-Images full permission vejz8c_1; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Profile-Images full permission vejz8c_1" ON storage.objects FOR INSERT TO authenticated, anon, service_role, supabase_replication_admin, supabase_read_only_user, supabase_realtime_admin WITH CHECK ((bucket_id = 'profile-images'::text));


--
-- Name: objects Profile-Images full permission vejz8c_2; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Profile-Images full permission vejz8c_2" ON storage.objects FOR UPDATE TO authenticated, anon, service_role, supabase_replication_admin, supabase_read_only_user, supabase_realtime_admin USING ((bucket_id = 'profile-images'::text));


--
-- Name: objects Profile-Images full permission vejz8c_3; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Profile-Images full permission vejz8c_3" ON storage.objects FOR DELETE TO authenticated, anon, service_role, supabase_replication_admin, supabase_read_only_user, supabase_realtime_admin USING ((bucket_id = 'profile-images'::text));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets full-permission; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "full-permission" ON storage.buckets TO authenticated, anon, service_role, supabase_replication_admin, supabase_read_only_user, supabase_realtime_admin;


--
-- Name: objects full-permission; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "full-permission" ON storage.objects TO authenticated, anon, service_role, supabase_replication_admin, supabase_read_only_user, supabase_realtime_admin;


--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: -
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

