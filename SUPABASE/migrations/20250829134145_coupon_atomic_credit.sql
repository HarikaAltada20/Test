-- Atomic credit functions for coupons

-- 1) Creator: credit withdrawable_balance atomically and log money_transactions
create or replace function public.credit_creator_cash_atomic(
  p_user_id uuid,
  p_amount_cents integer,
  p_description text,
  p_remarks text
)
returns table(new_balance integer) as $$
declare
  v_balance integer;
begin
  update public.creator_profiles
  set withdrawable_balance = coalesce(withdrawable_balance, 0) + p_amount_cents,
      updated_at = now()
  where id = p_user_id
  returning withdrawable_balance into v_balance;

  if not found then
    raise exception 'creator profile not found for %', p_user_id;
  end if;

  insert into public.money_transactions (
    user_id, type, status, amount, currency, description, remarks, payment_method, created_at, updated_at
  ) values (
    p_user_id, 'reward', 'success', p_amount_cents, 'USD', p_description, p_remarks, 'wallet', now(), now()
  );

  return query select v_balance;
end;
$$ language plpgsql security definer;

grant execute on function public.credit_creator_cash_atomic(uuid, integer, text, text) to authenticated;

-- 2) Advertiser: credit available_deposit_balance atomically and log money_transactions
create or replace function public.credit_advertiser_cash_atomic(
  p_user_id uuid,
  p_amount_cents integer,
  p_description text,
  p_remarks text
)
returns table(new_balance integer) as $$
declare
  v_balance integer;
begin
  update public.advertiser_profiles
  set available_deposit_balance = coalesce(available_deposit_balance, 0) + p_amount_cents,
      updated_at = now()
  where id = p_user_id
  returning available_deposit_balance into v_balance;

  if not found then
    raise exception 'advertiser profile not found for %', p_user_id;
  end if;

  insert into public.money_transactions (
    user_id, type, status, amount, currency, description, remarks, payment_method, created_at, updated_at
  ) values (
    p_user_id, 'reward', 'success', p_amount_cents, 'USD', p_description, p_remarks, 'wallet', now(), now()
  );

  return query select v_balance;
end;
$$ language plpgsql security definer;

grant execute on function public.credit_advertiser_cash_atomic(uuid, integer, text, text) to authenticated;


