-- Append-only Meta usage snapshots (X-App-Usage + X-Business-Use-Case-Usage) per Instagram refresh batch or legacy cron run.

CREATE TABLE IF NOT EXISTS public.meta_graph_app_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('instagram_insights_batch', 'instagram_insights_cron')),
  contest_id uuid REFERENCES public.contests(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.instagram_insights_refresh_runs(id) ON DELETE SET NULL,
  batch_index integer,
  call_count integer NOT NULL DEFAULT 0,
  total_time integer NOT NULL DEFAULT 0,
  total_cputime integer NOT NULL DEFAULT 0,
  business_use_case jsonb,
  raw_headers jsonb
);

CREATE INDEX IF NOT EXISTS idx_meta_graph_app_usage_log_created_at
  ON public.meta_graph_app_usage_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_graph_app_usage_log_contest_id
  ON public.meta_graph_app_usage_log (contest_id)
  WHERE contest_id IS NOT NULL;

COMMENT ON TABLE public.meta_graph_app_usage_log IS 'Append-only Meta rate-limit header snapshots after Instagram insights batch/cron work; compare over time.';

ALTER TABLE public.meta_graph_app_usage_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.meta_graph_app_usage_log FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON public.meta_graph_app_usage_log TO service_role;
