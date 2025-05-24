create table "public"."advertiser_profiles" (
    "id" uuid not null,
    "company_name" text,
    "website_url" text,
    "total_money_spent" numeric default 0,
    "total_contests_run" integer default 0,
    "available_deposit_balance" numeric default 0,
    "withdrawable_balance" numeric default 0,
    "subscription_plan" text default 'free'::text,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP
);


alter table "public"."advertiser_profiles" enable row level security;

create table "public"."coin_transactions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "type" text,
    "status" text,
    "coins" integer,
    "description" text,
    "created_at" timestamp with time zone default now()
);


alter table "public"."coin_transactions" enable row level security;

create table "public"."contests" (
    "id" uuid not null default gen_random_uuid(),
    "advertiser_id" uuid,
    "title" text not null,
    "platform" text,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "thumbnail_url" text,
    "brief" text,
    "rules" jsonb,
    "prizes" jsonb,
    "resources" jsonb,
    "category" text,
    "inspiration_links" text,
    "total_prize" numeric,
    "winner_count" integer,
    "created_at" timestamp with time zone default now(),
    "is_draft" boolean default false,
    "subscription_plan_of_user" text,
    "updated_at" timestamp with time zone default now()
);


alter table "public"."contests" enable row level security;

create table "public"."creator_profiles" (
    "id" uuid not null,
    "bio" text,
    "youtube_account" jsonb,
    "instagram_account" jsonb,
    "total_contests_participated" integer default 0,
    "total_contests_won" integer default 0,
    "total_money_won" numeric default 0,
    "withdrawable_balance" numeric default 0,
    "total_views" bigint default 0,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP
);


alter table "public"."creator_profiles" enable row level security;

create table "public"."money_transactions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "type" text,
    "status" text,
    "amount" numeric,
    "description" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."money_transactions" enable row level security;

create table "public"."submissions" (
    "id" uuid not null default gen_random_uuid(),
    "contest_id" uuid,
    "creator_id" uuid,
    "content_link" text,
    "views" integer default 0,
    "description" text,
    "other_stats" jsonb,
    "created_at" timestamp with time zone,
    "status" text default 'pending'::text,
    "earnings" numeric default 0,
    "video_id" text,
    "video_title" text,
    "video_thumbnail_url" text,
    "updated_at" timestamp with time zone,
    "platform" text
);


alter table "public"."submissions" enable row level security;

create table "public"."subscription_plans" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "price" numeric not null,
    "json_features" jsonb,
    "stripe_price_id" text,
    "razorpay_plan_id" text,
    "created_at" timestamp without time zone default now()
);


alter table "public"."subscription_plans" enable row level security;

create table "public"."subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "plan_id" uuid,
    "gateway" text,
    "external_subscription_id" text,
    "status" text,
    "start_date" date,
    "expiry_date" date,
    "renews_on" date,
    "cancel_at_period_end" boolean default false,
    "trial_end" date,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


alter table "public"."subscriptions" enable row level security;

create table "public"."users" (
    "id" uuid not null default gen_random_uuid(),
    "full_name" text not null,
    "profile_picture_url" text,
    "email" text not null,
    "user_type" text not null,
    "referral_code" text,
    "referred_by" text,
    "coins" integer default 0,
    "advertisers_referred" integer default 0,
    "creators_referred" integer default 0,
    "username" text,
    "is_active" boolean default true,
    "ip_address" text,
    "email_confirmed_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."users" enable row level security;

CREATE UNIQUE INDEX advertiser_profiles_pkey ON public.advertiser_profiles USING btree (id);

CREATE UNIQUE INDEX coin_transactions_pkey ON public.coin_transactions USING btree (id);

CREATE UNIQUE INDEX contests_pkey ON public.contests USING btree (id);

CREATE UNIQUE INDEX creator_profiles_pkey ON public.creator_profiles USING btree (id);

CREATE UNIQUE INDEX money_transactions_pkey ON public.money_transactions USING btree (id);

CREATE UNIQUE INDEX submissions_pkey ON public.submissions USING btree (id);

CREATE UNIQUE INDEX subscription_plans_name_key ON public.subscription_plans USING btree (name);

CREATE UNIQUE INDEX subscription_plans_pkey ON public.subscription_plans USING btree (id);

CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

CREATE UNIQUE INDEX users_referral_code_key ON public.users USING btree (referral_code);

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);

alter table "public"."advertiser_profiles" add constraint "advertiser_profiles_pkey" PRIMARY KEY using index "advertiser_profiles_pkey";

alter table "public"."coin_transactions" add constraint "coin_transactions_pkey" PRIMARY KEY using index "coin_transactions_pkey";

alter table "public"."contests" add constraint "contests_pkey" PRIMARY KEY using index "contests_pkey";

alter table "public"."creator_profiles" add constraint "creator_profiles_pkey" PRIMARY KEY using index "creator_profiles_pkey";

alter table "public"."money_transactions" add constraint "money_transactions_pkey" PRIMARY KEY using index "money_transactions_pkey";

alter table "public"."submissions" add constraint "submissions_pkey" PRIMARY KEY using index "submissions_pkey";

alter table "public"."subscription_plans" add constraint "subscription_plans_pkey" PRIMARY KEY using index "subscription_plans_pkey";

alter table "public"."subscriptions" add constraint "subscriptions_pkey" PRIMARY KEY using index "subscriptions_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."advertiser_profiles" add constraint "advertiser_profiles_id_fkey" FOREIGN KEY (id) REFERENCES users(id) not valid;

alter table "public"."advertiser_profiles" validate constraint "advertiser_profiles_id_fkey";

alter table "public"."coin_transactions" add constraint "coin_transactions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text]))) not valid;

alter table "public"."coin_transactions" validate constraint "coin_transactions_status_check";

alter table "public"."coin_transactions" add constraint "coin_transactions_type_check" CHECK ((type = ANY (ARRAY['referral_bonus'::text, 'spent'::text, 'earned'::text, 'bonus'::text]))) not valid;

alter table "public"."coin_transactions" validate constraint "coin_transactions_type_check";

alter table "public"."coin_transactions" add constraint "coin_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) not valid;

alter table "public"."coin_transactions" validate constraint "coin_transactions_user_id_fkey";

alter table "public"."contests" add constraint "contests_advertiser_id_fkey1" FOREIGN KEY (advertiser_id) REFERENCES advertiser_profiles(id) not valid;

alter table "public"."contests" validate constraint "contests_advertiser_id_fkey1";

alter table "public"."creator_profiles" add constraint "creator_profiles_id_fkey" FOREIGN KEY (id) REFERENCES users(id) not valid;

alter table "public"."creator_profiles" validate constraint "creator_profiles_id_fkey";

alter table "public"."money_transactions" add constraint "money_transactions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text]))) not valid;

alter table "public"."money_transactions" validate constraint "money_transactions_status_check";

alter table "public"."money_transactions" add constraint "money_transactions_type_check" CHECK ((type = ANY (ARRAY['withdrawal'::text, 'reward'::text, 'deposit'::text]))) not valid;

alter table "public"."money_transactions" validate constraint "money_transactions_type_check";

alter table "public"."money_transactions" add constraint "money_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) not valid;

alter table "public"."money_transactions" validate constraint "money_transactions_user_id_fkey";

alter table "public"."submissions" add constraint "submissions_contest_id_fkey" FOREIGN KEY (contest_id) REFERENCES contests(id) not valid;

alter table "public"."submissions" validate constraint "submissions_contest_id_fkey";

alter table "public"."submissions" add constraint "submissions_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES users(id) not valid;

alter table "public"."submissions" validate constraint "submissions_creator_id_fkey";

alter table "public"."subscription_plans" add constraint "subscription_plans_name_key" UNIQUE using index "subscription_plans_name_key";

alter table "public"."subscriptions" add constraint "subscriptions_gateway_check" CHECK ((gateway = ANY (ARRAY['stripe'::text, 'razorpay'::text]))) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_gateway_check";

alter table "public"."subscriptions" add constraint "subscriptions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_plan_id_fkey";

alter table "public"."subscriptions" add constraint "subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_user_id_fkey";

alter table "public"."users" add constraint "users_email_key" UNIQUE using index "users_email_key";

alter table "public"."users" add constraint "users_referral_code_key" UNIQUE using index "users_referral_code_key";

alter table "public"."users" add constraint "users_referred_by_fkey" FOREIGN KEY (referred_by) REFERENCES users(referral_code) not valid;

alter table "public"."users" validate constraint "users_referred_by_fkey";

alter table "public"."users" add constraint "users_user_type_check" CHECK ((user_type = ANY (ARRAY['creator'::text, 'advertiser'::text]))) not valid;

alter table "public"."users" validate constraint "users_user_type_check";

alter table "public"."users" add constraint "users_username_key" UNIQUE using index "users_username_key";

set check_function_bodies = off;

create or replace view "public"."contests_with_status" as  SELECT c.id,
    c.advertiser_id,
    c.title,
    c.platform,
    c.start_date,
    c.end_date,
    c.thumbnail_url,
    c.brief,
    c.rules,
    c.prizes,
    c.resources,
    c.category,
    c.inspiration_links,
    c.total_prize,
    c.winner_count,
    c.created_at,
    c.is_draft,
    c.subscription_plan_of_user,
    c.updated_at,
        CASE
            WHEN c.is_draft THEN 'draft'::text
            WHEN ((c.start_date IS NULL) OR (c.end_date IS NULL)) THEN 'incomplete'::text
            WHEN (c.start_date > now()) THEN 'upcoming'::text
            WHEN ((c.start_date <= now()) AND (c.end_date > now())) THEN 'live'::text
            WHEN (c.end_date <= now()) THEN 'completed'::text
            ELSE 'unknown'::text
        END AS status
   FROM contests c;


CREATE OR REPLACE FUNCTION public.handle_referral(referrer_id uuid, referred_id uuid, ref_code text, referred_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Update the referred user
  UPDATE users 
  SET 
    coins = 200, -- 100 welcome + 100 referral bonus
    referred_by = ref_code  -- Using the parameter, not column
  WHERE id = referred_id;
  
  -- Record referral bonus transaction for referred user
  INSERT INTO coin_transactions (
    user_id, 
    type, 
    status, 
    coins, 
    description,
    created_at
  ) VALUES (
    referred_id,
    'referral_bonus',
    'success',
    100,
    'Bonus for using referral code ' || ref_code,  -- Using parameter
    NOW()
  );
  
  -- Update referrer statistics based on referred user type
  IF referred_type = 'creator' THEN
    UPDATE users 
    SET 
      coins = coins + 100,
      creators_referred = creators_referred + 1
    WHERE id = referrer_id;
  ELSE
    UPDATE users 
    SET 
      coins = coins + 100,
      advertisers_referred = advertisers_referred + 1
    WHERE id = referrer_id;
  END IF;
  
  -- Since this is a SECURITY DEFINER function, it can bypass RLS
  -- We can now create a transaction for the referrer too
  INSERT INTO coin_transactions (
    user_id, 
    type, 
    status, 
    coins, 
    description,
    created_at
  ) VALUES (
    referrer_id,
    'referral_bonus',
    'success',
    100,
    'Referral bonus for inviting new ' || referred_type,
    NOW()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."advertiser_profiles" to "anon";

grant insert on table "public"."advertiser_profiles" to "anon";

grant references on table "public"."advertiser_profiles" to "anon";

grant select on table "public"."advertiser_profiles" to "anon";

grant trigger on table "public"."advertiser_profiles" to "anon";

grant truncate on table "public"."advertiser_profiles" to "anon";

grant update on table "public"."advertiser_profiles" to "anon";

grant delete on table "public"."advertiser_profiles" to "authenticated";

grant insert on table "public"."advertiser_profiles" to "authenticated";

grant references on table "public"."advertiser_profiles" to "authenticated";

grant select on table "public"."advertiser_profiles" to "authenticated";

grant trigger on table "public"."advertiser_profiles" to "authenticated";

grant truncate on table "public"."advertiser_profiles" to "authenticated";

grant update on table "public"."advertiser_profiles" to "authenticated";

grant delete on table "public"."advertiser_profiles" to "service_role";

grant insert on table "public"."advertiser_profiles" to "service_role";

grant references on table "public"."advertiser_profiles" to "service_role";

grant select on table "public"."advertiser_profiles" to "service_role";

grant trigger on table "public"."advertiser_profiles" to "service_role";

grant truncate on table "public"."advertiser_profiles" to "service_role";

grant update on table "public"."advertiser_profiles" to "service_role";

grant delete on table "public"."coin_transactions" to "anon";

grant insert on table "public"."coin_transactions" to "anon";

grant references on table "public"."coin_transactions" to "anon";

grant select on table "public"."coin_transactions" to "anon";

grant trigger on table "public"."coin_transactions" to "anon";

grant truncate on table "public"."coin_transactions" to "anon";

grant update on table "public"."coin_transactions" to "anon";

grant delete on table "public"."coin_transactions" to "authenticated";

grant insert on table "public"."coin_transactions" to "authenticated";

grant references on table "public"."coin_transactions" to "authenticated";

grant select on table "public"."coin_transactions" to "authenticated";

grant trigger on table "public"."coin_transactions" to "authenticated";

grant truncate on table "public"."coin_transactions" to "authenticated";

grant update on table "public"."coin_transactions" to "authenticated";

grant delete on table "public"."coin_transactions" to "service_role";

grant insert on table "public"."coin_transactions" to "service_role";

grant references on table "public"."coin_transactions" to "service_role";

grant select on table "public"."coin_transactions" to "service_role";

grant trigger on table "public"."coin_transactions" to "service_role";

grant truncate on table "public"."coin_transactions" to "service_role";

grant update on table "public"."coin_transactions" to "service_role";

grant delete on table "public"."contests" to "anon";

grant insert on table "public"."contests" to "anon";

grant references on table "public"."contests" to "anon";

grant select on table "public"."contests" to "anon";

grant trigger on table "public"."contests" to "anon";

grant truncate on table "public"."contests" to "anon";

grant update on table "public"."contests" to "anon";

grant delete on table "public"."contests" to "authenticated";

grant insert on table "public"."contests" to "authenticated";

grant references on table "public"."contests" to "authenticated";

grant select on table "public"."contests" to "authenticated";

grant trigger on table "public"."contests" to "authenticated";

grant truncate on table "public"."contests" to "authenticated";

grant update on table "public"."contests" to "authenticated";

grant delete on table "public"."contests" to "service_role";

grant insert on table "public"."contests" to "service_role";

grant references on table "public"."contests" to "service_role";

grant select on table "public"."contests" to "service_role";

grant trigger on table "public"."contests" to "service_role";

grant truncate on table "public"."contests" to "service_role";

grant update on table "public"."contests" to "service_role";

grant delete on table "public"."creator_profiles" to "anon";

grant insert on table "public"."creator_profiles" to "anon";

grant references on table "public"."creator_profiles" to "anon";

grant select on table "public"."creator_profiles" to "anon";

grant trigger on table "public"."creator_profiles" to "anon";

grant truncate on table "public"."creator_profiles" to "anon";

grant update on table "public"."creator_profiles" to "anon";

grant delete on table "public"."creator_profiles" to "authenticated";

grant insert on table "public"."creator_profiles" to "authenticated";

grant references on table "public"."creator_profiles" to "authenticated";

grant select on table "public"."creator_profiles" to "authenticated";

grant trigger on table "public"."creator_profiles" to "authenticated";

grant truncate on table "public"."creator_profiles" to "authenticated";

grant update on table "public"."creator_profiles" to "authenticated";

grant delete on table "public"."creator_profiles" to "service_role";

grant insert on table "public"."creator_profiles" to "service_role";

grant references on table "public"."creator_profiles" to "service_role";

grant select on table "public"."creator_profiles" to "service_role";

grant trigger on table "public"."creator_profiles" to "service_role";

grant truncate on table "public"."creator_profiles" to "service_role";

grant update on table "public"."creator_profiles" to "service_role";

grant delete on table "public"."money_transactions" to "anon";

grant insert on table "public"."money_transactions" to "anon";

grant references on table "public"."money_transactions" to "anon";

grant select on table "public"."money_transactions" to "anon";

grant trigger on table "public"."money_transactions" to "anon";

grant truncate on table "public"."money_transactions" to "anon";

grant update on table "public"."money_transactions" to "anon";

grant delete on table "public"."money_transactions" to "authenticated";

grant insert on table "public"."money_transactions" to "authenticated";

grant references on table "public"."money_transactions" to "authenticated";

grant select on table "public"."money_transactions" to "authenticated";

grant trigger on table "public"."money_transactions" to "authenticated";

grant truncate on table "public"."money_transactions" to "authenticated";

grant update on table "public"."money_transactions" to "authenticated";

grant delete on table "public"."money_transactions" to "service_role";

grant insert on table "public"."money_transactions" to "service_role";

grant references on table "public"."money_transactions" to "service_role";

grant select on table "public"."money_transactions" to "service_role";

grant trigger on table "public"."money_transactions" to "service_role";

grant truncate on table "public"."money_transactions" to "service_role";

grant update on table "public"."money_transactions" to "service_role";

grant delete on table "public"."submissions" to "anon";

grant insert on table "public"."submissions" to "anon";

grant references on table "public"."submissions" to "anon";

grant select on table "public"."submissions" to "anon";

grant trigger on table "public"."submissions" to "anon";

grant truncate on table "public"."submissions" to "anon";

grant update on table "public"."submissions" to "anon";

grant delete on table "public"."submissions" to "authenticated";

grant insert on table "public"."submissions" to "authenticated";

grant references on table "public"."submissions" to "authenticated";

grant select on table "public"."submissions" to "authenticated";

grant trigger on table "public"."submissions" to "authenticated";

grant truncate on table "public"."submissions" to "authenticated";

grant update on table "public"."submissions" to "authenticated";

grant delete on table "public"."submissions" to "service_role";

grant insert on table "public"."submissions" to "service_role";

grant references on table "public"."submissions" to "service_role";

grant select on table "public"."submissions" to "service_role";

grant trigger on table "public"."submissions" to "service_role";

grant truncate on table "public"."submissions" to "service_role";

grant update on table "public"."submissions" to "service_role";

grant delete on table "public"."subscription_plans" to "anon";

grant insert on table "public"."subscription_plans" to "anon";

grant references on table "public"."subscription_plans" to "anon";

grant select on table "public"."subscription_plans" to "anon";

grant trigger on table "public"."subscription_plans" to "anon";

grant truncate on table "public"."subscription_plans" to "anon";

grant update on table "public"."subscription_plans" to "anon";

grant delete on table "public"."subscription_plans" to "authenticated";

grant insert on table "public"."subscription_plans" to "authenticated";

grant references on table "public"."subscription_plans" to "authenticated";

grant select on table "public"."subscription_plans" to "authenticated";

grant trigger on table "public"."subscription_plans" to "authenticated";

grant truncate on table "public"."subscription_plans" to "authenticated";

grant update on table "public"."subscription_plans" to "authenticated";

grant delete on table "public"."subscription_plans" to "service_role";

grant insert on table "public"."subscription_plans" to "service_role";

grant references on table "public"."subscription_plans" to "service_role";

grant select on table "public"."subscription_plans" to "service_role";

grant trigger on table "public"."subscription_plans" to "service_role";

grant truncate on table "public"."subscription_plans" to "service_role";

grant update on table "public"."subscription_plans" to "service_role";

grant delete on table "public"."subscriptions" to "anon";

grant insert on table "public"."subscriptions" to "anon";

grant references on table "public"."subscriptions" to "anon";

grant select on table "public"."subscriptions" to "anon";

grant trigger on table "public"."subscriptions" to "anon";

grant truncate on table "public"."subscriptions" to "anon";

grant update on table "public"."subscriptions" to "anon";

grant delete on table "public"."subscriptions" to "authenticated";

grant insert on table "public"."subscriptions" to "authenticated";

grant references on table "public"."subscriptions" to "authenticated";

grant select on table "public"."subscriptions" to "authenticated";

grant trigger on table "public"."subscriptions" to "authenticated";

grant truncate on table "public"."subscriptions" to "authenticated";

grant update on table "public"."subscriptions" to "authenticated";

grant delete on table "public"."subscriptions" to "service_role";

grant insert on table "public"."subscriptions" to "service_role";

grant references on table "public"."subscriptions" to "service_role";

grant select on table "public"."subscriptions" to "service_role";

grant trigger on table "public"."subscriptions" to "service_role";

grant truncate on table "public"."subscriptions" to "service_role";

grant update on table "public"."subscriptions" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";

create policy "Advertisers can read their own profile"
on "public"."advertiser_profiles"
as permissive
for select
to authenticated
using ((auth.uid() = id));


create policy "Advertisers can update their own profile"
on "public"."advertiser_profiles"
as permissive
for update
to authenticated
using ((auth.uid() = id));


create policy "Advertisers can view their own profile"
on "public"."advertiser_profiles"
as permissive
for select
to public
using ((auth.uid() = id));


create policy "Public can view advertiser profiles"
on "public"."advertiser_profiles"
as permissive
for select
to public
using (true);


create policy "Users can insert their own advertiser profile"
on "public"."advertiser_profiles"
as permissive
for insert
to public
with check ((auth.uid() = id));


create policy "Users can view advertiser profiles"
on "public"."advertiser_profiles"
as permissive
for select
to authenticated
using (true);


create policy "Service role can manage all transactions"
on "public"."coin_transactions"
as permissive
for all
to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


create policy "Users can insert their own coin transactions"
on "public"."coin_transactions"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can insert their own transactions"
on "public"."coin_transactions"
as permissive
for insert
to authenticated
with check ((auth.uid() = user_id));


create policy "Users can view their own coin transactions"
on "public"."coin_transactions"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can view their own transactions"
on "public"."coin_transactions"
as permissive
for select
to authenticated
using ((auth.uid() = user_id));


create policy "Advertisers can manage their own contests"
on "public"."contests"
as permissive
for all
to public
using ((auth.uid() = advertiser_id));


create policy "Public can view active contests"
on "public"."contests"
as permissive
for select
to public
using ((is_draft = false));


create policy "Creators can read their own profile"
on "public"."creator_profiles"
as permissive
for select
to authenticated
using ((auth.uid() = id));


create policy "Creators can update their own profile"
on "public"."creator_profiles"
as permissive
for update
to authenticated
using ((auth.uid() = id));


create policy "Public can view creator profiles"
on "public"."creator_profiles"
as permissive
for select
to public
using (true);


create policy "Users can insert their own creator profile"
on "public"."creator_profiles"
as permissive
for insert
to public
with check ((auth.uid() = id));


create policy "Users can view their own money transactions"
on "public"."money_transactions"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Contest owners can view all submissions"
on "public"."submissions"
as permissive
for select
to public
using ((auth.uid() IN ( SELECT contests.advertiser_id
   FROM contests
  WHERE (contests.id = submissions.contest_id))));


create policy "Creators can manage their own submissions"
on "public"."submissions"
as permissive
for all
to public
using ((auth.uid() = creator_id));


create policy "Public can view all submissions for leaderboard"
on "public"."submissions"
as permissive
for select
to public
using (true);


create policy "Public can view subscription plans"
on "public"."subscription_plans"
as permissive
for select
to public
using (true);


create policy "Users can view their own subscriptions"
on "public"."subscriptions"
as permissive
for select
to authenticated
using ((user_id = auth.uid()));


create policy "Users can insert their own user record"
on "public"."users"
as permissive
for insert
to public
with check ((auth.uid() = id));


create policy "Users can read their own profile"
on "public"."users"
as permissive
for select
to authenticated
using ((auth.uid() = id));


create policy "Users can update their own data"
on "public"."users"
as permissive
for update
to public
using ((auth.uid() = id));


create policy "Users can update their own profile"
on "public"."users"
as permissive
for update
to authenticated
using ((auth.uid() = id));


create policy "Users can view basic info about other users"
on "public"."users"
as permissive
for select
to public
using (true);


create policy "Users can view their own data"
on "public"."users"
as permissive
for select
to public
using ((auth.uid() = id));


create policy "Users can view user profiles"
on "public"."users"
as permissive
for select
to authenticated
using (true);


CREATE TRIGGER update_advertiser_profiles_updated_at BEFORE UPDATE ON public.advertiser_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_contests_update BEFORE UPDATE ON public.contests FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_creator_profiles_updated_at BEFORE UPDATE ON public.creator_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


