import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { syncContestToMetrics } from "@/lib/twitter-metrics-sync";

export const dynamic = "force-dynamic";

/**
 * Sync contest Twitter campaign data to twitter_campaign_metrics table
 * Called after contest creation or update
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contestId } = await params;
    const supabaseAdmin = createAdminClient();

    // Get contest data
    const { data: contest, error: contestError } = await supabaseAdmin
      .from("contests")
      .select("id, platform, contest_based_details")
      .eq("id", contestId)
      .maybeSingle();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: "Contest not found" },
        { status: 404 }
      );
    }

    // Only sync if it's a Twitter campaign
    if (contest.platform !== "twitter") {
      return NextResponse.json({
        success: true,
        message: "Not a Twitter campaign, skipping sync",
      });
    }

    const twitterCampaign = contest.contest_based_details?.twitter_campaign;
    if (!twitterCampaign) {
      return NextResponse.json({
        success: true,
        message: "No Twitter campaign config found, skipping sync",
      });
    }

    // Sync to metrics table
    await syncContestToMetrics(contestId, twitterCampaign, supabaseAdmin);

    return NextResponse.json({
      success: true,
      message: "Metrics synced successfully",
    });
  } catch (error: any) {
    console.error("[sync-metrics] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to sync metrics" },
      { status: 500 }
    );
  }
}

