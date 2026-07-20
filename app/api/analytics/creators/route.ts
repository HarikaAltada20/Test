import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { parseBrandAnalyticsContext } from "@/lib/brand-analytics-context";
import {
  getCachedBrandAnalyticsCreatorsBundle,
  statusMatchesFilter,
} from "@/lib/brand-analytics-cache";
import { buildBrandCreatorsResponse } from "@/lib/brand-analytics-response";

async function buildCreatorDetailResponse(
  advertiserId: string,
  creatorId: string,
  ctx: ReturnType<typeof parseBrandAnalyticsContext> & { ok: true },
) {
  const supabase = createAdminClient();
  const bundle = await getCachedBrandAnalyticsCreatorsBundle(ctx.ctx);

  const { data: creator } = await supabase
    .from("users")
    .select(
      `id, username, email, created_at, creator_profiles (bio, total_contests_participated, total_contests_won, total_views, total_money_won, youtube_account, instagram_account)`,
    )
    .eq("id", creatorId)
    .single();

  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  let totalSubmissions = 0;
  let totalViews = 0;
  let totalEarnings = 0;
  const platformStats: Record<
    string,
    { submissions: number; views: number; earnings: number }
  > = {};
  const contestTypeStats: Record<
    string,
    { submissions: number; views: number; earnings: number }
  > = {};
  const performanceTimeline: Record<
    string,
    { submissions: number; views: number; earnings: number }
  > = {};

  const addBucket = (
    map: Record<
      string,
      { submissions: number; views: number; earnings: number }
    >,
    key: string,
    submissions: number,
    views: number,
    earnings: number,
  ) => {
    if (!map[key]) {
      map[key] = { submissions: 0, views: 0, earnings: 0 };
    }
    map[key].submissions += submissions;
    map[key].views += views;
    map[key].earnings += earnings;
  };

  for (const row of bundle.creatorRollup) {
    if (row.creator_id !== creatorId) continue;
    if (!statusMatchesFilter(row.status, ctx.ctx)) continue;
    totalSubmissions += row.submission_count;
    totalViews += row.views_sum;
    totalEarnings += row.earnings_cents_sum;
    addBucket(
      platformStats,
      row.platform,
      row.submission_count,
      row.views_sum,
      row.earnings_cents_sum,
    );
    addBucket(
      contestTypeStats,
      row.contest_type,
      row.submission_count,
      row.views_sum,
      row.earnings_cents_sum,
    );
    if (row.first_created_at) {
      const month = new Date(row.first_created_at).toISOString().slice(0, 7);
      addBucket(
        performanceTimeline,
        month,
        row.submission_count,
        row.views_sum,
        row.earnings_cents_sum,
      );
    }
  }

  for (const row of bundle.twitterCreatorRollup) {
    if (row.creator_id !== creatorId) continue;
    if (!statusMatchesFilter(row.status, ctx.ctx)) continue;
    totalSubmissions += row.submission_count;
    totalViews += row.views_sum;
    addBucket(
      platformStats,
      "twitter",
      row.submission_count,
      row.views_sum,
      0,
    );
    addBucket(
      contestTypeStats,
      row.contest_type,
      row.submission_count,
      row.views_sum,
      0,
    );
    if (row.first_created_at) {
      const month = new Date(row.first_created_at).toISOString().slice(0, 7);
      addBucket(
        performanceTimeline,
        month,
        row.submission_count,
        row.views_sum,
        0,
      );
    }
  }

  if (bundle.twitterContestIds.length > 0) {
    const { data: lbRows } = await supabase
      .from("twitter_campaign_leaderboard")
      .select("earnings")
      .in("contest_id", bundle.twitterContestIds)
      .eq("creator_id", creatorId);
    for (const row of lbRows ?? []) {
      totalEarnings += Number(row.earnings ?? 0) || 0;
    }
  }

  const contestIds = bundle.videoContestIds;
  let topSubmissions: unknown[] = [];
  if (contestIds.length > 0) {
    const CONTEST_ID_CHUNK = 500;
    for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
      const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
      const { data, error } = await supabase.rpc(
        "brand_analytics_creator_top_submissions",
        {
          p_from: ctx.ctx.dateFrom.toISOString(),
          p_to: ctx.ctx.dateTo.toISOString(),
          p_contest_ids: idChunk,
          p_creator_id: creatorId,
          p_limit: 10,
        },
      );
      if (!error && data) {
        topSubmissions = topSubmissions.concat(data);
      }
    }
    topSubmissions = topSubmissions
      .sort(
        (a: { views?: number }, b: { views?: number }) =>
          (Number(b.views) || 0) - (Number(a.views) || 0),
      )
      .slice(0, 10);
  }

  const avgViewsPerSubmission =
    totalSubmissions > 0 ? totalViews / totalSubmissions : 0;

  return NextResponse.json({
    creator: {
      ...creator,
      metrics: {
        totalSubmissions,
        totalViews,
        totalEarnings,
        avgViewsPerSubmission: Math.round(avgViewsPerSubmission * 100) / 100,
      },
      platformStats,
      contestTypeStats,
      performanceTimeline,
      topSubmissions,
    },
  });
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

    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const { data: userData } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (userData?.user_type !== "advertiser") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = parseBrandAnalyticsContext(user.id, searchParams);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    if (creatorId) {
      return buildCreatorDetailResponse(user.id, creatorId, parsed);
    }

    if (
      parsed.ctx.contestTypeSet !== null &&
      parsed.ctx.contestTypeSet.size === 0
    ) {
      return NextResponse.json({
        dataSource: parsed.ctx.dataSource,
          leaderboards: {
            topByViews: [],
            topByViewsYoutubeInstagram: [],
            topByViewsTwitter: [],
            topBySubmissions: [],
            topByEarnings: [],
          },
          summary: {
            totalUniqueCreators: 0,
            totalSubmissions: 0,
            totalViews: 0,
            totalEarnings: 0,
          totalPayoutsCents: 0,
            avgSubmissionsPerCreator: 0,
            avgViewsPerCreator: 0,
            avgEarningsPerCreator: 0,
          avgPayoutsPerCreator: 0,
          },
          demographics: {
            platformDemographics: {},
            contestTypePreferences: {},
          },
        });
      }

    const bundle = await getCachedBrandAnalyticsCreatorsBundle(parsed.ctx);
    const admin = createAdminClient();

    const twitterLeaderboardByCreator = new Map<string, number>();
    if (bundle.twitterContestIds.length > 0) {
      const { data: leaderboard } = await admin
        .from("twitter_campaign_leaderboard")
        .select("creator_id, earnings")
        .in("contest_id", bundle.twitterContestIds);
      for (const row of leaderboard ?? []) {
        const id = String(row.creator_id ?? "");
        if (!id) continue;
        twitterLeaderboardByCreator.set(
          id,
          (twitterLeaderboardByCreator.get(id) ?? 0) +
            (Number(row.earnings ?? 0) || 0),
        );
      }
    }

    const response = await buildBrandCreatorsResponse(
      bundle,
      admin,
      limit,
      twitterLeaderboardByCreator,
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Analytics creators error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
