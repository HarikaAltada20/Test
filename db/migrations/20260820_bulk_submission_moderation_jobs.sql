create table if not exists public.bulk_submission_moderation_jobs (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  user_type text not null check (user_type in ('admin', 'advertiser')),
  action text not null check (action in ('verified', 'pending', 'rejected')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  total_count integer not null default 0,
  processed_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  quality_score integer null check (quality_score in (1, 2, 3)),
  reason text null,
  payload jsonb null,
  queue_offset integer not null default 0,
  error_message text null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  updated_at timestamptz not null default now()
);

-- Upgrade path if an earlier draft of this migration was already applied.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bulk_submission_moderation_jobs'
      and column_name = 'actor_id'
  ) then
    alter table public.bulk_submission_moderation_jobs
      rename column actor_id to user_id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bulk_submission_moderation_jobs'
      and column_name = 'actor_role'
  ) then
    alter table public.bulk_submission_moderation_jobs
      rename column actor_role to user_type;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bulk_submission_moderation_jobs'
      and column_name = 'submission_ids'
  ) then
    alter table public.bulk_submission_moderation_jobs
      drop column submission_ids;
  end if;
end $$;

drop index if exists bulk_submission_moderation_jobs_actor_idx;

create index if not exists bulk_submission_moderation_jobs_user_idx
  on public.bulk_submission_moderation_jobs (user_id, created_at desc);

create index if not exists bulk_submission_moderation_jobs_status_idx
  on public.bulk_submission_moderation_jobs (status, created_at desc);

create index if not exists bulk_submission_moderation_jobs_contest_idx
  on public.bulk_submission_moderation_jobs (contest_id, created_at desc);

create or replace function public.set_bulk_submission_moderation_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bulk_submission_moderation_jobs_updated_at
  on public.bulk_submission_moderation_jobs;

create trigger trg_bulk_submission_moderation_jobs_updated_at
before update on public.bulk_submission_moderation_jobs
for each row
execute function public.set_bulk_submission_moderation_jobs_updated_at();

-- Aggregated wallet reversal totals for completion toast (one txn per creator at job start).
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bulk_submission_moderation_jobs'
      and column_name = 'wallet_refund_summary'
  ) then
    alter table public.bulk_submission_moderation_jobs
      add column wallet_refund_summary jsonb null;
  end if;
end $$;
