-- Desktop bulk video download: source/delivery columns + idempotent status events.
-- Extends 20260825_bulk_video_download_jobs.sql for the Game of Creators desktop downloader.

alter table public.bulk_video_download_jobs
  add column if not exists source text not null default 'cloud';

alter table public.bulk_video_download_jobs
  add column if not exists delivery_mode text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bulk_video_download_jobs_source_check'
  ) then
    alter table public.bulk_video_download_jobs
      add constraint bulk_video_download_jobs_source_check
      check (source in ('cloud', 'desktop'));
  end if;
end $$;

comment on column public.bulk_video_download_jobs.source is
  'Download delivery path: cloud (Redis/Vercel ZIP) or desktop (.gocdownload manifest).';
comment on column public.bulk_video_download_jobs.delivery_mode is
  'Optional delivery detail (e.g. nsis, sidecar).';

create table if not exists public.bulk_video_download_desktop_events (
  id text primary key,
  job_id uuid not null references public.bulk_video_download_jobs(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bulk_video_download_desktop_events_job_idx
  on public.bulk_video_download_desktop_events (job_id, created_at desc);

create index if not exists bulk_video_download_desktop_events_type_idx
  on public.bulk_video_download_desktop_events (job_id, event_type);

comment on table public.bulk_video_download_desktop_events is
  'Idempotent desktop downloader status events (event id from client as PK). Metadata only; never stores media.';

alter table public.bulk_video_download_desktop_events enable row level security;

revoke all on table public.bulk_video_download_desktop_events from anon, authenticated;
grant all on table public.bulk_video_download_desktop_events to service_role;

create index if not exists bulk_video_download_jobs_source_idx
  on public.bulk_video_download_jobs (source, created_at desc);
