import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enqueueTokenRefreshJobs } from "@/lib/queue/token-refresh-queue";
import { triggerProcessTokenRefreshQueue, getQStashPublishBaseUrl } from "@/lib/qstash";

export const dynamic = "force-dynamic";

/**
 * Entry point for daily token refresh.
 * Fetches all creators with connected accounts and pushes them to the Redis queue.
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

  console.log("[Token Refresh] Starting global token refresh process (Enqueuing)...");

  try {
    // 1. Fetch all profiles that need refreshing
    const { data: profiles, error: fetchError } = await supabaseAdmin
      .from("creator_profiles")
      .select("id")
      .or("tiktok_account.not.is.null,instagram_account.not.is.null,youtube_account.not.is.null");

    if (fetchError) throw fetchError;

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: "No profiles to refresh" });
    }

    console.log(`[Token Refresh] Found ${profiles.length} creators. Enqueueing to Redis...`);

    // 2. Batch enqueue to Redis (max 1000 per rpush for safety)
    const jobs = profiles.map(p => ({ creatorId: p.id }));
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
      const chunk = jobs.slice(i, i + CHUNK_SIZE);
      await enqueueTokenRefreshJobs(chunk);
    }

    // 3. Trigger the processor
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
      message: "Token refresh jobs enqueued successfully",
      count: profiles.length
    });

  } catch (error: any) {
    console.error("[Token Refresh] Enqueue failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

