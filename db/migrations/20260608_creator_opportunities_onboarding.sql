-- Track whether a creator has completed the campaign onboarding
-- (how to participate + contest types walkthrough).

ALTER TABLE public.creator_profiles
ADD COLUMN IF NOT EXISTS has_seen_campaign_onboarding boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.creator_profiles.has_seen_campaign_onboarding IS
  'True after the creator completes the first-visit campaign onboarding modal.';
