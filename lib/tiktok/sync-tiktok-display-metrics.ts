import type { SupabaseClient } from "@supabase/supabase-js";
import { TikTokProvider } from "@/lib/tiktok/provider/TikTokProvider";
import { extractTikTokVideoIdFromLink } from "@/lib/tiktok/extract-video-id";
import { ensureFreshTikTokToken } from "@/lib/tiktok/ensure-fresh-tiktok-token";

export type TikTokSubmissionRow = {
  id: string;
  content_link: string | null;
  video_id?: string | null;
  other_stats?: unknown;
};

const QUERY_CHUNK = 20;

/**
 * Refreshes TikTok submission metrics using Login Kit only (Display API video.query).
 */
export async function syncCreatorTikTokDisplayMetrics(
  supabase: SupabaseClient,
  creatorId: string,
  submissions: TikTokSubmissionRow[],
): Promise<{ success: boolean; error?: string; videosSynced: number }> {
  const provider = new TikTokProvider();

  const tokenResult = await ensureFreshTikTokToken(supabase, creatorId);
  if (!tokenResult.ok) {
    return {
      success: false,
      error: tokenResult.error,
      videosSynced: 0,
    };
  }
  const access_token = tokenResult.accessToken;

  const rows: { sub: TikTokSubmissionRow; videoId: string }[] = [];
  for (const sub of submissions) {
    const vid =
      (sub.video_id && String(sub.video_id)) ||
      extractTikTokVideoIdFromLink(sub.content_link);
    if (vid) rows.push({ sub, videoId: vid });
  }

  const uniqueIds = [...new Set(rows.map((r) => r.videoId))];
  if (!uniqueIds.length) {
    return { success: true, videosSynced: 0 };
  }

  const videoById = new Map<
    string,
    {
      viewCount: number;
      likeCount: number;
      commentCount: number;
      shareCount: number;
      url?: string;
    }
  >();

  for (let i = 0; i < uniqueIds.length; i += QUERY_CHUNK) {
    const chunk = uniqueIds.slice(i, i + QUERY_CHUNK);
    try {
      const metrics = await provider.getVideoMetrics(access_token, chunk);
      for (const m of metrics) {
        videoById.set(m.videoId, {
          viewCount: m.viewCount,
          likeCount: m.likeCount,
          commentCount: m.commentCount,
          shareCount: m.shareCount,
          url: m.url,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(
        `[sync-tiktok-display-metrics] queryVideos failed for creator ${creatorId}:`,
        msg,
      );
      return { success: false, error: msg, videosSynced: 0 };
    }
  }

  let videosSynced = 0;
  let sumViews = 0;
  let sumLikes = 0;
  let sumComments = 0;
  let sumShares = 0;

  for (const { sub, videoId } of rows) {
    const m = videoById.get(videoId);
    if (!m) continue;

    const views = m.viewCount;
    const likes = m.likeCount;
    const comments = m.commentCount;
    const shares = m.shareCount;

    sumViews += views;
    sumLikes += likes;
    sumComments += comments;
    sumShares += shares;

    const currentOtherStats =
      typeof sub.other_stats === "string"
        ? JSON.parse(sub.other_stats)
        : sub.other_stats || {};

    /** Display API Video Object counts only — https://developers.tiktok.com/doc/tiktok-api-v2-video-object */
    const tiktokStats = {
      view_count: views,
      like_count: likes,
      comment_count: comments,
      share_count: shares,
      last_updated: new Date().toISOString(),
    };

    await supabase
      .from("submissions")
      .update({
        views,
        other_stats: { ...currentOtherStats, tiktok: tiktokStats },
        last_insights_update: new Date().toISOString(),
        insights_status: "ok",
      })
      .eq("id", sub.id);

    videosSynced++;
  }

  await supabase
    .from("creator_profiles")
    .update({
      tiktok_achieved: {
        views: sumViews,
        likes: sumLikes,
        comments: sumComments,
        shares: sumShares,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", creatorId);

  return { success: true, videosSynced };
}
