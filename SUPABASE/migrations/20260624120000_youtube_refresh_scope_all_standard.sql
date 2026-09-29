-- Allow all_standard scope on YouTube metrics refresh runs (legacy full refresh without geo detail).
ALTER TABLE public.youtube_metrics_refresh_runs
  DROP CONSTRAINT IF EXISTS youtube_metrics_refresh_runs_scope_check;

ALTER TABLE public.youtube_metrics_refresh_runs
  ADD CONSTRAINT youtube_metrics_refresh_runs_scope_check
  CHECK (scope IN ('basic', 'core', 'traffic', 'demographics', 'all', 'all_standard'));

COMMENT ON COLUMN public.youtube_metrics_refresh_runs.scope IS
  'basic=Data API; core/traffic/demographics=Analytics API slices; all=full refresh; all_standard=legacy all (no cities/states/devices/retention/traffic details).';
