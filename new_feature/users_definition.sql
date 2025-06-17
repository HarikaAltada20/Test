create table public.users (
  id uuid not null default gen_random_uuid (),
  full_name text not null,
  profile_picture_url text null,
  email text not null,
  user_type text not null,
  referral_code text null,
  referred_by text null,
  coins integer null default 0,
  advertisers_referred integer null default 0,
  creators_referred integer null default 0,
  username text null,
  is_active boolean null default true,
  ip_address text null,
  email_confirmed_at timestamp with time zone null default now(),
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  total_lifetime_coins_earned bigint null default 0,
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_referral_code_key unique (referral_code),
  constraint users_username_key unique (username),
  constraint users_referred_by_fkey foreign KEY (referred_by) references users (referral_code),
  constraint users_user_type_check check (
    (
      user_type = any (
        array[
          'creator'::text,
          'advertiser'::text,
          'admin'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_users_username on public.users using btree (username) TABLESPACE pg_default;