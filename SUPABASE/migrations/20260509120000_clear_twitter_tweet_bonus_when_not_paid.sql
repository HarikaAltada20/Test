-- Repair inconsistent rows: bonus_paid was set while the tweet was never CPM-paid.
-- After apply, UI and payouts align with moderation_status = 'paid' for flat-fee bonus.
UPDATE public.twitter_campaign_tweets t
SET
  bonus_paid = false,
  bonus_paid_at = NULL,
  bonus_amount = NULL
FROM public.contests c
WHERE
  t.contest_id = c.id
  AND (c.platform ILIKE 'twitter' OR c.platform ILIKE 'x')
  AND c.contest_type = 'cpm'
  AND t.moderation_status IS DISTINCT FROM 'paid'
  AND t.bonus_paid = true;
