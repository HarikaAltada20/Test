import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ensureFreshTikTokToken } from "@/lib/tiktok/ensure-fresh-tiktok-token";
import { refreshToken as refreshInstagramToken, isTokenExpiring } from "@/lib/instagram-insights";
import { refreshAccessToken as refreshYouTubeToken } from "@/lib/youtube-api";
import dayjs from "dayjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify CRON secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  console.log("[Refresh Cron] Starting global token refresh job...");

  try {
    // Fetch all profiles with at least one connected account
    const { data: profiles, error: fetchError } = await supabaseAdmin
      .from("creator_profiles")
      .select("id, tiktok_account, instagram_account, youtube_account")
      .or("tiktok_account.not.is.null,instagram_account.not.is.null,youtube_account.not.is.null");

    if (fetchError) {
      throw new Error(`Failed to fetch profiles: ${fetchError.message}`);
    }

    console.log(`[Refresh Cron] Found ${profiles?.length || 0} profiles to process.`);

    const stats = {
      total: profiles?.length || 0,
      tiktok: { success: 0, failed: 0, skipped: 0 },
      instagram: { success: 0, failed: 0, skipped: 0 },
      youtube: { success: 0, failed: 0, skipped: 0 },
    };

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: "No profiles to refresh", stats });
    }

    for (const profile of profiles) {
      // 1. TikTok Refresh
      if (profile.tiktok_account) {
        try {
          const result = await ensureFreshTikTokToken(supabaseAdmin, profile.id);
          if (result.ok) {
            stats.tiktok.success++;
          } else {
            console.warn(`[Refresh Cron] TikTok refresh failed for ${profile.id}: ${result.error}`);
            stats.tiktok.failed++;
          }
        } catch (e) {
          console.error(`[Refresh Cron] TikTok error for ${profile.id}:`, e);
          stats.tiktok.failed++;
        }
      } else {
        stats.tiktok.skipped++;
      }

      // 2. Instagram Refresh
      if (profile.instagram_account) {
        try {
          const igAccount = profile.instagram_account as any;
          // Refresh if expiring within 10 days, or just refresh anyway to be safe
          // Actually, Meta long-lived tokens can be refreshed once a day to extend them.
          if (igAccount.access_token) {
            const refreshResult = await refreshInstagramToken(profile.id, igAccount.access_token);
            if (refreshResult) {
              const newExpiry = dayjs().add(refreshResult.expires_in || 5184000, "second").toISOString();
              await supabaseAdmin
                .from("creator_profiles")
                .update({
                  instagram_account: {
                    ...igAccount,
                    access_token: refreshResult.access_token,
                    token_expiry: newExpiry,
                    updated_at: new Date().toISOString(),
                    needs_reconnect: false,
                  },
                })
                .eq("id", profile.id);
              stats.instagram.success++;
            } else {
              // mark for reconnect if refresh fails
              await supabaseAdmin
                .from("creator_profiles")
                .update({
                  instagram_account: {
                    ...igAccount,
                    needs_reconnect: true,
                    updated_at: new Date().toISOString(),
                  },
                })
                .eq("id", profile.id);
              stats.instagram.failed++;
            }
          }
        } catch (e) {
          console.error(`[Refresh Cron] Instagram error for ${profile.id}:`, e);
          stats.instagram.failed++;
        }
      } else {
        stats.instagram.skipped++;
      }

      // 3. YouTube Refresh
      if (profile.youtube_account) {
        try {
          const ytAccount = profile.youtube_account as any;
          if (ytAccount.refresh_token) {
            const refreshResult = await refreshYouTubeToken(ytAccount.refresh_token);
            if (refreshResult) {
              await supabaseAdmin
                .from("creator_profiles")
                .update({
                  youtube_account: {
                    ...ytAccount,
                    access_token: refreshResult.access_token,
                    refresh_token: refreshResult.refresh_token || ytAccount.refresh_token,
                    expires_at: refreshResult.expires_at,
                    updated_at: new Date().toISOString(),
                    needs_reconnect: false,
                  },
                })
                .eq("id", profile.id);
              stats.youtube.success++;
            } else {
              await supabaseAdmin
                .from("creator_profiles")
                .update({
                  youtube_account: {
                    ...ytAccount,
                    needs_reconnect: true,
                    updated_at: new Date().toISOString(),
                  },
                })
                .eq("id", profile.id);
              stats.youtube.failed++;
            }
          }
        } catch (e) {
          console.error(`[Refresh Cron] YouTube error for ${profile.id}:`, e);
          stats.youtube.failed++;
        }
      } else {
        stats.youtube.skipped++;
      }
    }

    console.log("[Refresh Cron] Job completed.", stats);

    return NextResponse.json({
      message: "Token refresh job completed",
      stats,
    });
  } catch (error: any) {
    console.error("[Refresh Cron] Job failed:", error);
    return NextResponse.json(
      { error: `Token refresh job failed: ${error.message}` },
      { status: 500 }
    );
  }
}
