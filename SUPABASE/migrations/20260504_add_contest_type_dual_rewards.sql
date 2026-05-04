-- Dual Rewards: CPM (per view) + milestone payouts .
DO $$
BEGIN
  ALTER TYPE public.contest_type_enum ADD VALUE 'dual_rewards';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;
