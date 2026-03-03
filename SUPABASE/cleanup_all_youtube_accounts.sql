-- Clear all YouTube accounts from creator_profiles
-- Use when you want to remove every creator's YouTube connection (e.g. before re-auth strategy).
-- Run in Supabase SQL Editor or via: psql $DATABASE_URL -f SUPABASE/cleanup_all_youtube_accounts.sql

-- Optional: see how many rows will be affected (uncomment to run first)
-- SELECT count(*) AS profiles_with_youtube
-- FROM creator_profiles
-- WHERE youtube_account IS NOT NULL;

BEGIN;

UPDATE creator_profiles
SET
  youtube_account = NULL,
  updated_at = now()
WHERE youtube_account IS NOT NULL;

-- Optional: verify (uncomment to run in same transaction)
-- SELECT count(*) AS still_has_youtube FROM creator_profiles WHERE youtube_account IS NOT NULL;

COMMIT;
