-- Create blog_posts table for marketing/blog content
-- This is used by the admin dashboard to create Insense-style blog articles

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  short_description text,
  content text not null,
  category text,
  tags text,
  thumbnail text,
  read_time_minutes integer,
  status text not null default 'draft', -- 'draft' | 'published' | 'archived'
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_blog_posts_status_published_at
  on public.blog_posts (status, published_at desc);

-- Enable RLS and allow public read access (marketing site)
alter table public.blog_posts enable row level security;

drop policy if exists "Allow anonymous read access to blog posts" on public.blog_posts;

create policy "Allow anonymous read access to blog posts"
  on public.blog_posts
  for select
  using (true);

-- Service role / admin clients can insert/update/delete without additional policies.


