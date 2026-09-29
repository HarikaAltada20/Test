-- Speed up duplicate social account ownership checks in OAuth/profile link flows.
-- Query patterns:
--   creator_profiles where instagram_account->>'instagram_user_id' = <platform_user_id>
--   creator_profiles where youtube_account->>'channel_id' = <platform_user_id>
--   creator_profiles where twitter_account->>'twitter_id' = <platform_user_id>

CREATE INDEX IF NOT EXISTS idx_creator_profiles_instagram_user_id
ON public.creator_profiles ((instagram_account->>'instagram_user_id'))
WHERE instagram_account IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_creator_profiles_youtube_channel_id
ON public.creator_profiles ((youtube_account->>'channel_id'))
WHERE youtube_account IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_creator_profiles_twitter_id
ON public.creator_profiles ((twitter_account->>'twitter_id'))
WHERE twitter_account IS NOT NULL;
