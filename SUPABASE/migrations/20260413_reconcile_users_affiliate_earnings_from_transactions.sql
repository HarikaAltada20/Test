-- Fix historical drift: wallet affiliate credits insert money_transactions even when
-- increment_affiliate_earnings (legacy: increment_other_earnings) RPC failed, leaving users.affiliate_earnings too low.
--
-- Sets affiliate_earnings to the sum of successful reward rows with
-- metadata.affiliate_commission = true, but ONLY when that sum exceeds the
-- current value (avoids clobbering higher totals from rare "external" credits
-- that never created a money_transaction).
--
-- After deploy, ensure public.increment_affiliate_earnings exists (20260416_increment_affiliate_earnings_rpc.sql).

UPDATE public.users u
SET affiliate_earnings = agg.total_cents
FROM (
  SELECT user_id, SUM(amount)::bigint AS total_cents
  FROM public.money_transactions
  WHERE type = 'reward'
    AND status = 'success'
    AND metadata @> '{"affiliate_commission": true}'::jsonb
  GROUP BY user_id
) agg
WHERE u.id = agg.user_id
  AND agg.total_cents > COALESCE(u.affiliate_earnings, 0);
