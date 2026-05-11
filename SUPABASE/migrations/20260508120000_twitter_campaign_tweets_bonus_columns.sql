-- Track per-tweet flat-fee bonus payout state for Twitter CPM/leaderboard flows.
ALTER TABLE public.twitter_campaign_tweets
  ADD COLUMN IF NOT EXISTS bonus_paid boolean DEFAULT false NOT NULL;

ALTER TABLE public.twitter_campaign_tweets
  ADD COLUMN IF NOT EXISTS bonus_paid_at timestamptz;

ALTER TABLE public.twitter_campaign_tweets
  ADD COLUMN IF NOT EXISTS bonus_amount integer;

COMMENT ON COLUMN public.twitter_campaign_tweets.bonus_paid IS
  'True when flat-fee bonus for this tweet has been credited.';

COMMENT ON COLUMN public.twitter_campaign_tweets.bonus_paid_at IS
  'Timestamp when flat-fee bonus payment was recorded for this tweet.';

COMMENT ON COLUMN public.twitter_campaign_tweets.bonus_amount IS
  'Flat-fee bonus amount credited for this tweet in cents.';
