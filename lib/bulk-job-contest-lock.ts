import type { SupabaseClient } from "@supabase/supabase-js";

const ACTIVE_STATUSES = ["queued", "running"] as const;

export type BulkContestConflict =
  | { kind: "moderation"; jobId: string }
  | { kind: "payment"; jobId: string };

/**
 * Bulk verify/pending/reject and bulk pay must not run on the same contest at
 * once — they touch overlapping submission/wallet state.
 */
export async function findActiveBulkContestConflict(
  supabaseAdmin: SupabaseClient,
  contestId: string,
  starting: "moderation" | "payment",
): Promise<BulkContestConflict | null> {
  if (starting === "moderation") {
    const { data } = await supabaseAdmin
      .from("bulk_payment_jobs")
      .select("id")
      .eq("contest_id", contestId)
      .in("status", [...ACTIVE_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return { kind: "payment", jobId: String(data.id) };
    return null;
  }

  const { data } = await supabaseAdmin
    .from("bulk_submission_moderation_jobs")
    .select("id")
    .eq("contest_id", contestId)
    .in("status", [...ACTIVE_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.id) return { kind: "moderation", jobId: String(data.id) };
  return null;
}

export function bulkContestConflictMessage(
  conflict: BulkContestConflict,
): string {
  if (conflict.kind === "payment") {
    return "A bulk payment job is already running for this contest. Wait for it to finish before starting verify, pending, or reject.";
  }
  return "A bulk verify/pending/reject job is already running for this contest. Wait for it to finish before starting bulk pay.";
}
