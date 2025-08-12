-- Helper tables for idempotent, application-level metrics

create table if not exists public.creator_contest_participations (
  creator_id uuid not null references public.users(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  first_submission_id uuid,
  created_at timestamptz not null default now(),
  primary key (creator_id, contest_id)
);

create table if not exists public.submission_views_credited (
  submission_id uuid primary key references public.submissions(id) on delete cascade,
  credited_views bigint not null default 0,
  credited_at timestamptz not null default now()
);


