-- Speed up duplicate TikTok account ownership checks in OAuth callback flow.
-- Query pattern: creator_profiles where tiktok_account->>'platform_user_id' = <open_id>
CREATE INDEX IF NOT EXISTS idx_creator_profiles_tiktok_platform_user_id
ON public.creator_profiles ((tiktok_account->>'platform_user_id'))
WHERE tiktok_account IS NOT NULL;
