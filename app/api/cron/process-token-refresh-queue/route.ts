import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ensureFreshTikTokToken } from "@/lib/tiktok/ensure-fresh-tiktok-token";
import { refreshToken as refreshInstagramToken } from "@/lib/instagram-insights";
import { refreshAccessToken as refreshYouTubeToken } from "@/lib/youtube-api";
import { 
  authorizeProcessTokenRefreshQueue, 
  triggerProcessTokenRefreshQueue,
  isQStashEnabled 
} from "@/lib/qstash";
import { 
  popTokenRefreshJob, 
  removeFromProcessing, 
  recoverProcessingJobsToQueue 
} from "@/lib/queue/token-refresh-queue";
import dayjs from "dayjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const isAuthorized = await authorizeProcessTokenRefreshQueue(request, rawBody);
  
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = getBaseUrlFromRequest(request);
  
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

    await refreshProfileTokens(supabaseAdmin, profile);

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

async function refreshProfileTokens(supabase: SupabaseClient, profile: any) {
  const creatorId = profile.id;

  // TikTok
  if (profile.tiktok_account) {
    await ensureFreshTikTokToken(supabase, creatorId).catch(console.error);
  }

  // Instagram
  if (profile.instagram_account?.access_token) {
    try {
      const igAccount = profile.instagram_account;
      const res = await refreshInstagramToken(creatorId, igAccount.access_token);
      if (res) {
        const newExpiry = dayjs().add(res.expires_in || 5184000, "second").toISOString();
        await supabase.from("creator_profiles").update({
          instagram_account: {
            ...igAccount,
            access_token: res.access_token,
            token_expiry: newExpiry,
            updated_at: new Date().toISOString(),
            needs_reconnect: false
          }
        }).eq("id", creatorId);
      }
    } catch (e) {}
  }

  // YouTube
  if (profile.youtube_account?.refresh_token) {
    try {
      const ytAccount = profile.youtube_account;
      const res = await refreshYouTubeToken(ytAccount.refresh_token);
      if (res) {
        await supabase.from("creator_profiles").update({
          youtube_account: {
            ...ytAccount,
            access_token: res.access_token,
            refresh_token: res.refresh_token || ytAccount.refresh_token,
            expires_at: res.expires_at,
            updated_at: new Date().toISOString(),
            needs_reconnect: false
          }
        }).eq("id", creatorId);
      }
    } catch (e) {}
  }
}

function getBaseUrlFromRequest(request: Request): string {
  try {
    const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (xfHost && xfProto) return `${xfProto}://${xfHost}`;
    const u = new URL(request.url);
    return u.origin;
  } catch {
    return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  }
}
