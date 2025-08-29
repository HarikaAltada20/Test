-- Track coupon redemptions per user (prevents double redemption)
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_coupon_redemptions_unique on public.coupon_redemptions(user_id, code);

alter table public.coupon_redemptions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'coupon_redemptions' and policyname = 'coupon_redemptions_select_own'
  ) then
    create policy coupon_redemptions_select_own on public.coupon_redemptions
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'coupon_redemptions' and policyname = 'coupon_redemptions_insert_own'
  ) then
    create policy coupon_redemptions_insert_own on public.coupon_redemptions
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

grant select, insert on public.coupon_redemptions to authenticated;


