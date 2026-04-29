-- Daily Challenge competition engine (platform-wide, IST calendar boundaries)

CREATE TABLE IF NOT EXISTS public.competition_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  status text NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competition_event_status_check CHECK (status IN ('draft', 'active', 'ended')),
  CONSTRAINT competition_event_range_check CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_competition_event_active
  ON public.competition_event (is_active, status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.competition_eligibility_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.competition_event(id) ON DELETE CASCADE,
  views_min_views bigint NOT NULL DEFAULT 1000,
  reels_min_reels integer NOT NULL DEFAULT 3,
  reels_min_views bigint NOT NULL DEFAULT 1000,
  min_views_per_reel_for_reels_lb bigint NOT NULL DEFAULT 100,
  promote_next_eligible boolean NOT NULL DEFAULT false,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competition_eligibility_event_effective
  ON public.competition_eligibility_config (event_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS public.competition_daily_winner_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.competition_event(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  category text NOT NULL,
  winner_creator_id uuid,
  rank_at_snapshot integer,
  is_eligible boolean NOT NULL DEFAULT false,
  promoted boolean NOT NULL DEFAULT false,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competition_daily_winner_snapshot_category_check CHECK (category IN ('views', 'reels')),
  CONSTRAINT competition_daily_winner_snapshot_unique UNIQUE (event_id, snapshot_date, category)
);

CREATE INDEX IF NOT EXISTS idx_competition_daily_snapshot_lookup
  ON public.competition_daily_winner_snapshot (event_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS public.competition_leaderboard_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.competition_event(id) ON DELETE CASCADE,
  period text NOT NULL,
  scope text NOT NULL,
  page integer NOT NULL,
  per_page integer NOT NULL,
  payload jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT competition_leaderboard_cache_scope_check CHECK (scope IN ('pending', 'verified', 'all'))
);

CREATE INDEX IF NOT EXISTS idx_competition_leaderboard_cache_lookup
  ON public.competition_leaderboard_cache (event_id, period, scope, page, per_page, expires_at DESC);

-- Enable RLS on all new tables
ALTER TABLE public.competition_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_eligibility_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_daily_winner_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_leaderboard_cache ENABLE ROW LEVEL SECURITY;

-- Drop/recreate policies to keep migration idempotent
DROP POLICY IF EXISTS "competition_event_authenticated_read" ON public.competition_event;
DROP POLICY IF EXISTS "competition_event_admin_write" ON public.competition_event;
DROP POLICY IF EXISTS "competition_eligibility_authenticated_read" ON public.competition_eligibility_config;
DROP POLICY IF EXISTS "competition_eligibility_admin_write" ON public.competition_eligibility_config;
DROP POLICY IF EXISTS "competition_winner_snapshot_authenticated_read" ON public.competition_daily_winner_snapshot;
DROP POLICY IF EXISTS "competition_winner_snapshot_admin_write" ON public.competition_daily_winner_snapshot;
DROP POLICY IF EXISTS "competition_cache_admin_only_all" ON public.competition_leaderboard_cache;

-- Public app reads (authenticated users only)
CREATE POLICY "competition_event_authenticated_read"
ON public.competition_event
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "competition_eligibility_authenticated_read"
ON public.competition_eligibility_config
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "competition_winner_snapshot_authenticated_read"
ON public.competition_daily_winner_snapshot
FOR SELECT
TO authenticated
USING (true);

-- Admin writes
CREATE POLICY "competition_event_admin_write"
ON public.competition_event
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
  )
);

CREATE POLICY "competition_eligibility_admin_write"
ON public.competition_eligibility_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
  )
);

CREATE POLICY "competition_winner_snapshot_admin_write"
ON public.competition_daily_winner_snapshot
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
  )
);

-- Cache table is internal: admin-only for now
CREATE POLICY "competition_cache_admin_only_all"
ON public.competition_leaderboard_cache
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
  )
);
