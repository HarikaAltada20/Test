import type { SupabaseClient } from "@supabase/supabase-js";

const REVERSAL_TRANSACTION_REMARK = "Forfeited due to status reversal";

/**
 * Count refund rows logged for this creator + contest (metadata.contest_id).
 * Increments when reversing paid submissions, so bulk/Twitter bulk idempotency keys
 * change after refunds and legitimate re-payouts are not suppressed.
 *
 * Same count on immediate retry (no refunds in between) → same idempotency → safe dedupe.
 */
export async function countRefundsForCreatorContest(
  supabase: SupabaseClient,
  creatorId: string,
  contestId: string,
): Promise<{ count: number; errorMessage: string | null }> {
  const { count, error } = await supabase
    .from("money_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", creatorId)
    .eq("type", "refund")
    .eq("remarks", REVERSAL_TRANSACTION_REMARK)
    .contains("metadata", { contest_id: contestId });

  if (error) {
    return { count: 0, errorMessage: error.message };
  }

  return { count: typeof count === "number" ? count : 0, errorMessage: null };
}
