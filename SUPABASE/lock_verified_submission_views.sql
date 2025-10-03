-- Locks views for all verified submissions of a contest in one statement
-- Idempotent: updates only when the snapshot differs
-- Usage: select public.lock_verified_submission_views('00000000-0000-0000-0000-000000000000');

create or replace function public.lock_verified_submission_views(p_contest_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  with upd as (
    update submissions
       set views_locked = coalesce(views, 0)
     where contest_id = p_contest_id
       and status = 'verified'
       and (views_locked is distinct from coalesce(views, 0))
     returning 1
  )
  select count(*)::int from upd;
$$;

comment on function public.lock_verified_submission_views(uuid)
is 'Snapshot verified submissions: views_locked := views for a given contest (idempotent). Returns number of rows updated.';

