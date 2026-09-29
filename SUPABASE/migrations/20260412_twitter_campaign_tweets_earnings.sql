-- Per-tweet CPM amount actually credited (cents), for admin UI and cap accuracy after bulk pay.
ALTER TABLE public.twitter_campaign_tweets
  ADD COLUMN IF NOT EXISTS earnings integer;

COMMENT ON COLUMN public.twitter_campaign_tweets.earnings IS
  'CPM reward credited for this tweet in cents (set when marked paid; supports bulk and per-tweet payouts).';
