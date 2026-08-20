create table if not exists public.bulk_payment_jobs (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  user_type text not null check (user_type in ('admin', 'advertiser')),
  payment_type text not null check (payment_type in ('standard', 'bonus', 'both')),
  payout_channel text not null default 'submissions'
    check (payout_channel in ('submissions', 'twitter_cpm')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  total_count integer not null default 0,
  processed_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  total_amount_cents bigint not null default 0,
  total_cpm_cents bigint not null default 0,
  total_bonus_cents bigint not null default 0,
  total_milestone_cents bigint not null default 0,
  error_message text null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index if not exists bulk_payment_jobs_user_idx
  on public.bulk_payment_jobs (user_id, created_at desc);

create index if not exists bulk_payment_jobs_status_idx
  on public.bulk_payment_jobs (status, created_at desc);

create index if not exists bulk_payment_jobs_contest_idx
  on public.bulk_payment_jobs (contest_id, created_at desc);

create or replace function public.set_bulk_payment_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bulk_payment_jobs_updated_at
  on public.bulk_payment_jobs;

create trigger trg_bulk_payment_jobs_updated_at
before update on public.bulk_payment_jobs
for each row
execute function public.set_bulk_payment_jobs_updated_at();
