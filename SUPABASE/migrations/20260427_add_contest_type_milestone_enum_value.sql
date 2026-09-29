-- Milestone contest type (see docs/MILESTONE_CONTEST_GUIDE.md)
-- Must run before creating contests with contest_type = 'milestone'.

DO $$
BEGIN
  ALTER TYPE public.contest_type_enum ADD VALUE 'milestone';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;
