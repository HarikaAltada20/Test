-- Remove unused competition_leaderboard_cache (never referenced by app; leaderboard uses in-memory cache).
-- Idempotent: no-op if table was never created (e.g. fresh DB after trimmed 20260430 migration).

DROP TABLE IF EXISTS public.competition_leaderboard_cache CASCADE;
