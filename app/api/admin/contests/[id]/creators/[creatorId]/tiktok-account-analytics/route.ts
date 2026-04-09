import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { TikTokSyncService } from "@/lib/tiktok/services/TikTokSyncService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; creatorId: string }> }
) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: contestId, creatorId } = await context.params;
  const sync = request.nextUrl.searchParams.get("sync") === "1";
  const admin = createAdminClient();

  if (sync) {
    try {
      const syncService = new TikTokSyncService();
      const result = await syncService.syncCreatorMetrics(creatorId);
      if (!result.success) {
        console.warn(
          "[tiktok-account-analytics] sync completed with error:",
          result.error,
        );
      }
    } catch (e: unknown) {
      console.error("[tiktok-account-analytics] sync failed:", e);
      return NextResponse.json(
        {
          error: "Sync failed",
          details: e instanceof Error ? e.message : String(e),
        },
        { status: 500 },
      );
    }
  }

  // 1. Verify creator is in the contest (has at least one submission)
  const { data: submission, error: subError } = await admin
    .from("submissions")
    .select("id")
    .eq("contest_id", contestId)
    .eq("creator_id", creatorId)
    .limit(1)
    .maybeSingle();

  if (subError) {
    console.error("[tiktok-account-analytics] submission check error:", subError);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  if (!submission) {
    return NextResponse.json({ error: "Creator not found in this contest" }, { status: 404 });
  }

  // 2. Fetch TikTok account data
  const { data: profile, error: profError } = await admin
    .from("creator_profiles")
    .select("tiktok_account")
    .eq("id", creatorId)
    .single();

  if (profError || !profile) {
    return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });
  }

  const tiktokAccount = profile.tiktok_account as any;
  const marketing = tiktokAccount?.marketing;

  const { data: tiktokSubmissions, error: subFetchError } = await admin
    .from("submissions")
    .select(
      "id, content_link, views, other_stats, last_insights_update, insights_status, created_at",
    )
    .eq("contest_id", contestId)
    .eq("creator_id", creatorId)
    .eq("platform", "tiktok")
    .order("created_at", { ascending: true });

  if (subFetchError) {
    console.error("[tiktok-account-analytics] submissions:", subFetchError);
  }

  return NextResponse.json({
    hasMarketingAccount: !!marketing?.access_token,
    marketingData: marketing || null,
    lastSyncedAt: marketing?.last_synced_at || tiktokAccount?.last_synced_at || null,
    demographics: marketing?.demographics || null,
    submissions: tiktokSubmissions ?? [],
  });
}
