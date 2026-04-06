-- Latest X-App-Usage snapshot from Instagram Graph responses (batch/cron via lib/instagram-insights). Service role only.

CREATE TABLE IF NOT EXISTS public.meta_graph_app_usage (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  call_count integer NOT NULL DEFAULT 0,
  total_time integer NOT NULL DEFAULT 0,
  total_cputime integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  raw_headers jsonb
);

INSERT INTO public.meta_graph_app_usage (id, call_count, total_time, total_cputime)
VALUES ('default', 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.meta_graph_app_usage IS 'Rolling usage % from Meta X-App-Usage (call_count, total_time, total_cputime); updated on each Instagram Graph call that returns the header.';

ALTER TABLE public.meta_graph_app_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.meta_graph_app_usage FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_graph_app_usage TO service_role;
