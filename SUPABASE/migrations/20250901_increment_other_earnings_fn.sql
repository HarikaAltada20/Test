-- Increment helper for users.total_other_earnings (in cents)
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
  set total_other_earnings = coalesce(total_other_earnings, 0) + p_amount,
      updated_at = now()
  where id = p_user_id;

  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;


