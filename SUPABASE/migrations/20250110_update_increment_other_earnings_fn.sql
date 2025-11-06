-- Update increment_other_earnings function to use affiliate_earnings instead of total_other_earnings
create or replace function public.increment_other_earnings(
  p_user_id uuid,
  p_amount integer
) returns boolean
language plpgsql
security definer
as $$
declare
  rows_updated integer;
begin
  update public.users
  set affiliate_earnings = coalesce(affiliate_earnings, 0) + p_amount,
      updated_at = now()
  where id = p_user_id;

  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;

