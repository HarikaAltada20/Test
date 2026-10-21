-- Admin user search with field scopes and ranking, used by the Manual Entry modal.
--
-- public.admin_search_users(p_scope, p_query, p_user_type, p_limit)
--   p_scope     'all' | 'username' | 'name' | 'email' | 'id'
--   p_query     search text (trimmed, case-insensitive; LIKE wildcards are escaped)
--   p_user_type 'all' | 'creator' | 'advertiser' | 'admin'
--   p_limit     1..50
--
-- Ranking per matched field: 0 exact, 1 starts with (or, for names, any word
-- starts with), 2 contains. The User ID scope matches a full UUID exactly or an
-- ID prefix. Only service_role can execute it; the API route checks that the
-- caller is an admin before calling it with the admin client.

CREATE OR REPLACE FUNCTION public.admin_search_match_rank(
  p_value text,
  p_query text,
  p_query_escaped text,
  p_word_starts boolean DEFAULT false
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_value IS NULL OR p_query IS NULL OR p_query = '' THEN NULL
    WHEN lower(p_value) = p_query THEN 0
    WHEN lower(p_value) LIKE p_query_escaped || '%' ESCAPE '\' THEN 1
    WHEN p_word_starts
      AND lower(p_value) LIKE '% ' || p_query_escaped || '%' ESCAPE '\' THEN 1
    WHEN lower(p_value) LIKE '%' || p_query_escaped || '%' ESCAPE '\' THEN 2
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.admin_search_users(
  p_scope text,
  p_query text,
  p_user_type text DEFAULT 'all',
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  email text,
  user_type text,
  coins bigint,
  profile_picture_url text,
  matched_field text,
  match_rank integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope text := lower(coalesce(p_scope, 'all'));
  v_type text := lower(coalesce(p_user_type, 'all'));
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_qe text;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_is_uuid boolean;
BEGIN
  IF v_scope NOT IN ('all', 'username', 'name', 'email', 'id') THEN
    RAISE EXCEPTION 'invalid scope: %', p_scope USING ERRCODE = '22023';
  END IF;
  IF v_type NOT IN ('all', 'creator', 'advertiser', 'admin') THEN
    RAISE EXCEPTION 'invalid user type: %', p_user_type USING ERRCODE = '22023';
  END IF;
  IF v_q = '' THEN
    RETURN;
  END IF;

  v_qe := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  v_is_uuid := v_q ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  RETURN QUERY
  SELECT
    u.id,
    u.full_name,
    u.username,
    u.email,
    u.user_type,
    u.coins,
    u.profile_picture_url,
    m.field,
    m.rank
  FROM public.users u
  CROSS JOIN LATERAL (
    SELECT f.field, f.rank
    FROM (
      VALUES
        ('id', CASE
          WHEN v_scope IN ('all', 'id') AND v_is_uuid AND u.id::text = v_q THEN 0
          WHEN v_scope = 'id' AND u.id::text LIKE v_qe || '%' ESCAPE '\' THEN 1
        END),
        ('username', CASE WHEN v_scope IN ('all', 'username')
          THEN public.admin_search_match_rank(u.username, v_q, v_qe) END),
        ('email', CASE WHEN v_scope IN ('all', 'email')
          THEN public.admin_search_match_rank(u.email, v_q, v_qe) END),
        ('name', CASE WHEN v_scope IN ('all', 'name')
          THEN public.admin_search_match_rank(u.full_name, v_q, v_qe, true) END)
    ) AS f(field, rank)
    WHERE f.rank IS NOT NULL
    ORDER BY f.rank
    LIMIT 1
  ) m
  WHERE v_type = 'all' OR u.user_type = v_type
  ORDER BY m.rank, length(coalesce(u.username, u.full_name, '')), u.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_match_rank(text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_search_users(text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_match_rank(text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_search_users(text, text, text, integer) TO service_role;
