import type { ContestAnalyticsExportSubmission } from "@/lib/contest-analytics-export";
import type { ContestAnalyticsTabId } from "@/lib/contest-analytics-export";
import { isCpmContestType } from "@/lib/contest-type";
import { getTwitterSubmissionActionKind } from "@/lib/twitter/analytics-twitter-submission-kind";

export type TwitterCampaignMetrics = {
  total_tweets: number;
  total_likes: number;
  total_replies: number;
  total_retweets: number;
  total_quote_reposts: number;
  total_engagement: number;
  total_impressions: number;
  total_points: number;
};

export type TwitterPointsStatistics = {
  totalPoints: number;
  basePoints: number;
  manualAdjustments: number;
};

export function isTwitterAnalyticsSubmission(
  sub: ContestAnalyticsExportSubmission,
): boolean {
  return (
    sub.is_twitter_tweet === true ||
    String(sub.platform ?? "").toLowerCase() === "twitter" ||
    String(sub.platform ?? "").toLowerCase() === "x"
  );
}

export function isTwitterPointsContest(
  platform: string | null | undefined,
  contestFormat: string | null | undefined,
  contestType: string | null | undefined,
): boolean {
  const p = (platform ?? "").toLowerCase();
  return (
    (p === "twitter" || p === "x") &&
    contestFormat === "text_image" &&
    (contestType === "leaderboard" || isCpmContestType(contestType))
  );
}

export function computeTwitterCampaignMetrics(
  subs: ContestAnalyticsExportSubmission[],
  options: {
    platform: string | null | undefined;
    contestFormat: string | null | undefined;
    contestType: string | null | undefined;
    activeTab: ContestAnalyticsTabId;
    creatorModerationData?: Record<
      string,
      { total_points?: number | null }
    >;
  },
): TwitterCampaignMetrics {
  const metrics: TwitterCampaignMetrics = {
    total_tweets: 0,
    total_likes: 0,
    total_replies: 0,
    total_retweets: 0,
    total_quote_reposts: 0,
    total_engagement: 0,
    total_impressions: 0,
    total_points: 0,
  };

  const isTwitterPointsContestFlag = isTwitterPointsContest(
    options.platform,
    options.contestFormat,
    options.contestType,
  );

  const filteredCreatorIds = new Set<string>();

  for (const sub of subs) {
    if (!isTwitterAnalyticsSubmission(sub) || !sub.other_stats) continue;

    metrics.total_tweets += 1;
    metrics.total_likes += Number(sub.other_stats.likes ?? 0);
    const actionKind = getTwitterSubmissionActionKind(sub);
    if (actionKind === "reply") metrics.total_replies += 1;
    if (actionKind === "retweet") metrics.total_retweets += 1;
    if (actionKind === "quote") metrics.total_quote_reposts += 1;
    metrics.total_impressions += Number(sub.views ?? 0);

    const basePoints =
      typeof sub.other_stats.base_points === "number"
        ? sub.other_stats.base_points
        : Number(sub.other_stats.points ?? 0);
    const manualPoints =
      typeof sub.manual_points_adjustment === "number"
        ? sub.manual_points_adjustment
        : typeof sub.other_stats.manual_points_adjustment === "number"
          ? sub.other_stats.manual_points_adjustment
          : 0;
    metrics.total_points += basePoints + manualPoints;

    const creatorId = (sub as { creator_id?: string | null }).creator_id;
    if (creatorId) filteredCreatorIds.add(creatorId);
  }

  if (isTwitterPointsContestFlag && options.creatorModerationData) {
    let leaderboardPointsTotal = 0;
    let hasLeaderboardPoints = false;

    for (const [creatorId, data] of Object.entries(
      options.creatorModerationData,
    )) {
      if (
        options.activeTab !== "all" &&
        filteredCreatorIds.size > 0 &&
        !filteredCreatorIds.has(creatorId)
      ) {
        continue;
      }

      const entryPoints =
        typeof data.total_points === "number" ? data.total_points : null;
      if (entryPoints !== null) {
        leaderboardPointsTotal += entryPoints;
        hasLeaderboardPoints = true;
      }
    }

    if (hasLeaderboardPoints) {
      metrics.total_points = leaderboardPointsTotal;
    }
  }

  metrics.total_engagement =
    metrics.total_likes +
    metrics.total_replies +
    metrics.total_retweets +
    metrics.total_quote_reposts;

  return metrics;
}

export function computeTwitterPointsStatistics(
  subs: ContestAnalyticsExportSubmission[],
  getCreatorManualAdjustment: (creatorId: string) => number,
): TwitterPointsStatistics {
  const twitterSubs = subs.filter((s) => isTwitterAnalyticsSubmission(s));

  const basePoints = twitterSubs.reduce(
    (sum, s) => sum + Number(s.other_stats?.base_points ?? 0),
    0,
  );

  const tweetManualTotal = twitterSubs.reduce(
    (sum, s) => sum + Number(s.manual_points_adjustment ?? 0),
    0,
  );

  const creatorIds = new Set<string>();
  for (const s of twitterSubs) {
    const id = (s as { creator_id?: string | null }).creator_id;
    if (id) creatorIds.add(id);
  }

  const creatorManualTotal = Array.from(creatorIds).reduce(
    (sum, creatorId) => sum + getCreatorManualAdjustment(creatorId),
    0,
  );

  return {
    totalPoints: basePoints + tweetManualTotal + creatorManualTotal,
    basePoints,
    manualAdjustments: creatorManualTotal + tweetManualTotal,
  };
}

export type TwitterRaidExportContext = {
  targetTweetUrl: string | null;
  targetLikes: number | null;
  targetComments: number | null;
  targetRetweets: number | null;
  targetQuoteReposts: number | null;
  currentLikes: number | null;
  currentComments: number | null;
  currentRetweets: number | null;
  currentQuoteReposts: number | null;
  currentViews: number | null;
  targetsReached: boolean | null;
};

export function buildTwitterRaidExportRows(
  ctx: TwitterRaidExportContext | null | undefined,
): [string, string][] {
  if (!ctx) return [];

  const rows: [string, string][] = [];
  if (ctx.targetTweetUrl) {
    rows.push(["Target Tweet", ctx.targetTweetUrl]);
  }
  if (ctx.targetLikes != null && ctx.targetLikes > 0) {
    rows.push(["Target Likes", ctx.targetLikes.toLocaleString()]);
  }
  if (ctx.targetComments != null && ctx.targetComments > 0) {
    rows.push(["Target Comments", ctx.targetComments.toLocaleString()]);
  }
  if (ctx.targetRetweets != null && ctx.targetRetweets > 0) {
    rows.push(["Target Retweets", ctx.targetRetweets.toLocaleString()]);
  }
  if (ctx.targetQuoteReposts != null && ctx.targetQuoteReposts > 0) {
    rows.push(["Target Quote Reposts", ctx.targetQuoteReposts.toLocaleString()]);
  }
  if (ctx.currentLikes != null) {
    rows.push(["Current Likes", ctx.currentLikes.toLocaleString()]);
  }
  if (ctx.currentComments != null) {
    rows.push(["Current Comments", ctx.currentComments.toLocaleString()]);
  }
  if (ctx.currentRetweets != null) {
    rows.push(["Current Retweets", ctx.currentRetweets.toLocaleString()]);
  }
  if (ctx.currentQuoteReposts != null) {
    rows.push(["Current Quote Reposts", ctx.currentQuoteReposts.toLocaleString()]);
  }
  if (ctx.currentViews != null) {
    rows.push(["Current Views", ctx.currentViews.toLocaleString()]);
  }
  if (ctx.targetsReached !== null) {
    rows.push([
      "Targets Reached",
      ctx.targetsReached ? "Yes" : "No",
    ]);
  }
  return rows;
}

export function campaignMetricsToRows(
  metrics: TwitterCampaignMetrics,
): [string, string][] {
  return [
    ["Total Tweets", metrics.total_tweets.toLocaleString()],
    ["Total engagement", metrics.total_engagement.toLocaleString()],
    ["Total Likes", metrics.total_likes.toLocaleString()],
    ["Reply posts", metrics.total_replies.toLocaleString()],
    ["Retweet posts", metrics.total_retweets.toLocaleString()],
    ["Quote posts", metrics.total_quote_reposts.toLocaleString()],
    ["Total Impressions", metrics.total_impressions.toLocaleString()],
    ["Total Points", metrics.total_points.toLocaleString()],
  ];
}

export function pointsStatisticsToRows(
  stats: TwitterPointsStatistics,
): [string, string][] {
  return [
    ["Total Points", stats.totalPoints.toLocaleString()],
    ["Total Points (note)", "Base + Manual Adjustments"],
    ["Base Points", stats.basePoints.toLocaleString()],
    ["Manual Adjustments", stats.manualAdjustments.toLocaleString()],
    ["Manual Adjustments (note)", "Creator-wise + Tweet-level"],
  ];
}
