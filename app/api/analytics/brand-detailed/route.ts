import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { parseBrandAnalyticsContext } from "@/lib/brand-analytics-context";
import { getCachedBrandAnalyticsBundle } from "@/lib/brand-analytics-cache";
import { buildBrandDetailedResponse } from "@/lib/brand-analytics-response";
import { sumTwitterLeaderboardPayoutsCents } from "@/lib/brand-analytics-payouts";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (userData?.user_type !== "advertiser") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = parseBrandAnalyticsContext(
      user.id,
      new URL(request.url).searchParams,
    );
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const bundle = await getCachedBrandAnalyticsBundle(parsed.ctx);

    let twitterLeaderboardPayoutsCents = 0;
    if (bundle.twitterContestIds.length > 0) {
      const admin = createAdminClient();
      const { data: leaderboard } = await admin
        .from("twitter_campaign_leaderboard")
        .select("earnings")
        .in("contest_id", bundle.twitterContestIds);
      twitterLeaderboardPayoutsCents = sumTwitterLeaderboardPayoutsCents(
        leaderboard ?? [],
      );
    }

    return NextResponse.json(
      buildBrandDetailedResponse(bundle, twitterLeaderboardPayoutsCents),
    );
  } catch (error) {
    console.error("Brand detailed analytics error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
