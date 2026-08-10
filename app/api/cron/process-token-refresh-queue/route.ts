import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ensureFreshTikTokToken } from "@/lib/tiktok/ensure-fresh-tiktok-token";
import { TikTokProvider } from "@/lib/tiktok/provider/TikTokProvider";
import { refreshToken as refreshInstagramToken } from "@/lib/instagram-insights";
import {
  refreshAccessToken as refreshYouTubeToken,
  getChannelInfo,
} from "@/lib/youtube-api";
import {
  authorizeProcessTokenRefreshQueue,
  triggerProcessTokenRefreshQueue,
  isQStashEnabled,
  getQStashPublishBaseUrl,
} from "@/lib/qstash";
import {
  popTokenRefreshJob,
  removeFromProcessing,
  recoverProcessingJobsToQueue,
} from "@/lib/queue/token-refresh-queue";
import {
  isPlatformAccountDueForWeeklyRefresh,
  withWeeklyRefreshTimestamps,
} from "@/lib/token-refresh-eligibility";
import dayjs from "dayjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const isAuthorized = await authorizeProcessTokenRefreshQueue(request, rawBody);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = getQStashPublishBaseUrl(request);

  // 1. Recover stranded jobs occasionally
  if (Math.random() < 0.1) {
    await recoverProcessingJobsToQueue();
  }

  // 2. Pop one job
  const popped = await popTokenRefreshJob();
  if (!popped) {
    return NextResponse.json({ message: "Queue empty" });
  }

  const { job, raw: rawJobString } = popped;
  const { creatorId } = job;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  console.log(`[Token Refresh Queue] Processing creator: ${creatorId}`);

  try {
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("creator_profiles")
      .select("id, tiktok_account, instagram_account, youtube_account")
      .eq("id", creatorId)
      .single();

    if (fetchError || !profile) {
      throw new Error(`Profile not found: ${creatorId}`);
    }

    await refreshProfileTokensAndDetails(supabaseAdmin, profile);

    // Success: Remove from processing list
    await removeFromProcessing(rawJobString);

    // Trigger next job immediately
    await triggerNext(baseUrl);

    return NextResponse.json({ success: true, creatorId });

  } catch (error: any) {
    console.error(`[Token Refresh Queue] Failed for ${creatorId}:`, error.message);
    // Cleanup so it can be retried or recovered
    // In this specific task, we'll remove it from processing anyway to avoid infinite loops on bad IDs
    await removeFromProcessing(rawJobString);
    await triggerNext(baseUrl);

    // Return 200 OK so QStash knows we acknowledged the failure and handled the transition,
    // avoiding unnecessary retries and double-triggering of the queue.
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}

async function triggerNext(baseUrl: string) {
  const doFetch = () =>
    fetch(`${baseUrl}/api/cron/process-token-refresh-queue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
    }).catch(e => console.error("[Token Refresh Queue] Self-trigger fallback failed:", e));

  if (isQStashEnabled()) {
    triggerProcessTokenRefreshQueue(baseUrl)
      .then((res) => {
        if (res?.error) doFetch();
      })
      .catch(() => doFetch());
  } else {
    doFetch();
  }
}

/**
 * Refresh tokens and re-fetch full account profile details for platforms
 * that are due for their weekly refresh. On success, stamps
 * last_details_refresh_at / next_details_refresh_at (+7 days).
 */
async function refreshProfileTokensAndDetails(
  supabase: SupabaseClient,
  profile: {
    id: string;
    tiktok_account?: Record<string, unknown> | null;
    instagram_account?: Record<string, unknown> | null;
    youtube_account?: Record<string, unknown> | null;
  },
) {
  const creatorId = profile.id;
  const now = new Date();

  if (
    profile.tiktok_account &&
    isPlatformAccountDueForWeeklyRefresh(profile.tiktok_account, now)
  ) {
    await refreshTikTokAccount(supabase, creatorId, profile.tiktok_account, now);
  }

  if (
    profile.instagram_account &&
    isPlatformAccountDueForWeeklyRefresh(profile.instagram_account, now)
  ) {
    await refreshInstagramAccount(
      supabase,
      creatorId,
      profile.instagram_account,
      now,
    );
  }

  if (
    profile.youtube_account &&
    isPlatformAccountDueForWeeklyRefresh(profile.youtube_account, now)
  ) {
    await refreshYouTubeAccount(
      supabase,
      creatorId,
      profile.youtube_account,
      now,
    );
  }
}

async function refreshTikTokAccount(
  supabase: SupabaseClient,
  creatorId: string,
  existing: Record<string, unknown>,
  now: Date,
) {
  try {
    const fresh = await ensureFreshTikTokToken(supabase, creatorId);
    if (!fresh.ok) {
      console.error(
        `[Token Refresh Queue] TikTok token refresh failed for ${creatorId}:`,
        fresh.error,
      );
      return;
    }

    const provider = new TikTokProvider();
    const profile = await provider.getProfile(fresh.accessToken);
    const base = {
      ...(fresh.tiktokAccount || existing),
      platform_user_id: profile.id || existing.platform_user_id,
      username: profile.username || existing.username,
      avatar_url: profile.avatarUrl || existing.avatar_url,
      follower_count: profile.followerCount ?? existing.follower_count,
      following_count: profile.followingCount ?? existing.following_count,
      likes_count: profile.likesCount ?? existing.likes_count,
      video_count: profile.videoCount ?? existing.video_count,
      last_synced_at: now.toISOString(),
      needs_reconnect: false,
    };

    const updated = withWeeklyRefreshTimestamps(base, now);
    await supabase
      .from("creator_profiles")
      .update({
        tiktok_account: updated,
        updated_at: now.toISOString(),
      })
      .eq("id", creatorId);
  } catch (e) {
    console.error(`[Token Refresh Queue] TikTok details refresh failed for ${creatorId}:`, e);
  }
}

async function refreshInstagramAccount(
  supabase: SupabaseClient,
  creatorId: string,
  igAccount: Record<string, unknown>,
  now: Date,
) {
  try {
    const accessToken = igAccount.access_token;
    if (typeof accessToken !== "string" || !accessToken) return;

    let token = accessToken;
    let tokenExpiry =
      typeof igAccount.token_expiry === "string" ? igAccount.token_expiry : null;

    const refreshed = await refreshInstagramToken(creatorId, accessToken);
    if (refreshed?.access_token) {
      token = refreshed.access_token;
      tokenExpiry = dayjs()
        .add(refreshed.expires_in || 5184000, "second")
        .toISOString();
    }

    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count&access_token=${encodeURIComponent(token)}`,
    );
    const profile = await profileRes.json();
    if (!profileRes.ok || profile.error) {
      throw new Error(
        profile.error?.message ||
          `Instagram profile fetch failed (${profileRes.status})`,
      );
    }

    const base = {
      ...igAccount,
      access_token: token,
      token_expiry: tokenExpiry ?? igAccount.token_expiry,
      instagram_user_id:
        profile.user_id || profile.id || igAccount.instagram_user_id,
      username: profile.username ?? igAccount.username,
      profile_picture_url:
        profile.profile_picture_url ?? igAccount.profile_picture_url,
      followers_count: profile.followers_count ?? igAccount.followers_count,
      follows_count: profile.follows_count ?? igAccount.follows_count,
      media_count: profile.media_count ?? igAccount.media_count,
      account_type: profile.account_type ?? igAccount.account_type,
      name_of_account: profile.name ?? igAccount.name_of_account,
      app_scoped_user_id: profile.id ?? igAccount.app_scoped_user_id,
      updated_at: now.toISOString(),
      needs_reconnect: false,
    };

    const updated = withWeeklyRefreshTimestamps(base, now);
    await supabase
      .from("creator_profiles")
      .update({
        instagram_account: updated,
      })
      .eq("id", creatorId);
  } catch (e) {
    console.error(
      `[Token Refresh Queue] Instagram details refresh failed for ${creatorId}:`,
      e,
    );
  }
}

async function refreshYouTubeAccount(
  supabase: SupabaseClient,
  creatorId: string,
  ytAccount: Record<string, unknown>,
  now: Date,
) {
  try {
    const refreshToken =
      typeof ytAccount.refresh_token === "string"
        ? ytAccount.refresh_token
        : null;
    if (!refreshToken) return;

    const tokens = await refreshYouTubeToken(refreshToken);
    if (!tokens?.access_token) return;

    const channelInfo = await getChannelInfo(tokens.access_token);
    const base = {
      ...ytAccount,
      channel_id: channelInfo.id ?? ytAccount.channel_id,
      channel_title: channelInfo.snippet?.title ?? ytAccount.channel_title,
      channel_description:
        channelInfo.snippet?.description ?? ytAccount.channel_description,
      channel_custom_url:
        channelInfo.snippet?.customUrl ?? ytAccount.channel_custom_url,
      subscriber_count:
        channelInfo.statistics?.subscriberCount ?? ytAccount.subscriber_count,
      video_count: channelInfo.statistics?.videoCount ?? ytAccount.video_count,
      view_count: channelInfo.statistics?.viewCount ?? ytAccount.view_count,
      channel_thumbnail:
        channelInfo.snippet?.thumbnails?.default?.url ??
        ytAccount.channel_thumbnail,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshToken,
      expires_at: tokens.expires_at,
      updated_at: now.toISOString(),
      needs_reconnect: false,
    };

    const updated = withWeeklyRefreshTimestamps(base, now);
    await supabase
      .from("creator_profiles")
      .update({
        youtube_account: updated,
      })
      .eq("id", creatorId);
  } catch (e) {
    console.error(
      `[Token Refresh Queue] YouTube details refresh failed for ${creatorId}:`,
      e,
    );
  }
}
