import { createAdminClient } from "@/utils/supabase/admin";
import { SUBMISSION_STATUS } from "@/lib/constants-status";

/** Only verified/paid submissions count toward creator_profiles.total_views. */
export const VERIFIED_VIEWS_CREDIT_STATUSES = [
  SUBMISSION_STATUS.verified,
  SUBMISSION_STATUS.paid,
] as const;

export function shouldCreditSubmissionViewsOnStatusChange(
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined,
): boolean {
  if (
    nextStatus !== SUBMISSION_STATUS.verified &&
    nextStatus !== SUBMISSION_STATUS.paid
  ) {
    return false;
  }

  return (
    previousStatus !== SUBMISSION_STATUS.verified &&
    previousStatus !== SUBMISSION_STATUS.paid
  );
}

export async function reconcileCreatorTotalViews(
  creatorId: string,
): Promise<void> {
  if (!creatorId) return;

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("recalculate_creator_total_views", {
    p_creator_id: creatorId,
  });
  if (error) {
    throw new Error(
      `Failed to reconcile creator total_views: ${error.message}`,
    );
  }
}

export async function reconcileCreatorTotalViewsForIds(
  creatorIds: Iterable<string | null | undefined>,
): Promise<void> {
  const uniqueIds = [
    ...new Set(
      [...creatorIds].filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  ];

  for (const creatorId of uniqueIds) {
    await reconcileCreatorTotalViews(creatorId);
  }
}

/** Remove stale credits for pending submissions (they must not count until verified). */
export async function deleteViewCreditsForPendingSubmissions(options?: {
  contestId?: string;
}): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase
    .from("submissions")
    .select("id")
    .eq("status", SUBMISSION_STATUS.pending);

  if (options?.contestId) {
    query = query.eq("contest_id", options.contestId);
  }

  const { data: pendingRows, error: pendingErr } = await query;
  if (pendingErr) {
    throw new Error(
      `Failed to load pending submissions for view credit cleanup: ${pendingErr.message}`,
    );
  }

  const pendingIds = (pendingRows || [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (pendingIds.length === 0) return 0;

  const { data: deletedRows, error: deleteErr } = await supabase
    .from("submission_views_credited")
    .delete()
    .in("submission_id", pendingIds)
    .select("submission_id");

  if (deleteErr) {
    throw new Error(
      `Failed to delete pending submission view credits: ${deleteErr.message}`,
    );
  }

  return deletedRows?.length ?? 0;
}

/** Remove credited snapshots for rejected submissions in a contest. */
export async function deleteViewCreditsForRejectedSubmissions(
  contestId?: string,
): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase
    .from("submissions")
    .select("id")
    .eq("status", SUBMISSION_STATUS.rejected);

  if (contestId) {
    query = query.eq("contest_id", contestId);
  }
  const { data: rejectedRows, error: rejectedErr } = await query;
  if (rejectedErr) {
    throw new Error(
      `Failed to load rejected submissions for view credit cleanup: ${rejectedErr.message}`,
    );
  }

  const rejectedIds = (rejectedRows || [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (rejectedIds.length === 0) return 0;

  const { data: deletedRows, error: deleteErr } = await supabase
    .from("submission_views_credited")
    .delete()
    .in("submission_id", rejectedIds)
    .select("submission_id");

  if (deleteErr) {
    throw new Error(
      `Failed to delete rejected submission view credits: ${deleteErr.message}`,
    );
  }

  return deletedRows?.length ?? 0;
}
