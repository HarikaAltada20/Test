import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  clearDailyChallengeCache,
  dailyChallengeCache,
  getDailyChallengeCacheKey,
} from "@/lib/cache-utils";
import {
  CompetitionPeriod,
  SubmissionScope,
  getDailyChallengeLeaderboard,
} from "@/lib/daily-challenge";

const VALID_PERIODS: CompetitionPeriod[] = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "all_time",
];
const VALID_SCOPES: SubmissionScope[] = ["pending", "verified", "all"];

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get("period") || "today") as CompetitionPeriod;
    const scope = (searchParams.get("scope") || "verified") as SubmissionScope;
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(5, Number(searchParams.get("limit") || 25)));
    const fresh = searchParams.get("fresh") === "1";

    if (!VALID_PERIODS.includes(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }
    if (!VALID_SCOPES.includes(scope)) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const cacheKey = getDailyChallengeCacheKey({ period, scope, page, limit });
    if (!fresh) {
      const cached = dailyChallengeCache.get<any>(cacheKey);
      if (cached) return NextResponse.json({ ...cached, cached: true });
    } else {
      clearDailyChallengeCache();
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = await getDailyChallengeLeaderboard({
      period,
      scope,
      page,
      limit,
      meUserId: user?.id || null,
    });

    dailyChallengeCache.set(cacheKey, payload, 60 * 60 * 1000);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[competition/leaderboard] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
