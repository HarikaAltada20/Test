-- Account switcher shared-pool RPCs for atomic link/unlink operations.
-- These run inside a single DB transaction to avoid partial graph updates.

CREATE INDEX IF NOT EXISTS idx_user_sessions_vault_target_user
  ON public.user_sessions_vault (target_user_id);

CREATE OR REPLACE FUNCTION public.account_switch_link_shared_pool(
  p_owner_user_id UUID,
  p_target_user_id UUID,
  p_owner_encrypted_refresh TEXT,
  p_target_encrypted_refresh TEXT,
  p_target_email_hint TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_ids UUID[];
  v_member_count INTEGER;
  v_missing_count INTEGER;
BEGIN
  IF p_owner_user_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing owner or target');
  END IF;

  IF p_owner_user_id = p_target_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot link account to itself');
  END IF;

  IF p_owner_encrypted_refresh IS NULL OR p_target_encrypted_refresh IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing refresh token payload');
  END IF;

  -- Lock both endpoints consistently to avoid concurrent link/unlink races.
  IF p_owner_user_id::TEXT < p_target_user_id::TEXT THEN
    PERFORM pg_advisory_xact_lock(hashtext('account-switch:' || p_owner_user_id::TEXT));
    PERFORM pg_advisory_xact_lock(hashtext('account-switch:' || p_target_user_id::TEXT));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext('account-switch:' || p_target_user_id::TEXT));
    PERFORM pg_advisory_xact_lock(hashtext('account-switch:' || p_owner_user_id::TEXT));
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT x.id
    FROM (
      SELECT p_owner_user_id AS id
      UNION ALL
      SELECT p_target_user_id AS id
      UNION ALL
      SELECT usv.target_user_id AS id
      FROM public.user_sessions_vault usv
      WHERE usv.owner_user_id = p_owner_user_id
    ) AS x
    WHERE x.id IS NOT NULL
  )
  INTO v_member_ids;

  v_member_count := COALESCE(array_length(v_member_ids, 1), 0);

  -- 5 linked accounts max per owner => max pool size 6 including active owner.
  IF v_member_count > 6 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Maximum account limit reached (5 accounts). Remove an existing account to add a new one.'
    );
  END IF;

  -- Check each impacted owner won't exceed link cap after full-mesh sync.
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        m.owner_id,
        COALESCE(
          SUM(CASE WHEN usv.target_user_id = ANY(v_member_ids) THEN 0 ELSE 1 END),
          0
        ) AS outside_count
      FROM unnest(v_member_ids) AS m(owner_id)
      LEFT JOIN public.user_sessions_vault usv
        ON usv.owner_user_id = m.owner_id
      GROUP BY m.owner_id
    ) q
    WHERE q.outside_count + (v_member_count - 1) > 5
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'One linked account is already at the maximum limit. Unlink an account from that profile and try again.'
    );
  END IF;

  CREATE TEMP TABLE _as_member_tokens (
    user_id UUID PRIMARY KEY,
    encrypted_token TEXT NOT NULL,
    email_hint TEXT
  ) ON COMMIT DROP;

  INSERT INTO _as_member_tokens (user_id, encrypted_token, email_hint)
  VALUES
    (p_owner_user_id, p_owner_encrypted_refresh, NULL),
    (p_target_user_id, p_target_encrypted_refresh, p_target_email_hint)
  ON CONFLICT (user_id) DO UPDATE
  SET
    encrypted_token = EXCLUDED.encrypted_token,
    email_hint = COALESCE(EXCLUDED.email_hint, _as_member_tokens.email_hint);

  -- Pull encrypted token payload for existing pool members from owner's rows.
  INSERT INTO _as_member_tokens (user_id, encrypted_token, email_hint)
  SELECT
    usv.target_user_id,
    usv.encrypted_refresh_token,
    usv.linked_target_email
  FROM public.user_sessions_vault usv
  WHERE usv.owner_user_id = p_owner_user_id
    AND usv.target_user_id = ANY(v_member_ids)
    AND usv.target_user_id <> p_target_user_id
  ON CONFLICT (user_id) DO UPDATE
  SET
    encrypted_token = EXCLUDED.encrypted_token,
    email_hint = COALESCE(_as_member_tokens.email_hint, EXCLUDED.email_hint);

  -- If any member token is missing, don't partially mutate.
  SELECT COUNT(*)
  INTO v_missing_count
  FROM unnest(v_member_ids) m(user_id)
  LEFT JOIN _as_member_tokens t ON t.user_id = m.user_id
  WHERE t.user_id IS NULL;

  IF v_missing_count > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'One linked account needs re-link before adding another account to the shared pool'
    );
  END IF;

  INSERT INTO public.user_sessions_vault (
    owner_user_id,
    target_user_id,
    encrypted_refresh_token,
    updated_at,
    linked_target_email
  )
  SELECT
    owners.owner_id,
    targets.user_id,
    targets.encrypted_token,
    NOW(),
    targets.email_hint
  FROM unnest(v_member_ids) AS owners(owner_id)
  CROSS JOIN _as_member_tokens AS targets
  WHERE owners.owner_id <> targets.user_id
  ON CONFLICT (owner_user_id, target_user_id) DO UPDATE
  SET
    encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
    updated_at = EXCLUDED.updated_at,
    linked_target_email = COALESCE(EXCLUDED.linked_target_email, public.user_sessions_vault.linked_target_email);

  RETURN jsonb_build_object('ok', true, 'pool_size', v_member_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.account_switch_unlink_from_pool(
  p_owner_user_id UUID,
  p_target_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_ids UUID[];
  v_deleted_count INTEGER := 0;
BEGIN
  IF p_owner_user_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing owner or target');
  END IF;

  IF p_owner_user_id = p_target_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot unlink active account');
  END IF;

  IF p_owner_user_id::TEXT < p_target_user_id::TEXT THEN
    PERFORM pg_advisory_xact_lock(hashtext('account-switch:' || p_owner_user_id::TEXT));
    PERFORM pg_advisory_xact_lock(hashtext('account-switch:' || p_target_user_id::TEXT));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext('account-switch:' || p_target_user_id::TEXT));
    PERFORM pg_advisory_xact_lock(hashtext('account-switch:' || p_owner_user_id::TEXT));
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT x.id
    FROM (
      SELECT p_owner_user_id AS id
      UNION ALL
      SELECT usv.target_user_id AS id
      FROM public.user_sessions_vault usv
      WHERE usv.owner_user_id = p_owner_user_id
    ) AS x
    WHERE x.id IS NOT NULL
  )
  INTO v_member_ids;

  IF NOT (p_target_user_id = ANY(v_member_ids)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_LINK');
  END IF;

  DELETE FROM public.user_sessions_vault usv
  WHERE
    (usv.owner_user_id = ANY(v_member_ids) AND usv.target_user_id = p_target_user_id)
    OR
    (usv.owner_user_id = p_target_user_id AND usv.target_user_id = ANY(v_member_ids));

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'removed_edges', v_deleted_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.account_switch_propagate_refresh_tokens(
  p_current_user_id UUID,
  p_target_user_id UUID,
  p_current_encrypted_refresh TEXT,
  p_target_encrypted_refresh TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  IF p_current_user_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing current or target user');
  END IF;

  IF p_current_encrypted_refresh IS NULL OR p_target_encrypted_refresh IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing encrypted refresh token payload');
  END IF;

  -- Lock both endpoints consistently to avoid overlap with link/unlink mutations.
  IF p_current_user_id::TEXT < p_target_user_id::TEXT THEN
    PERFORM pg_advisory_xact_lock(hashtext('account-switch:' || p_current_user_id::TEXT));
    PERFORM pg_advisory_xact_lock(hashtext('account-switch:' || p_target_user_id::TEXT));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext('account-switch:' || p_target_user_id::TEXT));
    PERFORM pg_advisory_xact_lock(hashtext('account-switch:' || p_current_user_id::TEXT));
  END IF;

  UPDATE public.user_sessions_vault usv
  SET
    encrypted_refresh_token = CASE
      WHEN usv.target_user_id = p_target_user_id THEN p_target_encrypted_refresh
      WHEN usv.target_user_id = p_current_user_id THEN p_current_encrypted_refresh
      ELSE usv.encrypted_refresh_token
    END,
    updated_at = NOW()
  WHERE usv.target_user_id IN (p_target_user_id, p_current_user_id);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'updated_rows', v_updated_count);
END;
$$;

-- Lock down SECURITY DEFINER RPCs: callable only by service_role.
REVOKE ALL ON FUNCTION public.account_switch_link_shared_pool(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_switch_link_shared_pool(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.account_switch_unlink_from_pool(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_switch_unlink_from_pool(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.account_switch_propagate_refresh_tokens(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_switch_propagate_refresh_tokens(UUID, UUID, TEXT, TEXT) TO service_role;
