-- PostgREST overload fix: the prior migration added 3/4-arg debit RPCs but left the
-- legacy 2/3-arg versions in place. Supabase may call the old signature and ignore
-- p_allow_negative_balance, blocking paid→verified reversals when balance is $0.

DROP FUNCTION IF EXISTS public.creator_payout_debit_atomic(uuid, bigint);

DROP FUNCTION IF EXISTS public.creator_payout_debit_idempotent_atomic(uuid, bigint, text);

-- Re-assert grants on the canonical signatures (idempotent if already set).
GRANT EXECUTE ON FUNCTION public.creator_payout_debit_atomic(uuid, bigint, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.creator_payout_debit_idempotent_atomic(uuid, bigint, text, boolean) TO service_role;
