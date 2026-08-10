import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enqueueTokenRefreshJobs } from "@/lib/queue/token-refresh-queue";
import { isCreatorDueForWeeklyTokenRefresh } from "@/lib/token-refresh-eligibility";
import { triggerProcessTokenRefreshQueue, getQStashPublishBaseUrl } from "@/lib/qstash";

export const dynamic = "force-dynamic";

/**
 * Daily sweeper for weekly token + account-details refresh.
 * Only enqueues creators whose connected social account(s) are due
 * (7 days from connection / last successful details refresh).
 */
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
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  console.log("[Token Refresh] Starting weekly-due token refresh enqueue...");

  try {
    const now = new Date();
    const PAGE_SIZE = 1000;
    const dueJobs: { creatorId: string }[] = [];
    let scanned = 0;
    let cursor: string | null = null;

    // Page through connected creators and keep only those due for weekly refresh.
    for (;;) {
      let query = supabaseAdmin
        .from("creator_profiles")
        .select("id, tiktok_account, instagram_account, youtube_account")
        .or(
          "tiktok_account.not.is.null,instagram_account.not.is.null,youtube_account.not.is.null",
        )
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);

      if (cursor) {
        query = query.gt("id", cursor);
      }

      const { data: profiles, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      if (!profiles || profiles.length === 0) break;

      scanned += profiles.length;
      for (const profile of profiles) {
        if (isCreatorDueForWeeklyTokenRefresh(profile, now)) {
          dueJobs.push({ creatorId: profile.id });
        }
      }

      cursor = profiles[profiles.length - 1]?.id ?? null;
      if (profiles.length < PAGE_SIZE || !cursor) break;
    }

    if (dueJobs.length === 0) {
      return NextResponse.json({
        message: "No creators due for weekly token refresh",
        scanned,
        count: 0,
      });
    }

    console.log(
      `[Token Refresh] Scanned ${scanned} creators; ${dueJobs.length} due. Enqueueing...`,
    );

    const CHUNK_SIZE = 1000;
    for (let i = 0; i < dueJobs.length; i += CHUNK_SIZE) {
      const chunk = dueJobs.slice(i, i + CHUNK_SIZE);
      await enqueueTokenRefreshJobs(chunk);
    }

    const baseUrl = getQStashPublishBaseUrl(request);
    const triggerRes = await triggerProcessTokenRefreshQueue(baseUrl);
    if (triggerRes?.error) {
      console.log("[Token Refresh] QStash trigger returned error (probably loopback). Falling back to direct fetch...");
      fetch(`${baseUrl}/api/cron/process-token-refresh-queue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
      }).catch(e => console.error("[Token Refresh] Fallback trigger failed:", e));
    }

    return NextResponse.json({
      message: "Weekly-due token refresh jobs enqueued successfully",
      scanned,
      count: dueJobs.length,
    });

  } catch (error: any) {
    console.error("[Token Refresh] Enqueue failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
