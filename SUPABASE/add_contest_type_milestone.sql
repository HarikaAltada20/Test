-- Milestone-based video contests (see docs/MILESTONE_CONTEST_GUIDE.md)
-- Run on Supabase before creating contests with contest_type = 'milestone'.

DO $$
BEGIN
  ALTER TYPE public.contest_type_enum ADD VALUE 'milestone';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;
