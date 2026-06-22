-- Prevent duplicate submissions: same creator cannot submit the same video_id twice to one contest.
--
-- PRE-DEPLOY (run in Supabase SQL editor before applying this migration):
--
--   SELECT
--     contest_id,
--     creator_id,
--     video_id,
--     COUNT(*) AS dup_count,
--     array_agg(id ORDER BY created_at) AS submission_ids,
--     array_agg(created_at ORDER BY created_at) AS submitted_at
--   FROM submissions
--   WHERE video_id IS NOT NULL
--   GROUP BY contest_id, creator_id, video_id
--   HAVING COUNT(*) > 1
--   ORDER BY dup_count DESC;
--
-- For each group, keep the earliest row and delete/resolve the rest manually.
-- Migration will fail if duplicates remain.

CREATE UNIQUE INDEX IF NOT EXISTS ux_submissions_contest_creator_video
ON public.submissions (contest_id, creator_id, video_id)
WHERE video_id IS NOT NULL;
