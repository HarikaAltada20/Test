import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { parseBrandAnalyticsContext } from "@/lib/brand-analytics-context";
import {
  creatorHasScopedRollupActivity,
  getCachedBrandAnalyticsCreatorsBundle,
  statusMatchesFilter,
  twitterContestIdsWithRollupActivity,
} from "@/lib/brand-analytics-cache";
import { buildBrandCreatorsResponse } from "@/lib/brand-analytics-response";
import { brandAnalyticsClientErrorMessage } from "@/lib/brand-analytics-errors";
import { fetchTwitterEarningsCentsByCreator } from "@/lib/brand-analytics-payouts";

type CreatorTopSubmissionRow = {
  status?: string | null;
  views?: number | null;
};

type CreatorMonthlyRow = {
  month_key?: string | null;
  status?: string | null;
  submission_count?: number | null;
  views_sum?: number | null;
  earnings_cents_sum?: number | null;
};

/** True if this creator has ever submitted (video / Twitter / PC) on the advertiser's contests. */
async function creatorBelongsToAdvertiser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  advertiserId: string,
  creatorId: string,
): Promise<boolean> {
  const { data: submission } = await supabase
    .from("submissions")
    .select("id, contests!inner(advertiser_id)")
    .eq("creator_id", creatorId)
    .eq("contests.advertiser_id", advertiserId)
    .limit(1)
    .maybeSingle();
  if (submission) return true;

  const { data: tweet } = await supabase
    .from("twitter_campaign_tweets")
    .select("id, contests!inner(advertiser_id)")
    .eq("creator_id", creatorId)
    .eq("contests.advertiser_id", advertiserId)
    .limit(1)
    .maybeSingle();
  if (tweet) return true;

  const { data: pcRow } = await supabase
    .from("post_campaign_submission_metrics")
    .select("submission_id, contests!inner(advertiser_id)")
    .eq("creator_id", creatorId)
    .eq("contests.advertiser_id", advertiserId)
    .limit(1)
    .maybeSingle();
  return Boolean(pcRow);
}

async function buildCreatorDetailResponse(
  advertiserId: string,
  creatorId: string,
  ctx: ReturnType<typeof parseBrandAnalyticsContext> & { ok: true },
) {
  if (ctx.ctx.advertiserId !== advertiserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Authz before profile/PII load: block UUID probing across advertisers.
  const allowed = await creatorBelongsToAdvertiser(
    supabase,
    advertiserId,
    creatorId,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const bundle = await getCachedBrandAnalyticsCreatorsBundle(ctx.ctx);

  let hasActivity = creatorHasScopedRollupActivity(
    creatorId,
    bundle,
    ctx.ctx,
  );

  if (!hasActivity && bundle.twitterContestIds.length > 0) {
    const twitterContestIds = twitterContestIdsWithRollupActivity(
      bundle.twitterContestRollup,
    );
    if (twitterContestIds.length > 0) {
      const earningsByCreator = await fetchTwitterEarningsCentsByCreator(
        supabase,
        twitterContestIds,
        ctx.ctx.dateFrom,
        ctx.ctx.dateTo,
        ctx.ctx,
        creatorId,
      );
      hasActivity = (earningsByCreator.get(creatorId) ?? 0) > 0;
    }
  }

  if (!hasActivity) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

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
  }

  if (bundle.twitterContestIds.length > 0) {
    const twitterContestIds = twitterContestIdsWithRollupActivity(
      bundle.twitterContestRollup,
    );
    if (twitterContestIds.length > 0) {
      const earningsByCreator = await fetchTwitterEarningsCentsByCreator(
        supabase,
        twitterContestIds,
        ctx.ctx.dateFrom,
        ctx.ctx.dateTo,
        ctx.ctx,
        creatorId,
      );
      for (const earnings of earningsByCreator.values()) {
        totalEarnings += earnings;
      }
      const twitterEarnings = earningsByCreator.get(creatorId) ?? 0;
      if (twitterEarnings > 0) {
        addBucket(platformStats, "twitter", 0, 0, twitterEarnings);
      }
    }
  }

  const contestIds = bundle.videoContestIds;
  const monthlyRpc =
    ctx.ctx.dataSource === "pc_submissions"
      ? "brand_analytics_pc_creator_monthly"
      : "brand_analytics_creator_monthly";
  const CONTEST_ID_CHUNK = 500;

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase.rpc(monthlyRpc, {
      p_from: ctx.ctx.dateFrom.toISOString(),
      p_to: ctx.ctx.dateTo.toISOString(),
      p_contest_ids: idChunk,
      p_creator_id: creatorId,
    });
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as CreatorMonthlyRow[]) {
      if (
        !row.month_key ||
        !statusMatchesFilter(String(row.status ?? ""), ctx.ctx)
      ) {
        continue;
      }
      addBucket(
        performanceTimeline,
        String(row.month_key).slice(0, 7),
        Number(row.submission_count) || 0,
        Number(row.views_sum) || 0,
        Number(row.earnings_cents_sum) || 0,
      );
    }
  }

  if (ctx.ctx.dataSource !== "pc_submissions") {
    const twitterContestIds = twitterContestIdsWithRollupActivity(
      bundle.twitterContestRollup,
    );
    for (let i = 0; i < twitterContestIds.length; i += CONTEST_ID_CHUNK) {
      const idChunk = twitterContestIds.slice(i, i + CONTEST_ID_CHUNK);
      const { data, error } = await supabase.rpc(
        "brand_analytics_twitter_creator_monthly",
        {
          p_from: ctx.ctx.dateFrom.toISOString(),
          p_to: ctx.ctx.dateTo.toISOString(),
          p_contest_ids: idChunk,
          p_creator_id: creatorId,
        },
      );
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as CreatorMonthlyRow[]) {
        if (
          !row.month_key ||
          !statusMatchesFilter(String(row.status ?? ""), ctx.ctx)
        ) {
          continue;
        }
        addBucket(
          performanceTimeline,
          String(row.month_key).slice(0, 7),
          Number(row.submission_count) || 0,
          Number(row.views_sum) || 0,
          0,
        );
      }
    }
  }

  let topSubmissions: CreatorTopSubmissionRow[] = [];
  if (contestIds.length > 0) {
    const topSubmissionsRpc =
      ctx.ctx.dataSource === "pc_submissions"
        ? "brand_analytics_pc_creator_top_submissions"
        : "brand_analytics_creator_top_submissions";
    for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
      const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
      const { data, error } = await supabase.rpc(
        topSubmissionsRpc,
        {
          p_from: ctx.ctx.dateFrom.toISOString(),
          p_to: ctx.ctx.dateTo.toISOString(),
          p_contest_ids: idChunk,
          p_creator_id: creatorId,
          p_limit: 10,
        },
      );
      if (!error && data) {
        topSubmissions = topSubmissions.concat(
          data as CreatorTopSubmissionRow[],
        );
      }
    }
    topSubmissions = topSubmissions
      .filter((row) =>
        statusMatchesFilter(String(row.status ?? ""), ctx.ctx),
      )
      .sort(
        (a, b) => (Number(b.views) || 0) - (Number(a.views) || 0),
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
    const requestedLimit = Number.parseInt(
      searchParams.get("limit") || "20",
      10,
    );
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, requestedLimit))
      : 20;

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

    const twitterEarningsByCreator = new Map<string, number>();
    const twitterContestIds = twitterContestIdsWithRollupActivity(
      bundle.twitterContestRollup,
    );
    if (twitterContestIds.length > 0) {
      const earningsByCreator = await fetchTwitterEarningsCentsByCreator(
        admin,
        twitterContestIds,
        parsed.ctx.dateFrom,
        parsed.ctx.dateTo,
        parsed.ctx,
      );
      for (const [id, earnings] of earningsByCreator) {
        twitterEarningsByCreator.set(id, earnings);
      }
    }

    const response = await buildBrandCreatorsResponse(
      bundle,
      admin,
      limit,
      twitterEarningsByCreator,
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Analytics creators error:", error);
    return NextResponse.json(
      { error: brandAnalyticsClientErrorMessage(error) },
      { status: 500 },
    );
  }
}
