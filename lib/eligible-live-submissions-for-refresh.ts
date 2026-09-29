/**
 * Count eligible live submissions for a metrics-refresh platform.
 * Matches enqueue eligibility (non-rejected + insights filter + platform content).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { insightsRefreshInsightsStatusOrFilter } from "@/lib/insights-refresh-eligibility";
import type { PostCampaignVideoPlatform } from "@/lib/post-campaign-platforms";

export async function countEligibleLiveSubmissionsForPlatform(
  supabaseAdmin: SupabaseClient,
  contestId: string,
  platform: PostCampaignVideoPlatform,
): Promise<number> {
  let query = supabaseAdmin
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("contest_id", contestId)
    .neq("status", "rejected")
    .or(insightsRefreshInsightsStatusOrFilter());

  switch (platform) {
    case "youtube":
      query = query
        .ilike("platform", "%youtube%")
        .not("content_link", "is", null);
      break;
    case "instagram":
      query = query.eq("platform", "instagram").not("video_id", "is", null);
      break;
    case "tiktok":
      query = query
        .eq("platform", "tiktok")
        .or("video_id.not.is.null,content_link.not.is.null");
      break;
  }

  const { count, error } = await query;
  if (error) {
    console.warn(
      "[eligible-live-submissions] count failed",
      { contestId, platform, error: error.message },
    );
    // Fail open: keep platform in the chain rather than dropping it on count errors.
    return 1;
  }
  return count ?? 0;
}

/** Keep only platforms that have at least one eligible live submission. */
export async function filterPlatformsWithEligibleLiveSubmissions(
  supabaseAdmin: SupabaseClient,
  contestId: string,
  platforms: readonly PostCampaignVideoPlatform[],
): Promise<PostCampaignVideoPlatform[]> {
  const out: PostCampaignVideoPlatform[] = [];
  for (const platform of platforms) {
    const n = await countEligibleLiveSubmissionsForPlatform(
      supabaseAdmin,
      contestId,
      platform,
    );
    if (n > 0) out.push(platform);
  }
  return out;
}
