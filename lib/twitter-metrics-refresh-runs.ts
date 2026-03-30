/**
 * DB-backed run tracking for Twitter metrics refresh (Redis queue worker).
 * Mirrors instagram_insights_refresh_runs for admin observability.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const RAID_OR_AWARENESS_BATCH_SIZE = 5;

function truncateErr(msg: string, max = 2000): string {
  const t = msg.trim();
  return t.length <= max ? t : `${t.slice(0, max - 3)}...`;
}

export async function getActiveTwitterMetricsRun(
  admin: SupabaseClient,
  contestId: string
) {
  return admin
    .from("twitter_metrics_refresh_runs")
    .select(
      "id, status, total_batches, current_batch_index, total_participants, processed_participants, tweets_upserted"
    )
    .eq("contest_id", contestId)
    .in("status", ["pending", "running"])
    .maybeSingle();
}

export type EnsureTwitterMetricsRunParams = {
  contestId: string;
  isRaid: boolean;
  totalBatches: number;
  totalParticipants: number;
  creatorScopeId?: string | null;
};

export async function ensureTwitterMetricsRunForEnqueue(
  admin: SupabaseClient,
  params: EnsureTwitterMetricsRunParams
): Promise<
  { ok: true; runId: string; alreadyActive: boolean } | { ok: false; error: string }
> {
  const {
    contestId,
    isRaid,
    totalBatches,
    totalParticipants,
    creatorScopeId = null,
  } = params;

  const { data: existingRow, error: existingErr } =
    await getActiveTwitterMetricsRun(admin, contestId);
  if (existingErr) {
    console.error("[twitter-metrics-runs] getActive error", existingErr);
    return { ok: false, error: "Failed to check active run" };
  }
  if (existingRow?.id) {
    return { ok: true, runId: existingRow.id, alreadyActive: true };
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await admin
    .from("twitter_metrics_refresh_runs")
    .insert({
      contest_id: contestId,
      status: "running",
      is_raid: isRaid,
      total_batches: totalBatches,
      current_batch_index: 0,
      total_participants: totalParticipants,
      processed_participants: 0,
      tweets_upserted: 0,
      creator_scope_id: creatorScopeId,
      started_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: again } = await getActiveTwitterMetricsRun(
        admin,
        contestId
      );
      if (again?.id) {
        return { ok: true, runId: again.id, alreadyActive: true };
      }
    }
    console.error("[twitter-metrics-runs] insert failed", insertError);
    return { ok: false, error: "Failed to create run" };
  }

  return { ok: true, runId: inserted.id, alreadyActive: false };
}

export async function advanceTwitterMetricsRunAfterBatch(
  admin: SupabaseClient,
  opts: {
    runId: string;
    batchIndex: number;
    totalParticipants: number;
    tweetsDelta?: number;
  }
): Promise<void> {
  const { runId, batchIndex, totalParticipants, tweetsDelta = 0 } = opts;
  const processed = Math.min(
    totalParticipants,
    (batchIndex + 1) * RAID_OR_AWARENESS_BATCH_SIZE
  );

  const { data: row } = await admin
    .from("twitter_metrics_refresh_runs")
    .select("tweets_upserted")
    .eq("id", runId)
    .maybeSingle();

  const prevTweets =
    typeof row?.tweets_upserted === "number" ? row.tweets_upserted : 0;
  const now = new Date().toISOString();

  await admin
    .from("twitter_metrics_refresh_runs")
    .update({
      current_batch_index: batchIndex + 1,
      processed_participants: processed,
      tweets_upserted: prevTweets + tweetsDelta,
      last_batch_completed_at: now,
      updated_at: now,
    })
    .eq("id", runId);
}

export async function completeTwitterMetricsRun(
  admin: SupabaseClient,
  runId: string
): Promise<void> {
  const { data: row } = await admin
    .from("twitter_metrics_refresh_runs")
    .select("total_participants, status, total_batches")
    .eq("id", runId)
    .maybeSingle();

  if (!row || row.status === "cancelled" || row.status === "completed") {
    return;
  }

  const now = new Date().toISOString();
  const total =
    typeof row.total_participants === "number" ? row.total_participants : 0;
  const totalBatches =
    typeof row.total_batches === "number" ? row.total_batches : 1;

  await admin
    .from("twitter_metrics_refresh_runs")
    .update({
      status: "completed",
      finished_at: now,
      updated_at: now,
      processed_participants: total,
      current_batch_index: totalBatches,
    })
    .eq("id", runId);
}

export async function failTwitterMetricsRun(
  admin: SupabaseClient,
  runId: string,
  message: string
): Promise<void> {
  const { data: row } = await admin
    .from("twitter_metrics_refresh_runs")
    .select("status")
    .eq("id", runId)
    .maybeSingle();
  if (
    row?.status === "cancelled" ||
    row?.status === "completed" ||
    row?.status === "failed"
  ) {
    return;
  }
  const now = new Date().toISOString();
  await admin
    .from("twitter_metrics_refresh_runs")
    .update({
      status: "failed",
      finished_at: now,
      updated_at: now,
      error_message: truncateErr(message),
    })
    .eq("id", runId);
}

/** Skip work if the run was cancelled (admin/creator). */
export async function isTwitterMetricsRunCancelled(
  admin: SupabaseClient,
  runId: string
): Promise<boolean> {
  const { data } = await admin
    .from("twitter_metrics_refresh_runs")
    .select("status")
    .eq("id", runId)
    .maybeSingle();
  return data?.status === "cancelled";
}
