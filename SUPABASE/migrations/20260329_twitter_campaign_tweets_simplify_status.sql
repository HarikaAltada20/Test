-- Simplify twitter_campaign_tweets: single deleted_at for Twitter-side removal;
-- drop filter_status / is_deleted / deletion_detected_at; track submission-cap hiding explicitly.

ALTER TABLE public.twitter_campaign_tweets
  ADD COLUMN IF NOT EXISTS excluded_by_submission_cap boolean NOT NULL DEFAULT false;

UPDATE public.twitter_campaign_tweets
SET excluded_by_submission_cap = true
WHERE filter_status = 'filtered_out';

-- Tweets still eligible should never carry deletion timestamps (fixes bad rows / refetch not clearing)
UPDATE public.twitter_campaign_tweets
SET deleted_at = NULL
WHERE is_eligible = true AND deleted_at IS NOT NULL;

DROP INDEX IF EXISTS public.idx_twitter_tweets_eligible;
DROP INDEX IF EXISTS public.idx_twitter_tweets_deleted;

ALTER TABLE public.twitter_campaign_tweets
  DROP CONSTRAINT IF EXISTS twitter_campaign_tweets_filter_status_check;

ALTER TABLE public.twitter_campaign_tweets
  DROP COLUMN IF EXISTS filter_status,
  DROP COLUMN IF EXISTS is_deleted,
  DROP COLUMN IF EXISTS deletion_detected_at;

CREATE INDEX idx_twitter_tweets_eligible
  ON public.twitter_campaign_tweets (contest_id, is_eligible)
  WHERE (is_eligible = true AND deleted_at IS NULL);

COMMENT ON COLUMN public.twitter_campaign_tweets.deleted_at IS
  'When set, tweet no longer appears in fetch (removed from Twitter or missing from timeline). NULL = still present. Cleared when a refetch successfully returns the tweet.';

COMMENT ON COLUMN public.twitter_campaign_tweets.excluded_by_submission_cap IS
  'True when demoted because the creator exceeded max submissions (hidden from main lists).';
