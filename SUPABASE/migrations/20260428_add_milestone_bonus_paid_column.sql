-- Add milestone_bonus_paid as a first-class column on submissions
-- This replaces storing { reels, views } tracking under submissions.metadata.milestone_bonus_paid

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS milestone_bonus_paid jsonb;

COMMENT ON COLUMN public.submissions.milestone_bonus_paid IS
  'Milestone contest bonus tracking (cents) paid for most-verified tracks. Shape: {"reels": number, "views": number}.';

-- Backfill from metadata (if any historical rows stored it there)
UPDATE public.submissions
SET milestone_bonus_paid = metadata->'milestone_bonus_paid'
WHERE milestone_bonus_paid IS NULL
  AND metadata IS NOT NULL
  AND jsonb_typeof(metadata) = 'object'
  AND (metadata ? 'milestone_bonus_paid');

-- Optional cleanup: remove the key from metadata to avoid duplicated sources of truth
UPDATE public.submissions
SET metadata = metadata - 'milestone_bonus_paid'
WHERE metadata IS NOT NULL
  AND jsonb_typeof(metadata) = 'object'
  AND (metadata ? 'milestone_bonus_paid');

