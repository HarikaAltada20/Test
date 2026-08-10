-- Serialize payout calculations for one creator within one contest across API
-- routes and workers. The short lease expires automatically after crashes.
create table if not exists public.creator_contest_payout_leases (
  lease_key text primary key,
  owner_token uuid not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.creator_contest_payout_leases enable row level security;

create or replace function public.acquire_creator_contest_payout_lease(
  p_contest_id uuid,
  p_creator_id uuid,
  p_owner_token uuid,
  p_ttl_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := p_contest_id::text || ':' || p_creator_id::text;
  v_acquired boolean := false;
begin
  insert into public.creator_contest_payout_leases (
    lease_key,
    owner_token,
    expires_at,
    updated_at
  )
  values (
    v_key,
    p_owner_token,
    -- Cap at 30m so long bulk pays can finish; owners renew via re-acquire.
    now() + make_interval(secs => greatest(15, least(p_ttl_seconds, 1800))),
    now()
  )
  on conflict (lease_key) do update
    set owner_token = excluded.owner_token,
        expires_at = excluded.expires_at,
        updated_at = now()
    where public.creator_contest_payout_leases.expires_at <= now()
       or public.creator_contest_payout_leases.owner_token = excluded.owner_token
  returning true into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;

create or replace function public.release_creator_contest_payout_lease(
  p_contest_id uuid,
  p_creator_id uuid,
  p_owner_token uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.creator_contest_payout_leases
  where lease_key = p_contest_id::text || ':' || p_creator_id::text
    and owner_token = p_owner_token;
$$;

revoke all on table public.creator_contest_payout_leases from anon, authenticated;
revoke all on function public.acquire_creator_contest_payout_lease(uuid, uuid, uuid, integer) from public;
revoke all on function public.release_creator_contest_payout_lease(uuid, uuid, uuid) from public;
grant execute on function public.acquire_creator_contest_payout_lease(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.release_creator_contest_payout_lease(uuid, uuid, uuid) to service_role;

-- Durable idempotency for wallet debits. This prevents a server timeout between
-- the balance mutation and later application work from charging the same
-- reversal twice on retry.
create table if not exists public.creator_wallet_debit_operations (
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  idempotency_key text not null,
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  primary key (creator_id, idempotency_key)
);

alter table public.creator_wallet_debit_operations enable row level security;

create or replace function public.creator_payout_debit_idempotent_atomic(
  p_creator_id uuid,
  p_amount_cents bigint,
  p_idempotency_key text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_existing_amount bigint;
  v_bal bigint;
  v_won bigint;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'amount must be positive';
  end if;
  if v_key is null then
    raise exception 'idempotency key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_creator_id::text),
    hashtext(v_key)
  );

  select amount_cents into v_existing_amount
  from public.creator_wallet_debit_operations
  where creator_id = p_creator_id
    and idempotency_key = v_key;

  if found then
    if v_existing_amount <> p_amount_cents then
      raise exception 'idempotency key amount mismatch';
    end if;
    select coalesce(withdrawable_balance, 0)::bigint into v_bal
    from public.creator_profiles
    where id = p_creator_id;
    return json_build_object(
      'new_balance', v_bal,
      'already_applied', true
    );
  end if;

  select
    coalesce(withdrawable_balance, 0)::bigint,
    coalesce(total_money_won, 0)::bigint
  into v_bal, v_won
  from public.creator_profiles
  where id = p_creator_id
  for update;

  if not found then
    raise exception 'creator profile not found for %', p_creator_id;
  end if;
  if v_bal < p_amount_cents then
    raise exception 'Insufficient withdrawable balance to reverse % cents (have %)', p_amount_cents, v_bal;
  end if;

  update public.creator_profiles
  set withdrawable_balance = v_bal - p_amount_cents,
      total_money_won = greatest(0::bigint, v_won - p_amount_cents)
  where id = p_creator_id;

  insert into public.creator_wallet_debit_operations (
    creator_id,
    idempotency_key,
    amount_cents
  ) values (
    p_creator_id,
    v_key,
    p_amount_cents
  );

  return json_build_object(
    'new_balance', v_bal - p_amount_cents,
    'already_applied', false
  );
end;
$$;

revoke all on table public.creator_wallet_debit_operations from anon, authenticated;
revoke all on function public.creator_payout_debit_idempotent_atomic(uuid, bigint, text) from public;
grant execute on function public.creator_payout_debit_idempotent_atomic(uuid, bigint, text) to service_role;
