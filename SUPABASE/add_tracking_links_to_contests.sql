-- Add tracking_links column to contests table
alter table public.contests
add column if not exists tracking_links jsonb null;

-- Optional: backfill empty arrays instead of nulls (uncomment if desired)
-- update public.contests set tracking_links = '[]'::jsonb where tracking_links is null;

-- Grant select to anon/service if your policy requires (adjust roles as needed)
-- grant select on table public.contests to anon, service_role, authenticated;


