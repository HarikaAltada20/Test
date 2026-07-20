import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { parseBrandAnalyticsContext } from "@/lib/brand-analytics-context";
import { getCachedBrandAnalyticsBundle } from "@/lib/brand-analytics-cache";
import { buildBrandOverviewResponse } from "@/lib/brand-analytics-response";
import { sumTwitterLeaderboardPayoutsCents } from "@/lib/brand-analytics-payouts";

async function fetchTwitterLeaderboardPayoutsCents(
  twitterContestIds: string[],
): Promise<number> {
  if (twitterContestIds.length === 0) return 0;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("twitter_campaign_leaderboard")
    .select("earnings")
    .in("contest_id", twitterContestIds);
  if (error) return 0;
  return sumTwitterLeaderboardPayoutsCents(data ?? []);
}

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
    const response = buildBrandOverviewResponse(bundle);

    const twitterPayouts = await fetchTwitterLeaderboardPayoutsCents(
      bundle.twitterContestIds,
    );
    response.overview.totalPayoutsCents =
      response.overview.totalPayoutsCents + twitterPayouts;

    return NextResponse.json(response);
  } catch (error) {
    console.error("Analytics overview error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
