import type { SupabaseClient } from "@supabase/supabase-js";
import type { YouTubeMetricsWriteTarget } from "./youtube-metrics-write-target";

/** Only send fields fetched by this request, never a submission's old other_stats. */
export async function patchYouTubeMetrics(
  supabase: SupabaseClient,
  submissionId: string,
  youtubePatch: Record<string, unknown>,
  rowPatch: {
    views?: number;
    insights_status: string;
    last_insights_update: string;
    updated_at: string;
  },
  target: YouTubeMetricsWriteTarget = "submissions",
): Promise<{ error: { message: string } | null }> {
  const { data, error } = await supabase.rpc("patch_youtube_submission_metrics", {
    p_submission_id: submissionId,
    p_youtube_patch: youtubePatch,
    p_row_patch: rowPatch,
    p_post_campaign: target === "post_campaign_submission_metrics",
  });
  // No fallback to a whole-JSON update: a missing migration must fail safely.
  if (error) return { error };
  if (data !== true) {
    return { error: { message: "YouTube metrics row is missing or locked for review" } };
  }
  return { error: null };
}
