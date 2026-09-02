import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  leaderboardCache,
  adminLeaderboardCache,
  getLeaderboardCacheKey,
} from "@/lib/cache-utils";

export const dynamic = "force-dynamic";

/**
 * Build a leader entry from a flat RPC row that already contains user +
 * profile + metric columns. Shared by all three code paths (all / platform / twitter).
 */
function buildLeaderFromRow(
  row: any,
  opts: { metricsPrefix: "profile" | "platform" },
) {
  const isCreator = row.user_type === "creator";
  const hasYouTube = row.youtube_account != null;
  const hasInstagram = row.instagram_account != null;
  const hasTwitter = row.twitter_account != null;
  const hasTiktok = row.tiktok_account != null;

  let accountDisplayName: string | null = null;
  try {
    const tryParse = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);
    if (hasYouTube)
      accountDisplayName =
        tryParse(row.youtube_account)?.channel_title || null;
    if (!accountDisplayName && hasInstagram) {
      const ig = tryParse(row.instagram_account);
      accountDisplayName = ig?.username || ig?.full_name || null;
    }
    if (!accountDisplayName && hasTwitter) {
      const tw = tryParse(row.twitter_account);
      accountDisplayName = tw?.username || tw?.name || null;
    }
    if (!accountDisplayName && hasTiktok) {
      const tt = tryParse(row.tiktok_account);
      accountDisplayName = tt?.username || tt?.display_name || null;
    }
  } catch {}

  const resolvedUsername =
    row.username || accountDisplayName || row.full_name || "anonymous";

  const winnings =
    opts.metricsPrefix === "platform"
      ? Number(row.platform_winnings) || 0
      : Number(row.total_money_won) || 0;
  const submissionsWon =
    opts.metricsPrefix === "platform"
      ? Number(row.platform_submissions_won) || 0
      : Number(row.total_submissions_won) || 0;
  const submissionsMade =
    opts.metricsPrefix === "platform"
      ? Number(row.platform_submissions_made) || 0
      : Number(row.total_submissions_made) || 0;
  const contestsParticipated =
    opts.metricsPrefix === "platform"
      ? Number(row.platform_contests_participated) || 0
      : Number(row.total_contests_participated) || 0;
  const contestsWon =
    opts.metricsPrefix === "platform"
      ? Number(row.platform_contests_won) || 0
      : Number(row.total_contests_won) || 0;
  const verifiedViews =
    opts.metricsPrefix === "platform"
      ? Number(row.platform_views) || 0
      : Number(row.total_views) || 0;

  return {
    user_id: row.user_id,
    username: resolvedUsername,
    full_name: row.full_name,
    profile_picture_url: row.profile_picture_url,
    is_creator: isCreator,
    metrics: {
      winnings,
      affiliate_earnings: Number(row.affiliate_earnings) || 0,
      other_earnings: Number(row.other_earnings) || 0,
      contests_won: contestsWon,
      verified_views: verifiedViews,
      submissions_won: submissionsWon,
      contests_participated: contestsParticipated,
      submissions_made: submissionsMade,
      referrals:
        (Number(row.advertisers_referred) || 0) +
        (Number(row.creators_referred) || 0),
      advertisers_referred: Number(row.advertisers_referred) || 0,
      creators_referred: Number(row.creators_referred) || 0,
      total_coins: Number(row.total_lifetime_coins_earned) || 0,
    },
    platforms: {
      has_youtube: hasYouTube,
      has_instagram: hasInstagram,
      has_twitter: hasTwitter,
      has_tiktok: hasTiktok,
    },
  };
}

function buildSummaryFromRow(summaryRow: any) {
  return {
    totalCreators: Number(summaryRow.total_creators) || 0,
    instagramCreators: Number(summaryRow.instagram_creators) || 0,
    youtubeCreators: Number(summaryRow.youtube_creators) || 0,
    twitterCreators: Number(summaryRow.twitter_creators) || 0,
    tiktokCreators: Number(summaryRow.tiktok_creators) || 0,
    totalContestsWon: Number(summaryRow.total_contests_won) || 0,
    totalSubmissionsWon: Number(summaryRow.total_submissions_won) || 0,
    totalContestsParticipated:
      Number(summaryRow.total_contests_participated) || 0,
    totalSubmissionsMade: Number(summaryRow.total_submissions_made) || 0,
    totalReferrals: Number(summaryRow.total_referrals) || 0,
    totalAdvertisersReferred:
      Number(summaryRow.total_advertisers_referred) || 0,
    totalCreatorsReferred: Number(summaryRow.total_creators_referred) || 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const sortByRaw = searchParams.get("sortBy") || "winnings";
    const sortBy =
      sortByRaw === "affiliate_earnings" || sortByRaw === "other_earnings"
        ? "affiliate_and_other_earnings"
        : sortByRaw;
    const platform = searchParams.get("platform") || "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const isAdmin = searchParams.get("admin") === "1";

    const cache = isAdmin ? adminLeaderboardCache : leaderboardCache;

    const cacheKey = getLeaderboardCacheKey({
      sortBy,
      platform,
      page,
      limit,
      isAdmin,
    });
    const cachedResponse = await cache.getWithRedis<any>(cacheKey);
    if (cachedResponse) {
      return NextResponse.json({ ...cachedResponse, cached: true });
    }

    // Non-admin views are capped at 100 entries total
    const effectiveLimit = isAdmin ? limit : Math.min(limit, 100);
    const effectiveOffset = isAdmin
      ? (page - 1) * limit
      : Math.min((page - 1) * limit, 99);

    const rpcSortBy =
      sortBy === "affiliate_and_other_earnings"
        ? "affiliate_and_other_earnings"
        : sortBy;

    let rpcRows: any[] | null = null;
    let rpcError: any = null;
    let summaryRows: any[] | null = null;
    let metricsPrefix: "profile" | "platform" = "profile";

    if (platform === "all") {
      // All-platform path: uses pre-aggregated profile counters
      const [pageResult, summaryResult] = await Promise.all([
        supabase.rpc("get_creator_leaderboard_page", {
          p_sort_by: rpcSortBy,
          p_limit: effectiveLimit,
          p_offset: effectiveOffset,
        }),
        supabase.rpc("get_creator_leaderboard_summary"),
      ]);
      rpcRows = pageResult.data;
      rpcError = pageResult.error;
      summaryRows = summaryResult.data;
      metricsPrefix = "profile";
    } else if (platform === "twitter") {
      // Twitter path: aggregates from twitter_campaign_* tables in SQL
      const [pageResult, summaryResult] = await Promise.all([
        supabase.rpc("get_twitter_leaderboard_page", {
          p_sort_by: rpcSortBy,
          p_limit: effectiveLimit,
          p_offset: effectiveOffset,
        }),
        supabase.rpc("get_creator_leaderboard_summary"),
      ]);
      rpcRows = pageResult.data;
      rpcError = pageResult.error;
      summaryRows = summaryResult.data;
      metricsPrefix = "platform";
    } else {
      // YouTube / Instagram / TikTok: aggregates from submissions table in SQL
      const [pageResult, summaryResult] = await Promise.all([
        supabase.rpc("get_platform_leaderboard_page", {
          p_platform: platform,
          p_sort_by: rpcSortBy,
          p_limit: effectiveLimit,
          p_offset: effectiveOffset,
        }),
        supabase.rpc("get_creator_leaderboard_summary"),
      ]);
      rpcRows = pageResult.data;
      rpcError = pageResult.error;
      summaryRows = summaryResult.data;
      metricsPrefix = "platform";
    }

    if (rpcError) {
      console.error("Error in leaderboard RPC:", rpcError);
      return NextResponse.json(
        { error: "Failed to fetch leaderboard" },
        { status: 500 },
      );
    }

    const rows: any[] = rpcRows || [];
    const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const cappedTotal = isAdmin ? totalCount : Math.min(totalCount, 100);

    const leaders = rows.map((row: any) =>
      buildLeaderFromRow(row, { metricsPrefix }),
    );

    const summaryRow = summaryRows?.[0] || {};
    const summary = buildSummaryFromRow(summaryRow);

    const totalPages = Math.ceil(cappedTotal / limit);

    const responseBody = {
      leaders,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: cappedTotal,
        itemsPerPage: limit,
      },
      summary,
      lastUpdated: new Date().toISOString(),
    };

    await cache.setWithRedis(cacheKey, responseBody, 600000);

    return NextResponse.json({ ...responseBody, cached: false });
  } catch (error: any) {
    console.error("Error in leaderboard API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
