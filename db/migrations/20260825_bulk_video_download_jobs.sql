-- Lean bulk video download sessions.
-- Per-video outcomes live in bulk_video_download_job_items (scales to 10k+ rows).
create table if not exists public.bulk_video_download_jobs (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  user_type text not null check (user_type in ('admin', 'advertiser')),
  scope text not null default 'normal' check (scope in ('normal', 'creator')),
  status text not null default 'running'
    check (status in ('queued', 'running', 'completed', 'failed')),
  total_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  -- 1-based current ZIP part (e.g. 3) and how many ZIP parts in this download (e.g. 7)
  zip_part_index integer not null default 1,
  zip_part_total integer not null default 1,
  videos_per_zip integer not null default 10,
  naming_pattern text null,
  file_name_prefix text null,
  -- Ordered submission UUIDs for this download (no per-row meta here).
  submission_ids uuid[] not null default '{}',
  -- Lean ZIP parts: [{jobId, zipPartIndex, zipPartTotal, zipFilename, submissionIds[]}]
  zip_parts jsonb null,
  error_message text null,
  -- Set when user opens the finished Download summary (hides floating button after).
  summary_viewed boolean not null default false,
  summary_viewed_at timestamptz null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  updated_at timestamptz not null default now()
);

create table if not exists public.bulk_video_download_job_items (
  job_id uuid not null references public.bulk_video_download_jobs(id) on delete cascade,
  submission_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  error_message text null,
  updated_at timestamptz not null default now(),
  primary key (job_id, submission_id)
);

create index if not exists bulk_video_download_job_items_job_status_idx
  on public.bulk_video_download_job_items (job_id, status);

-- Upgrade path from earlier drafts (creator_id / payload / item_statuses jsonb).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bulk_video_download_jobs'
      and column_name = 'creator_id'
  ) then
    alter table public.bulk_video_download_jobs drop column creator_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bulk_video_download_jobs'
      and column_name = 'payload'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bulk_video_download_jobs'
      and column_name = 'submission_ids'
  ) then
    alter table public.bulk_video_download_jobs
      add column submission_ids uuid[] not null default '{}',
      add column zip_parts jsonb null;

    update public.bulk_video_download_jobs
    set
      submission_ids = coalesce(
        (
          select array_agg(x::uuid)
          from jsonb_array_elements_text(payload->'submissionIds') as t(x)
          where x ~* '^[0-9a-f-]{36}$'
        ),
        '{}'
      ),
      zip_parts = coalesce(payload->'jobs', payload->'zip_parts')
    where payload is not null;

    alter table public.bulk_video_download_jobs drop column payload;
  end if;

  -- Move legacy item_statuses jsonb into normalized item rows, then drop it.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bulk_video_download_jobs'
      and column_name = 'item_statuses'
  ) then
    insert into public.bulk_video_download_job_items (
      job_id, submission_id, status, error_message
    )
    select
      j.id,
      (item->>'submissionId')::uuid,
      case
        when item->>'status' in ('success', 'failed', 'pending') then item->>'status'
        else 'pending'
      end,
      nullif(item->>'error', '')
    from public.bulk_video_download_jobs j
    cross join lateral jsonb_array_elements(coalesce(j.item_statuses, '[]'::jsonb))
      with ordinality as ord(item, ordinality)
    where (item->>'submissionId') ~* '^[0-9a-f-]{36}$'
    on conflict (job_id, submission_id) do update
      set
        status = excluded.status,
        error_message = excluded.error_message,
        updated_at = now();

    alter table public.bulk_video_download_jobs drop column item_statuses;
  end if;

  -- Drop obsolete sort_order (order comes from jobs.submission_ids).
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bulk_video_download_job_items'
      and column_name = 'sort_order'
  ) then
    drop index if exists public.bulk_video_download_job_items_job_sort_idx;
    alter table public.bulk_video_download_job_items drop column sort_order;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bulk_video_download_jobs'
      and column_name = 'summary_viewed'
  ) then
    alter table public.bulk_video_download_jobs
      add column summary_viewed boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bulk_video_download_jobs'
      and column_name = 'summary_viewed_at'
  ) then
    alter table public.bulk_video_download_jobs
      add column summary_viewed_at timestamptz null;
  end if;

  update public.bulk_video_download_jobs
  set summary_viewed = true
  where summary_viewed_at is not null
    and summary_viewed = false;
end $$;

create index if not exists bulk_video_download_jobs_user_idx
  on public.bulk_video_download_jobs (user_id, created_at desc);

create index if not exists bulk_video_download_jobs_contest_idx
  on public.bulk_video_download_jobs (contest_id, created_at desc);

create index if not exists bulk_video_download_jobs_status_idx
  on public.bulk_video_download_jobs (status, updated_at desc);

create index if not exists bulk_video_download_jobs_user_contest_idx
  on public.bulk_video_download_jobs (user_id, contest_id, created_at desc);

create or replace function public.set_bulk_video_download_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bulk_video_download_jobs_updated_at
  on public.bulk_video_download_jobs;

create trigger trg_bulk_video_download_jobs_updated_at
before update on public.bulk_video_download_jobs
for each row
execute function public.set_bulk_video_download_jobs_updated_at();

alter table public.bulk_video_download_jobs enable row level security;
alter table public.bulk_video_download_job_items enable row level security;

revoke all on table public.bulk_video_download_jobs from anon, authenticated;
revoke all on table public.bulk_video_download_job_items from anon, authenticated;
grant all on table public.bulk_video_download_jobs to service_role;
grant all on table public.bulk_video_download_job_items to service_role;

comment on table public.bulk_video_download_jobs is
  'Bulk ZIP video download sessions. Job-level progress only; per-video rows in job_items.';
comment on table public.bulk_video_download_job_items is
  'One row per submission in a bulk download job. Scales to 10k+ without giant jsonb blobs.';
comment on column public.bulk_video_download_jobs.submission_ids is
  'Ordered submission UUIDs selected for this download.';
comment on column public.bulk_video_download_jobs.zip_parts is
  'Lean ZIP parts: [{jobId, zipPartIndex, zipPartTotal, zipFilename, submissionIds[]}].';
comment on column public.bulk_video_download_jobs.zip_part_index is
  '1-based index of the ZIP part currently in progress (e.g. 3 of 7).';
comment on column public.bulk_video_download_jobs.zip_part_total is
  'Total number of ZIP parts in this bulk download.';
comment on column public.bulk_video_download_jobs.summary_viewed is
  'True after the user opened Download summary; floating View video summary button stays hidden.';
comment on column public.bulk_video_download_jobs.summary_viewed_at is
  'Timestamp when the user first opened Download summary.';
