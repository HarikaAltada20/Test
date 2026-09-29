import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { parseBrandAnalyticsContext } from "@/lib/brand-analytics-context";
import {
  getCachedBrandAnalyticsBundle,
  resolveBrandMetricPlatformScope,
  twitterContestIdsWithRollupActivity,
} from "@/lib/brand-analytics-cache";
import { buildBrandOverviewResponse } from "@/lib/brand-analytics-response";
import { brandAnalyticsClientErrorMessage } from "@/lib/brand-analytics-errors";
import { resolveBrandTwitterPayoutsCents } from "@/lib/brand-analytics-payouts";

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

    const platformScope = resolveBrandMetricPlatformScope(parsed.ctx);
    const twitterContestIds = platformScope.includeTwitter
      ? twitterContestIdsWithRollupActivity(bundle.twitterContestRollup)
      : [];

    let twitterPayoutsCents = 0;
    if (twitterContestIds.length > 0) {
      const admin = createAdminClient();
      twitterPayoutsCents = await resolveBrandTwitterPayoutsCents(
        admin,
        twitterContestIds,
        parsed.ctx,
      );
    }

    const response = buildBrandOverviewResponse(bundle, twitterPayoutsCents);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Analytics overview error:", error);
    return NextResponse.json(
      { error: brandAnalyticsClientErrorMessage(error) },
      { status: 500 },
    );
  }
}
