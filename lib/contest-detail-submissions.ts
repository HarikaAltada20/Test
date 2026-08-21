/**
 * Contest detail submissions: paginated load + status counts.
 * SSR and /api/contests/[id]/submissions share this so we never hydrate
 * the full contest into the HTML payload.
 */

import { createAdminClient } from "@/utils/supabase/admin";
import { isCpmContestType } from "@/lib/contest-type";
import {
  CONTEST_DETAIL_SUBMISSIONS_PAGE_SIZE,
  fetchContestSubmissionsPage,
  fetchContestTwitterTweetsPage,
  formatSubmissionFetchError,
} from "@/lib/fetch-contest-submissions";
import { loadContestStatsByContestIds } from "@/lib/contest-stats";
import {
  fetchLiveTrustMetricsByCreatorIds,
  getCreatorTrustScoreFromMetrics,
  isVideoContestFormat,
  resolveCreatorTrustMetrics,
} from "@/lib/trust-score";
import { fetchLiveQualityMetricsByCreatorIds } from "@/lib/quality-score";
import {
  getCreatorProfileQualityScoreSum,
  resolveCreatorEligibilityProfileFields,
} from "@/lib/creator-requirements";

export const CONTEST_DETAIL_SUBMISSIONS_SELECT = `
  id,
  created_at,
  content_link,
  status,
  views,
  earnings,
  other_stats,
  platform,
  video_id,
  video_thumbnail_url,
  video_title,
  creator_id,
  paid,
  paid_at,
  bonus_paid,
  bonus_paid_at,
  bonus_amount,
  milestone_bonus_paid,
  dual_rewards_payout,
  metadata,
  insights_status,
  last_insights_update,
  quality_score
`.trim();

export const CONTEST_DETAIL_TWITTER_TWEETS_SELECT = `
  id,
  tweet_id,
  tweet_url,
  tweet_text,
  tweet_created_at,
  tweet_type,
  twitter_username,
  creator_id,
  likes,
  replies,
  retweets,
  quote_reposts,
  impressions,
  points,
  is_eligible,
  moderation_status,
  manual_points_adjustment,
  manual_points_reason,
  earnings,
  deleted_at,
  excluded_by_submission_cap,
  first_fetched_at,
  last_updated_at,
  bonus_paid,
  bonus_paid_at,
  bonus_amount
`.trim();

export const CONTEST_DETAIL_TWITTER_TWEETS_SELECT_BASIC = `
  id,
  tweet_id,
  tweet_url,
  tweet_text,
  tweet_created_at,
  tweet_type,
  twitter_username,
  creator_id,
  likes,
  replies,
  retweets,
  quote_reposts,
  impressions,
  points,
  is_eligible,
  deleted_at,
  excluded_by_submission_cap,
  first_fetched_at,
  last_updated_at
`.trim();

/** Same visibility filter as legacy contest detail SSR. */
export const CONTEST_DETAIL_TWITTER_LIST_OR =
  "is_eligible.eq.true,deleted_at.not.is.null,excluded_by_submission_cap.eq.false";

export type ContestDetailSubmissionCounts = {
  total: number;
  pending: number;
  rejected: number;
  /** verified only (excludes paid). */
  verified: number;
  paid: number;
  /** verified + paid (contest_stats.verified_submission_count). */
  verified_or_paid: number;
  not_rejected: number;
};

export type ContestDetailSubmissionsPageResult = {
  submissions: any[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  counts: ContestDetailSubmissionCounts;
  errorMessage?: string;
};

function isTwitterCampaign(contest: {
  platform?: string | null;
  contest_format?: string | null;
}): boolean {
  const platform = contest.platform?.toLowerCase();
  return (
    (platform === "twitter" || platform === "x") &&
    contest.contest_format === "text_image"
  );
}

async function countExact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: "submissions" | "twitter_campaign_tweets",
  contestId: string,
  apply?: (q: any) => any,
): Promise<number> {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("contest_id", contestId);
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) {
    console.error(`[contest-detail-submissions] count ${table}:`, error.message);
    return 0;
  }
  return typeof count === "number" ? count : 0;
}

/**
 * Status badge counts without shipping every row.
 * Prefer contest_stats; paid (+ Twitter) use cheap head counts.
 */
export async function loadContestDetailSubmissionCounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestId: string,
  contest: { platform?: string | null; contest_format?: string | null },
): Promise<ContestDetailSubmissionCounts> {
  const twitter = isTwitterCampaign(contest);

  if (twitter) {
    const applyList = (q: any) => q.or(CONTEST_DETAIL_TWITTER_LIST_OR);
    const [total, pending, rejected, verified, paid] = await Promise.all([
      countExact(supabase, "twitter_campaign_tweets", contestId, applyList),
      countExact(supabase, "twitter_campaign_tweets", contestId, (q) =>
        applyList(q).eq("moderation_status", "pending"),
      ),
      countExact(supabase, "twitter_campaign_tweets", contestId, (q) =>
        applyList(q).eq("moderation_status", "rejected"),
      ),
      countExact(supabase, "twitter_campaign_tweets", contestId, (q) =>
        applyList(q).eq("moderation_status", "verified"),
      ),
      countExact(supabase, "twitter_campaign_tweets", contestId, (q) =>
        applyList(q).eq("moderation_status", "paid"),
      ),
    ]);
    return {
      total,
      pending,
      rejected,
      verified,
      paid,
      verified_or_paid: verified + paid,
      not_rejected: Math.max(0, total - rejected),
    };
  }

  const statsMap = await loadContestStatsByContestIds([contestId]);
  const stats = statsMap.get(contestId);
  const paid = await countExact(supabase, "submissions", contestId, (q) =>
    q.eq("status", "paid"),
  );

  if (stats) {
    const verified_or_paid = stats.verified_submission_count;
    const pending = stats.pending_submission_count;
    const rejected = stats.rejected_submission_count;
    const verified = Math.max(0, verified_or_paid - paid);
    const total = pending + rejected + verified_or_paid;
    return {
      total,
      pending,
      rejected,
      verified,
      paid,
      verified_or_paid,
      not_rejected: Math.max(0, total - rejected),
    };
  }

  // Fallback when contest_stats row is missing
  const [total, pending, rejected, verified] = await Promise.all([
    countExact(supabase, "submissions", contestId),
    countExact(supabase, "submissions", contestId, (q) =>
      q.eq("status", "pending"),
    ),
    countExact(supabase, "submissions", contestId, (q) =>
      q.eq("status", "rejected"),
    ),
    countExact(supabase, "submissions", contestId, (q) =>
      q.eq("status", "verified"),
    ),
  ]);
  return {
    total,
    pending,
    rejected,
    verified,
    paid,
    verified_or_paid: verified + paid,
    not_rejected: Math.max(0, total - rejected),
  };
}

async function loadCreatorEnrichmentMaps(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  creatorIds: string[],
  isVideoContest: boolean,
): Promise<{
  profilesById: Map<string, any>;
  usersById: Map<string, any>;
  liveTrustById: Record<string, any>;
  liveQualityById: Record<string, any>;
}> {
  const profilesById = new Map<string, any>();
  const usersById = new Map<string, any>();
  let liveTrustById: Record<string, any> = {};
  let liveQualityById: Record<string, any> = {};

  if (creatorIds.length === 0) {
    return { profilesById, usersById, liveTrustById, liveQualityById };
  }

  const [{ data: profiles }, { data: users }] = await Promise.all([
    supabase
      .from("creator_profiles")
      .select(
        `
        id,
        youtube_account,
        instagram_account,
        instagram_archive,
        twitter_account,
        trust_score_metrics,
        avg_quality_score,
        best_quality_score,
        quality_score_sum,
        total_money_won,
        total_views
      `,
      )
      .in("id", creatorIds),
    supabase
      .from("users")
      .select("id, full_name, username, profile_picture_url")
      .in("id", creatorIds),
  ]);

  for (const p of profiles || []) profilesById.set(p.id, p);
  for (const u of users || []) usersById.set(u.id, u);

  if (isVideoContest) {
    const admin = createAdminClient();
    liveTrustById = await fetchLiveTrustMetricsByCreatorIds(admin, creatorIds);
    liveQualityById = await fetchLiveQualityMetricsByCreatorIds(
      admin,
      creatorIds,
    );
  }

  return { profilesById, usersById, liveTrustById, liveQualityById };
}

function mapSubmissionRow(
  sub: any,
  ctx: {
    profilesById: Map<string, any>;
    usersById: Map<string, any>;
    liveTrustById: Record<string, any>;
    liveQualityById: Record<string, any>;
    isVideoContest: boolean;
  },
) {
  const creatorId = sub.creator_id ? String(sub.creator_id) : null;
  const creatorProfile = creatorId ? ctx.profilesById.get(creatorId) : null;
  const user = creatorId ? ctx.usersById.get(creatorId) : null;

  let creatorDisplayName: string | null = null;
  let creatorUsername: string | null = null;
  let creatorAvatarUrl: string | null = user?.profile_picture_url || null;

  if (creatorProfile) {
    const platform = sub.platform?.toLowerCase();
    try {
      if (platform?.includes("youtube") && creatorProfile.youtube_account) {
        const ytAccount =
          typeof creatorProfile.youtube_account === "string"
            ? JSON.parse(creatorProfile.youtube_account)
            : creatorProfile.youtube_account;
        creatorDisplayName = ytAccount?.channel_title;
        creatorUsername =
          ytAccount?.channel_custom_url || ytAccount?.channel_id;
      } else if (
        platform?.includes("instagram") &&
        creatorProfile.instagram_account
      ) {
        const igAccount =
          typeof creatorProfile.instagram_account === "string"
            ? JSON.parse(creatorProfile.instagram_account)
            : creatorProfile.instagram_account;
        creatorDisplayName =
          igAccount?.name_of_account ||
          igAccount?.full_name ||
          igAccount?.display_name;
        creatorUsername = igAccount?.username;
      }
    } catch {
      // keep fallbacks
    }
  }

  if (!creatorDisplayName) {
    creatorDisplayName =
      user?.full_name || user?.username || "Unknown Creator";
  }
  if (!creatorUsername) {
    creatorUsername = user?.username || "Unknown User";
  }
  if (!creatorAvatarUrl) {
    creatorAvatarUrl = user?.profile_picture_url || null;
  }

  const getTrustMetrics = () =>
    ctx.isVideoContest
      ? resolveCreatorTrustMetrics(
          creatorProfile,
          creatorId,
          ctx.liveTrustById,
        )
      : null;
  const getTrustScore = () =>
    ctx.isVideoContest
      ? getCreatorTrustScoreFromMetrics(
          creatorProfile,
          creatorId,
          ctx.liveTrustById,
        )
      : null;
  const getEligibility = () => {
    if (!ctx.isVideoContest || !creatorId) {
      return {
        avg_quality_score: null,
        best_quality_score: null,
        quality_score_sum: null,
        total_money_won: 0,
        total_views: 0,
        quality_score_counts: { score1: 0, score2: 0, score3: 0 },
      };
    }
    const resolved = resolveCreatorEligibilityProfileFields(
      creatorProfile,
      ctx.liveQualityById[creatorId] ?? null,
    );
    const liveQuality = ctx.liveQualityById[creatorId];
    return {
      avg_quality_score: resolved.avgQualityScore,
      best_quality_score: resolved.bestQualityScore,
      quality_score_sum: getCreatorProfileQualityScoreSum(creatorProfile),
      total_money_won: resolved.totalPlatformEarningsCents,
      total_views: resolved.totalViews,
      quality_score_counts: liveQuality?.quality_score_counts ?? {
        score1: 0,
        score2: 0,
        score3: 0,
      },
    };
  };

  return {
    id: sub.id,
    created_at: sub.created_at,
    content_link: sub.content_link,
    status: sub.status,
    views: sub.views,
    earnings: sub.earnings,
    other_stats: sub.other_stats,
    platform: sub.platform,
    video_id: sub.video_id ?? null,
    video_thumbnail_url: sub.video_thumbnail_url,
    video_title: sub.video_title,
    paid: sub.paid,
    paid_at: sub.paid_at,
    bonus_paid: sub.bonus_paid,
    bonus_paid_at: sub.bonus_paid_at,
    bonus_amount: sub.bonus_amount ?? null,
    milestone_bonus_paid: sub.milestone_bonus_paid ?? null,
    dual_rewards_payout: sub.dual_rewards_payout ?? null,
    creator_display_name: creatorDisplayName,
    creator_username: creatorUsername,
    user_username: user?.username || null,
    creator_avatar_url: creatorAvatarUrl,
    creator_id: creatorId,
    trust_score: getTrustScore(),
    trust_score_metrics: getTrustMetrics(),
    creator: {
      id: creatorId,
      username: creatorUsername,
      profile_picture_url: creatorAvatarUrl,
      full_name: creatorDisplayName,
      instagram_archive: creatorProfile?.instagram_archive ?? null,
      trust_score: getTrustScore(),
      trust_score_metrics: getTrustMetrics(),
      ...getEligibility(),
    },
    creator_instagram_archive: creatorProfile?.instagram_archive ?? null,
    metadata: sub.metadata ?? null,
    insights_status: sub.insights_status ?? null,
    last_insights_update: sub.last_insights_update ?? null,
    quality_score: sub.quality_score ?? null,
  };
}

function mapTwitterTweetRow(
  tweet: any,
  ctx: {
    profilesById: Map<string, any>;
    usersById: Map<string, any>;
    liveTrustById: Record<string, any>;
    liveQualityById: Record<string, any>;
    isVideoContest: boolean;
    contestType?: string | null;
    contestBasedDetails?: any;
    creatorModerationData?: Record<string, any>;
  },
) {
  const creatorId = tweet.creator_id ? String(tweet.creator_id) : null;
  const creatorProfile = creatorId ? ctx.profilesById.get(creatorId) : null;
  const user = creatorId ? ctx.usersById.get(creatorId) : null;

  let creatorDisplayName: string | null = null;
  let creatorUsername: string | null = tweet.twitter_username || null;
  let creatorAvatarUrl: string | null = null;

  if (creatorProfile?.twitter_account) {
    try {
      const twitterAccount =
        typeof creatorProfile.twitter_account === "string"
          ? JSON.parse(creatorProfile.twitter_account)
          : creatorProfile.twitter_account;
      creatorDisplayName =
        twitterAccount?.name || twitterAccount?.username;
      if (!creatorUsername) {
        creatorUsername =
          twitterAccount?.username || tweet.twitter_username;
      }
      creatorAvatarUrl = twitterAccount?.profile_picture_url;
    } catch {
      // keep fallbacks
    }
  }

  if (!creatorDisplayName) {
    creatorDisplayName =
      user?.full_name || user?.username || "Unknown Creator";
  }
  if (!creatorUsername) {
    creatorUsername =
      user?.username || tweet.twitter_username || "Unknown User";
  }
  if (!creatorAvatarUrl) {
    creatorAvatarUrl = user?.profile_picture_url || null;
  }

  const basePoints = tweet.points || 0;
  const manualAdjustment = tweet.manual_points_adjustment || 0;
  const totalPoints = basePoints + manualAdjustment;
  const moderationStatus = tweet.moderation_status || "pending";
  const isCpm = isCpmContestType(ctx.contestType);
  const cpmRate =
    (ctx.contestBasedDetails as any)?.cpm_contest?.cpm_rate_usd || 0;
  const creatorLeaderboard = creatorId
    ? ctx.creatorModerationData?.[creatorId]
    : undefined;
  const creatorPaid = creatorLeaderboard?.moderation_status === "paid";
  const creatorEarnings = creatorLeaderboard?.earnings ?? null;
  const creatorPaidAt = creatorLeaderboard?.paid_at ?? null;
  const tweetPaid = moderationStatus === "paid";
  const storedTweetEarnings =
    typeof tweet.earnings === "number" && tweet.earnings > 0
      ? tweet.earnings
      : null;
  const tweetEarningsCents =
    storedTweetEarnings != null
      ? storedTweetEarnings
      : isCpm && tweetPaid && cpmRate > 0
        ? Math.round(((totalPoints * cpmRate) / 1000) * 100)
        : null;
  const paid = isCpm ? tweetPaid : creatorPaid;
  const earnings =
    isCpm && tweetPaid
      ? tweetEarningsCents
      : creatorPaid && creatorEarnings != null
        ? creatorEarnings
        : null;
  const paidAt = isCpm ? null : creatorPaidAt;

  const getTrustMetrics = () =>
    ctx.isVideoContest
      ? resolveCreatorTrustMetrics(
          creatorProfile,
          creatorId,
          ctx.liveTrustById,
        )
      : null;
  const getTrustScore = () =>
    ctx.isVideoContest
      ? getCreatorTrustScoreFromMetrics(
          creatorProfile,
          creatorId,
          ctx.liveTrustById,
        )
      : null;
  const getEligibility = () => {
    if (!ctx.isVideoContest || !creatorId) {
      return {
        avg_quality_score: null,
        best_quality_score: null,
        quality_score_sum: null,
        total_money_won: 0,
        total_views: 0,
        quality_score_counts: { score1: 0, score2: 0, score3: 0 },
      };
    }
    const resolved = resolveCreatorEligibilityProfileFields(
      creatorProfile,
      ctx.liveQualityById[creatorId] ?? null,
    );
    const liveQuality = ctx.liveQualityById[creatorId];
    return {
      avg_quality_score: resolved.avgQualityScore,
      best_quality_score: resolved.bestQualityScore,
      quality_score_sum: getCreatorProfileQualityScoreSum(creatorProfile),
      total_money_won: resolved.totalPlatformEarningsCents,
      total_views: resolved.totalViews,
      quality_score_counts: liveQuality?.quality_score_counts ?? {
        score1: 0,
        score2: 0,
        score3: 0,
      },
    };
  };

  return {
    id: tweet.id,
    created_at:
      tweet.tweet_created_at ||
      tweet.first_fetched_at ||
      tweet.last_updated_at ||
      tweet.created_at,
    content_link: tweet.tweet_url,
    status: moderationStatus,
    views: tweet.impressions || 0,
    earnings,
    other_stats: {
      likes: tweet.likes || 0,
      replies: tweet.replies || 0,
      retweets: tweet.retweets || 0,
      quote_reposts: tweet.quote_reposts || 0,
      impressions: tweet.impressions || 0,
      points: totalPoints,
      base_points: basePoints,
      manual_points_adjustment: manualAdjustment,
      manual_points_reason: tweet.manual_points_reason,
      tweet_type: tweet.tweet_type,
      tweet_text: tweet.tweet_text,
    },
    platform: "twitter",
    video_thumbnail_url: null,
    video_title: tweet.tweet_text?.substring(0, 100) || null,
    paid,
    paid_at: paidAt,
    bonus_paid: tweet.bonus_paid === true,
    bonus_paid_at: tweet.bonus_paid_at ?? null,
    bonus_amount: tweet.bonus_amount ?? null,
    creator_display_name: creatorDisplayName,
    creator_username: creatorUsername,
    user_username: user?.username || null,
    creator_avatar_url: creatorAvatarUrl,
    creator_id: creatorId,
    trust_score: getTrustScore(),
    trust_score_metrics: getTrustMetrics(),
    is_twitter_tweet: true,
    tweet_id: tweet.tweet_id,
    moderation_status: moderationStatus,
    manual_points_adjustment: manualAdjustment,
    manual_points_reason: tweet.manual_points_reason,
    is_eligible: tweet.is_eligible === true,
    deleted_at: tweet.deleted_at ?? null,
    excluded_by_submission_cap: tweet.excluded_by_submission_cap ?? false,
    creator: {
      id: creatorId,
      username: creatorUsername,
      profile_picture_url: creatorAvatarUrl,
      full_name: creatorDisplayName,
      trust_score: getTrustScore(),
      trust_score_metrics: getTrustMetrics(),
      ...getEligibility(),
    },
  };
}

export type LoadContestDetailSubmissionsPageOptions = {
  limit?: number;
  offset?: number;
  /** When set, skip a second counts round-trip (SSR can pass preloaded counts). */
  counts?: ContestDetailSubmissionCounts;
  creatorModerationData?: Record<string, any>;
};

/**
 * One page of enriched contest-detail submissions (or Twitter tweets).
 */
export async function loadContestDetailSubmissionsPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestId: string,
  contest: {
    platform?: string | null;
    contest_format?: string | null;
    contest_type?: string | null;
    contest_based_details?: any;
  },
  options?: LoadContestDetailSubmissionsPageOptions,
): Promise<ContestDetailSubmissionsPageResult> {
  const limit = options?.limit ?? CONTEST_DETAIL_SUBMISSIONS_PAGE_SIZE;
  const offset = options?.offset ?? 0;
  const isVideoContest = isVideoContestFormat(contest.contest_format);
  const twitter = isTwitterCampaign(contest);

  const countsPromise = options?.counts
    ? Promise.resolve(options.counts)
    : loadContestDetailSubmissionCounts(supabase, contestId, contest);

  if (twitter) {
    let page = await fetchContestTwitterTweetsPage(
      supabase,
      contestId,
      CONTEST_DETAIL_TWITTER_TWEETS_SELECT,
      {
        limit,
        offset,
        orFilter: CONTEST_DETAIL_TWITTER_LIST_OR,
        order: [
          { column: "impressions", ascending: false },
          { column: "id", ascending: true },
        ],
        skipIdTiebreak: true,
      },
    );

    if (page.error && (page.error as { code?: string }).code === "42703") {
      page = await fetchContestTwitterTweetsPage(
        supabase,
        contestId,
        CONTEST_DETAIL_TWITTER_TWEETS_SELECT_BASIC,
        {
          limit,
          offset,
          orFilter: CONTEST_DETAIL_TWITTER_LIST_OR,
          order: [
            { column: "impressions", ascending: false },
            { column: "id", ascending: true },
          ],
          skipIdTiebreak: true,
        },
      );
    }

    const counts = await countsPromise;

    if (page.error) {
      return {
        submissions: [],
        total: counts.total,
        limit,
        offset,
        hasMore: false,
        counts,
        errorMessage: formatSubmissionFetchError(page.error),
      };
    }

  const creatorIds = Array.from(
    new Set(
      page.data
        .map((t) =>
          typeof t.creator_id === "string" ? t.creator_id.trim() : "",
        )
        .filter(Boolean),
    ),
  );
    const enrichment = await loadCreatorEnrichmentMaps(
      supabase,
      creatorIds,
      isVideoContest,
    );

    const submissions = page.data.map((tweet) =>
      mapTwitterTweetRow(
        {
          ...tweet,
          moderation_status: (tweet as any).moderation_status || "pending",
          manual_points_adjustment:
            (tweet as any).manual_points_adjustment || 0,
        },
        {
          ...enrichment,
          isVideoContest,
          contestType: contest.contest_type,
          contestBasedDetails: contest.contest_based_details,
          creatorModerationData: options?.creatorModerationData,
        },
      ),
    );

    return {
      submissions,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      hasMore: page.hasMore,
      counts: { ...counts, total: Math.max(counts.total, page.total) },
    };
  }

  const page = await fetchContestSubmissionsPage(
    supabase,
    contestId,
    CONTEST_DETAIL_SUBMISSIONS_SELECT,
    {
      limit,
      offset,
      order: [
        { column: "views", ascending: false, nullsFirst: false },
        { column: "id", ascending: true },
      ],
      skipIdTiebreak: true,
    },
  );

  const counts = await countsPromise;

  if (page.error) {
    return {
      submissions: [],
      total: counts.total,
      limit,
      offset,
      hasMore: false,
      counts,
      errorMessage: formatSubmissionFetchError(page.error),
    };
  }

  const creatorIds = Array.from(
    new Set(
      page.data
        .map((s) =>
          typeof s.creator_id === "string" ? s.creator_id.trim() : "",
        )
        .filter(Boolean),
    ),
  );
  const enrichment = await loadCreatorEnrichmentMaps(
    supabase,
    creatorIds,
    isVideoContest,
  );

  const submissions = page.data.map((sub) =>
    mapSubmissionRow(sub, { ...enrichment, isVideoContest }),
  );

  return {
    submissions,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    hasMore: page.hasMore,
    counts: { ...counts, total: Math.max(counts.total, page.total) },
  };
}

export { CONTEST_DETAIL_SUBMISSIONS_PAGE_SIZE };
