import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";
import { computeEffectiveCpmUsd } from "@/lib/report-export-metrics";
import { normalizeSubmissionStatus } from "@/lib/admin-analytics";
import { normalizeBrandPlatformKey } from "@/lib/brand-analytics-graph";
import type {
  BrandAnalyticsBundle,
  BrandAnalyticsCreatorsBundle,
  BrandAnalyticsQueryContext,
  BrandContestRow,
} from "@/lib/brand-analytics-cache";
import {
  contestTotalsFromRollup,
  countByStatusFiltered,
  countByStatusFromDaily,
  resolveAllowedPlatforms,
  statusMatchesFilter,
  sumDailyRows,
  sumTwitterDailyRows,
  twitterContestTotalsFromRollup,
} from "@/lib/brand-analytics-cache";
import { buildBrandAnalyticsGraphFromDailyRows } from "@/lib/brand-analytics-graph";

function modStatus(c: BrandContestRow): string {
  return (c.moderation_status ?? "").toString().toLowerCase();
}

function getContestLifecycle(
  contest: BrandContestRow,
): "upcoming" | "active" | "ended" | "incomplete" {
  const start = contest.start_date
    ? new Date(contest.start_date).getTime()
    : null;
  const end = contest.end_date ? new Date(contest.end_date).getTime() : null;
  if (start == null || end == null) return "incomplete";
  const now = Date.now();
  if (now < start) return "upcoming";
  if (now >= end) return "ended";
  return "active";
}

function getContestSpent(contest: BrandContestRow): number {
  const details = contest.contest_based_details as Record<string, unknown> | null;
  if (!details) return 0;
  if (
    contest.contest_type === "leaderboard" &&
    (details.leaderboard_contest as { total_prize?: number })?.total_prize
  ) {
    return Number((details.leaderboard_contest as { total_prize: number }).total_prize) || 0;
  }
  if (
    contest.contest_type === "cpm" &&
    (details.cpm_contest as { total_budget?: number })?.total_budget
  ) {
    return Number((details.cpm_contest as { total_budget: number }).total_budget) || 0;
  }
  if (contest.contest_type === "milestone") {
    return getPoolBudgetCentsFromDetails("milestone", details);
  }
  if (contest.contest_type === "dual_rewards") {
    return getPoolBudgetCentsFromDetails("dual_rewards", details);
  }
  return 0;
}

function parsePaymentDetails(paymentDetails: unknown): Record<string, unknown> | null {
  if (!paymentDetails) return null;
  try {
    return typeof paymentDetails === "string"
      ? (JSON.parse(paymentDetails) as Record<string, unknown>)
      : (paymentDetails as Record<string, unknown>);
  } catch {
    return paymentDetails as Record<string, unknown>;
  }
}

function contestsWithActivity(
  contests: BrandContestRow[],
  bundle: BrandAnalyticsBundle,
): BrandContestRow[] {
  return contests.filter(
    (contest) => getContestActivityTotals(contest, bundle).submissions > 0,
  );
}

function computeBrandFinancialMetrics(
  contests: BrandContestRow[],
  bundle: BrandAnalyticsBundle,
): {
  totalMoneyPaid: number;
  totalProjectedSpent: number;
  moneyPaidUnpublished: number;
  moneyInDraftNotPaid: number;
  paymentsBreakdown: {
    withCommission: number;
    withoutCommission: number;
    commission: number;
  };
} {
  const contestsForFinancial = contestsWithActivity(contests, bundle);

  const totalMoneyPaid = contestsForFinancial.reduce((sum, c) => {
    if (modStatus(c) !== "published") return sum;
    const pd = parsePaymentDetails(c.payment_details);
    if (
      pd?.payment_status === "completed" &&
      typeof pd.total_amount_paid === "number"
    ) {
      return sum + pd.total_amount_paid;
    }
    return sum;
  }, 0);

  const totalProjectedSpent = contestsForFinancial.reduce(
    (sum, c) => sum + getContestSpent(c),
    0,
  );

  const moneyPaidUnpublished = contestsForFinancial.reduce((sum, c) => {
    const pd = parsePaymentDetails(c.payment_details);
    if (
      modStatus(c) !== "published" &&
      pd?.payment_status === "completed" &&
      typeof pd.total_amount_paid === "number"
    ) {
      return sum + pd.total_amount_paid;
    }
    return sum;
  }, 0);

  const moneyInDraftNotPaid = contestsForFinancial.reduce((sum, c) => {
    if (modStatus(c) !== "draft") return sum;
    return sum + getContestSpent(c);
  }, 0);

  const paymentsBreakdown = contestsForFinancial.reduce(
    (acc, c) => {
      const pd = parsePaymentDetails(c.payment_details);
      if (pd?.payment_status === "completed") {
        const withCommission =
          typeof pd.total_amount_paid === "number" ? pd.total_amount_paid : 0;
        const commission =
          typeof pd.commission_amount === "number" ? pd.commission_amount : 0;
        let withoutCommission = 0;
        if (typeof pd.total_prize_pool === "number") {
          withoutCommission = pd.total_prize_pool;
        } else if (withCommission >= commission) {
          withoutCommission = withCommission - commission;
        }
        acc.withCommission += withCommission;
        acc.withoutCommission += withoutCommission;
        acc.commission += commission;
      }
      return acc;
    },
    { withCommission: 0, withoutCommission: 0, commission: 0 },
  );

  return {
    totalMoneyPaid,
    totalProjectedSpent,
    moneyPaidUnpublished,
    moneyInDraftNotPaid,
    paymentsBreakdown,
  };
}

function getContestActivityTotals(
  contest: BrandContestRow,
  bundle: BrandAnalyticsBundle,
) {
  const platform = normalizeBrandPlatformKey(contest);
  if (platform === "twitter") {
    return twitterContestTotalsFromRollup(
      contest.id,
      bundle.twitterContestRollup,
      bundle.ctx,
    );
  }
  const totals = contestTotalsFromRollup(
    contest.id,
    bundle.contestRollup,
    bundle.ctx,
  );
  return { ...totals, quoteReposts: 0 };
}

function hasStatusFilter(ctx: BrandAnalyticsQueryContext): boolean {
  return (
    ctx.notRejected ||
    Boolean(
      ctx.submissionStatus &&
        ctx.submissionStatus !== "all" &&
        ctx.submissionStatus.trim() !== "",
    )
  );
}

function buildCampaignList(
  allBrandContests: BrandContestRow[],
  ctx: BrandAnalyticsQueryContext,
  bundle: BrandAnalyticsBundle,
) {
  const isPc = ctx.dataSource === "pc_submissions";
  let list = allBrandContests.filter((c) => {
    if (ctx.contestTypeSet !== null) {
      if (
        !ctx.contestTypeSet.has((c.contest_type ?? "").toString().toLowerCase())
      ) {
        return false;
      }
    }
    const allowed = resolveAllowedPlatforms(ctx);
    return allowed.includes(normalizeBrandPlatformKey(c));
  });

  if (isPc) {
    const pcIdSet = new Set(
      bundle.contestRollup
        .map((row) => row.contest_id)
        .filter((id): id is string => Boolean(id)),
    );
    list = list.filter(
      (c) =>
        normalizeBrandPlatformKey(c) !== "twitter" && pcIdSet.has(c.id),
    );
  }

  // Match Campaigns tab: only campaigns with submission activity in the
  // current date range + status filter (not every campaign in type/platform scope).
  list = contestsWithActivity(list, bundle);

  return list.map((c) => ({
    id: c.id,
    title: (c.title || "Untitled campaign").trim() || "Untitled campaign",
  }));
}

export function buildBrandOverviewResponse(bundle: BrandAnalyticsBundle) {
  const { ctx, scopedContests, dailyRows, twitterDaily } = bundle;
  const video = sumDailyRows(dailyRows, ctx);
  const twitter = sumTwitterDailyRows(twitterDaily, ctx);
  const videoAll = sumDailyRows(dailyRows, ctx, { allStatuses: true });
  const twitterAll = sumTwitterDailyRows(twitterDaily, ctx, { allStatuses: true });

  const totalSubmissions = video.submissions + twitter.submissions;
  const totalViews = video.views + twitter.views;
  const totalVideoViews = video.views;
  const totalLikes = video.likes + twitter.likes;
  const totalComments = video.comments + twitter.comments;
  const totalPayoutsFromDaily = videoAll.payoutsCents;

  const statusCounts = hasStatusFilter(ctx)
    ? countByStatusFiltered(dailyRows, twitterDaily, ctx)
    : countByStatusFromDaily(dailyRows, twitterDaily);

  const totalContests = scopedContests.length;
  const publishedContests = scopedContests.filter(
    (c) => modStatus(c) === "published",
  ).length;
  const draftContests = scopedContests.filter(
    (c) => modStatus(c) === "draft",
  ).length;
  const pendingApprovalContests = scopedContests.filter(
    (c) => modStatus(c) === "pending_approval",
  ).length;
  const approvedContests = scopedContests.filter(
    (c) => modStatus(c) === "approved",
  ).length;
  const rejectedContests = scopedContests.filter(
    (c) => modStatus(c) === "rejected",
  ).length;

  const lifecycleCounts = { upcoming: 0, active: 0, ended: 0 };
  for (const c of scopedContests) {
    if (modStatus(c) !== "published") continue;
    const life = getContestLifecycle(c);
    if (life === "upcoming") lifecycleCounts.upcoming++;
    else if (life === "active") lifecycleCounts.active++;
    else if (life === "ended") lifecycleCounts.ended++;
  }

  let totalSpent = 0;
  for (const contest of scopedContests) {
    const activity = getContestActivityTotals(contest, bundle);
    if (activity.submissions > 0) {
      totalSpent += getContestSpent(contest);
    }
  }

  const totalSpentDollars = totalSpent / 100;
  const avgCostPerView = totalViews > 0 ? totalSpentDollars / totalViews : 0;
  const avgCostPerSubmission =
    totalSubmissions > 0 ? totalSpentDollars / totalSubmissions : 0;
  const avgSubmissionsPerContest =
    totalContests > 0 ? totalSubmissions / totalContests : 0;

  const effectiveCpm = computeEffectiveCpmUsd(
    totalPayoutsFromDaily,
    totalVideoViews,
  );

  type PlatformStat = {
    contests: number;
    submissions: number;
    views: number;
    spent: number;
    publishedContests: number;
    draftContests: number;
    activeContests: number;
    upcomingContests: number;
    endedContests: number;
    pendingApprovalContests: number;
    approvedContests: number;
    rejectedContests: number;
    verifiedSubmissions: number;
    paidSubmissions: number;
    pendingSubmissions: number;
    rejectedSubmissions: number;
    totalLikes: number;
    totalComments: number;
  };

  const platformStats: Record<string, PlatformStat> = {};

  for (const contest of scopedContests) {
    const platform = normalizeBrandPlatformKey(contest);
    const activity = getContestActivityTotals(contest, bundle);
    const mod = modStatus(contest);
    const life = getContestLifecycle(contest);

    if (!platformStats[platform]) {
      platformStats[platform] = {
        contests: 0,
        submissions: 0,
        views: 0,
        spent: 0,
        publishedContests: 0,
        draftContests: 0,
        activeContests: 0,
        upcomingContests: 0,
        endedContests: 0,
        pendingApprovalContests: 0,
        approvedContests: 0,
        rejectedContests: 0,
        verifiedSubmissions: 0,
        paidSubmissions: 0,
        pendingSubmissions: 0,
        rejectedSubmissions: 0,
        totalLikes: 0,
        totalComments: 0,
      };
    }

    const ps = platformStats[platform];
    if (activity.submissions > 0) ps.contests++;
    ps.submissions += activity.submissions;
    ps.views += activity.views;
    ps.totalLikes += activity.likes;
    ps.totalComments += activity.comments;
    if (mod === "published") ps.publishedContests++;
    else if (mod === "draft") ps.draftContests++;
    else if (mod === "pending_approval") ps.pendingApprovalContests++;
    else if (mod === "approved") ps.approvedContests++;
    else if (mod === "rejected") ps.rejectedContests++;
    if (mod === "published") {
      if (life === "upcoming") ps.upcomingContests++;
      else if (life === "active") ps.activeContests++;
      else if (life === "ended") ps.endedContests++;
    }
    if (activity.submissions > 0) ps.spent += getContestSpent(contest);
  }

  // Per-platform status counts from rollup rows
  for (const row of bundle.contestRollup) {
    const contest = scopedContests.find((c) => c.id === row.contest_id);
    if (!contest) continue;
    const platform = normalizeBrandPlatformKey(contest);
    const ps = platformStats[platform];
    if (!ps) continue;
    const useRow = hasStatusFilter(ctx)
      ? statusMatchesFilter(row.status, ctx)
      : true;
    if (!useRow) continue;
    const st = normalizeSubmissionStatus(row.status);
    if (st === "verified") ps.verifiedSubmissions += row.submission_count;
    else if (st === "paid") ps.paidSubmissions += row.submission_count;
    else if (st === "pending") ps.pendingSubmissions += row.submission_count;
    else if (st === "rejected") ps.rejectedSubmissions += row.submission_count;
  }
  for (const row of bundle.twitterContestRollup) {
    const contest = scopedContests.find((c) => c.id === row.contest_id);
    if (!contest || normalizeBrandPlatformKey(contest) !== "twitter") continue;
    const ps = platformStats.twitter;
    if (!ps) continue;
    const useRow = hasStatusFilter(ctx)
      ? statusMatchesFilter(row.status, ctx)
      : true;
    if (!useRow) continue;
    const st = normalizeSubmissionStatus(row.status);
    if (st === "verified") ps.verifiedSubmissions += row.submission_count;
    else if (st === "paid") ps.paidSubmissions += row.submission_count;
    else if (st === "pending") ps.pendingSubmissions += row.submission_count;
    else if (st === "rejected") ps.rejectedSubmissions += row.submission_count;
  }

  const monthlyData: Record<
    string,
    { contests: number; submissions: number; views: number; spent: number }
  > = {};
  for (const contest of scopedContests) {
    const month = new Date(contest.created_at).toISOString().slice(0, 7);
    const activity = getContestActivityTotals(contest, bundle);
    if (activity.submissions <= 0) continue;
    if (!monthlyData[month]) {
      monthlyData[month] = { contests: 0, submissions: 0, views: 0, spent: 0 };
    }
    monthlyData[month].contests++;
    monthlyData[month].submissions += activity.submissions;
    monthlyData[month].views += activity.views;
    monthlyData[month].spent += getContestSpent(contest);
  }

  const contestTypeStats: Record<
    string,
    { count: number; submissions: number; views: number; spent: number }
  > = {};
  for (const contest of scopedContests) {
    const type = contest.contest_type || "unknown";
    const activity = getContestActivityTotals(contest, bundle);
    if (activity.submissions <= 0) continue;
    if (!contestTypeStats[type]) {
      contestTypeStats[type] = {
        count: 0,
        submissions: 0,
        views: 0,
        spent: 0,
      };
    }
    contestTypeStats[type].count++;
    contestTypeStats[type].submissions += activity.submissions;
    contestTypeStats[type].views += activity.views;
    contestTypeStats[type].spent += getContestSpent(contest);
  }

  let topContest: BrandContestRow | null = null;
  let topViews = -1;
  for (const contest of scopedContests) {
    const activity = getContestActivityTotals(contest, bundle);
    if (activity.views > topViews) {
      topViews = activity.views;
      topContest = contest;
    }
  }

  const topActivity = topContest
    ? getContestActivityTotals(topContest, bundle)
    : null;

  return {
    dataSource: ctx.dataSource,
    overview: {
      totalContests,
      totalSubmissions,
      totalViews,
      totalSpent,
      totalPayoutsCents: totalPayoutsFromDaily,
      effectiveCpm,
      avgCostPerView: Math.round(avgCostPerView * 100) / 100,
      avgCostPerSubmission: Math.round(avgCostPerSubmission * 100) / 100,
      avgSubmissionsPerContest:
        Math.round(avgSubmissionsPerContest * 100) / 100,
      publishedContests,
      draftContests,
      activeContests: lifecycleCounts.active,
      upcomingContests: lifecycleCounts.upcoming,
      endedContests: lifecycleCounts.ended,
      pendingApprovalContests,
      approvedContests,
      rejectedContests,
      verifiedSubmissions: statusCounts.verified,
      paidSubmissions: statusCounts.paid,
      pendingSubmissions: statusCounts.pending,
      rejectedSubmissions: statusCounts.rejected,
      totalLikes,
      totalComments,
      topContest: topContest
        ? {
            id: topContest.id,
            title: topContest.title,
            views: topActivity?.views ?? 0,
            submissions: topActivity?.submissions ?? 0,
          }
        : null,
    },
    platformStats,
    monthlyData,
    contestTypeStats,
    campaigns: buildCampaignList(
      bundle.allBrandContests,
      ctx,
      bundle,
    ),
  };
}

export function buildBrandGraphResponse(
  bundle: BrandAnalyticsBundle,
  activeFilter: string,
) {
  const includeTwitter =
    bundle.ctx.dataSource !== "pc_submissions" && bundle.ctx.twitterAnalytics;

  const result = buildBrandAnalyticsGraphFromDailyRows({
    dailyRows: bundle.dailyRows,
    twitterDaily: includeTwitter ? bundle.twitterDaily : [],
    from: bundle.ctx.dateFrom,
    to: bundle.ctx.dateTo,
    activeFilter,
  });

  return {
    from: bundle.ctx.dateFrom.toISOString(),
    to: bundle.ctx.dateTo.toISOString(),
    dataSource: bundle.ctx.dataSource,
    ...result,
  };
}

export function buildBrandDetailedResponse(
  bundle: BrandAnalyticsBundle,
  twitterLeaderboardPayoutsCents: number,
) {
  const { ctx, scopedContests, dailyRows, twitterDaily } = bundle;
  const video = sumDailyRows(dailyRows, ctx);
  const twitter = sumTwitterDailyRows(twitterDaily, ctx);
  const videoAll = sumDailyRows(dailyRows, ctx, { allStatuses: true });
  const twitterAll = sumTwitterDailyRows(twitterDaily, ctx, { allStatuses: true });

  const totalSubmissions = video.submissions + twitter.submissions;
  const totalViews = video.views + twitter.views;

  const statusFilterActive = hasStatusFilter(ctx);
  const statusCounts = statusFilterActive
    ? countByStatusFiltered(dailyRows, twitterDaily, ctx)
    : countByStatusFromDaily(dailyRows, twitterDaily);

  const viewsFilterCtx = statusFilterActive ? ctx : undefined;
  const viewsByStatusYoutubeInstagram = {
    expected: countViewsByStatus(
      dailyRows,
      ["pending", "verified", "paid"],
      viewsFilterCtx,
    ),
    verified: countViewsByStatus(dailyRows, ["verified"], viewsFilterCtx),
    pending: countViewsByStatus(dailyRows, ["pending"], viewsFilterCtx),
    rejected: countViewsByStatus(dailyRows, ["rejected"], viewsFilterCtx),
    paid: countViewsByStatus(dailyRows, ["paid"], viewsFilterCtx),
    total: statusFilterActive ? video.views : videoAll.views,
  };

  const viewsByStatusTwitter = {
    expected: countTwitterViewsByStatus(
      twitterDaily,
      ["pending", "verified", "paid"],
      viewsFilterCtx,
    ),
    verified: countTwitterViewsByStatus(
      twitterDaily,
      ["verified"],
      viewsFilterCtx,
    ),
    pending: countTwitterViewsByStatus(
      twitterDaily,
      ["pending"],
      viewsFilterCtx,
    ),
    rejected: countTwitterViewsByStatus(
      twitterDaily,
      ["rejected"],
      viewsFilterCtx,
    ),
    paid: countTwitterViewsByStatus(twitterDaily, ["paid"], viewsFilterCtx),
    total: statusFilterActive ? twitter.views : twitterAll.views,
  };

  const totalPayoutsCents =
    videoAll.payoutsCents + twitterLeaderboardPayoutsCents;

  let topContest: BrandContestRow | null = null;
  let topViews = -1;
  for (const contest of scopedContests) {
    const activity = getContestActivityTotals(contest, bundle);
    if (activity.views > topViews) {
      topViews = activity.views;
      topContest = contest;
    }
  }
  const topActivity = topContest
    ? getContestActivityTotals(topContest, bundle)
    : null;

  const platformStats: Record<string, unknown> = {};
  for (const contest of scopedContests) {
    const platform = normalizeBrandPlatformKey(contest);
    const key = platform === "x" ? "twitter" : platform;
    const activity = getContestActivityTotals(contest, bundle);
    if (activity.submissions <= 0) continue;

    if (!platformStats[key]) {
      platformStats[key] = {
        contests: 0,
        submissions: 0,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        quote_reposts: 0,
        spent: 0,
      };
    }
    const ps = platformStats[key] as Record<string, number>;
    ps.contests++;
    ps.submissions += activity.submissions;
    ps.views += activity.views;
    ps.likes += activity.likes;
    ps.comments += activity.comments;
    ps.shares += activity.shares;
    ps.quote_reposts =
      (ps.quote_reposts || 0) + (activity.quoteReposts || 0);
    ps.spent += getContestSpent(contest);
  }

  const contestTypeStats: Record<
    string,
    { count: number; submissions: number; views: number; spent: number }
  > = {};
  for (const contest of scopedContests) {
    const type = contest.contest_type || "unknown";
    const activity = getContestActivityTotals(contest, bundle);
    if (activity.submissions <= 0) continue;
    if (!contestTypeStats[type]) {
      contestTypeStats[type] = {
        count: 0,
        submissions: 0,
        views: 0,
        spent: 0,
      };
    }
    contestTypeStats[type].count++;
    contestTypeStats[type].submissions += activity.submissions;
    contestTypeStats[type].views += activity.views;
    contestTypeStats[type].spent += getContestSpent(contest);
  }

  const twitterStats = {
    submissions: statusFilterActive ? twitter.submissions : twitterAll.submissions,
    views: statusFilterActive ? twitter.views : twitterAll.views,
    likes: statusFilterActive ? twitter.likes : twitterAll.likes,
    replies: statusFilterActive ? twitter.comments : twitterAll.comments,
    retweets: statusFilterActive ? twitter.shares : twitterAll.shares,
    quote_reposts: statusFilterActive
      ? twitter.quoteReposts
      : twitterAll.quoteReposts,
    verified: statusCounts.verified,
    paid: statusCounts.paid,
    pending: statusCounts.pending,
    rejected: statusCounts.rejected,
  };

  const totalContests = scopedContests.length;
  const mod = modStatus;
  const totalDraftContests = scopedContests.filter(
    (c) => mod(c) === "draft",
  ).length;
  const totalPendingContests = scopedContests.filter(
    (c) => mod(c) === "pending_approval",
  ).length;
  const totalApprovedContests = scopedContests.filter(
    (c) => mod(c) === "approved",
  ).length;
  const totalPublishedContests = scopedContests.filter(
    (c) => mod(c) === "published",
  ).length;
  const totalRejectedContests = scopedContests.filter(
    (c) => mod(c) === "rejected",
  ).length;
  const totalActiveContests = scopedContests.filter(
    (c) => mod(c) === "published" && c.status === "active",
  ).length;
  const totalUpcomingContests = scopedContests.filter(
    (c) => mod(c) === "published" && c.status === "upcoming",
  ).length;
  const totalEndedContests = scopedContests.filter(
    (c) =>
      mod(c) === "published" &&
      c.status === "ended" &&
      c.post_contest_status !== "payouts_processed",
  ).length;
  const totalCompletedContests = scopedContests.filter(
    (c) =>
      mod(c) === "published" &&
      c.status === "ended" &&
      c.post_contest_status === "payouts_processed",
  ).length;

  const avgViewsPerSubmission =
    totalSubmissions > 0 ? totalViews / totalSubmissions : 0;
  const engagementRate =
    totalViews > 0
      ? ((video.likes + twitter.likes + video.comments + twitter.comments + video.shares + twitter.shares) /
          totalViews) *
        100
      : 0;

  const recentContests = scopedContests.slice(0, 5).map((contest) => {
    const activity = getContestActivityTotals(contest, bundle);
    return {
      id: contest.id,
      title: contest.title,
      platform: contest.platform,
      contest_type: contest.contest_type,
      moderation_status: contest.moderation_status,
      status: contest.status,
      created_at: contest.created_at,
      submission_count: activity.submissions,
    };
  });

  const financials = computeBrandFinancialMetrics(scopedContests, bundle);
  const avgCostPerView =
    totalViews > 0 ? financials.totalMoneyPaid / totalViews : 0;
  const avgCostPerSubmission =
    totalSubmissions > 0 ? financials.totalMoneyPaid / totalSubmissions : 0;

  return {
    dataSource: ctx.dataSource,
    overview: {
      totalContests,
      totalDraftContests,
      totalPendingContests,
      totalApprovedContests,
      totalPublishedContests,
      totalRejectedContests,
      totalActiveContests,
      totalUpcomingContests,
      totalEndedContests,
      totalCompletedContests,
      totalSubmissions,
      verifiedSubmissions: statusCounts.verified,
      paidSubmissions: statusCounts.paid,
      pendingSubmissions: statusCounts.pending,
      rejectedSubmissions: statusCounts.rejected,
      totalViews,
      totalVerifiedViews: viewsByStatusYoutubeInstagram.verified + viewsByStatusTwitter.verified,
      totalPaidViews: viewsByStatusYoutubeInstagram.paid + viewsByStatusTwitter.paid,
      totalPendingViews: viewsByStatusYoutubeInstagram.pending + viewsByStatusTwitter.pending,
      totalRejectedViews: viewsByStatusYoutubeInstagram.rejected + viewsByStatusTwitter.rejected,
      totalExpectedViews:
        viewsByStatusYoutubeInstagram.expected + viewsByStatusTwitter.expected,
      viewsByStatusYoutubeInstagram,
      viewsByStatusTwitter,
      totalLikes: video.likes + twitter.likes,
      totalComments: video.comments + twitter.comments,
      totalShares: video.shares + twitter.shares,
      totalQuoteReposts: twitter.quoteReposts,
      totalMoneyPaid: financials.totalMoneyPaid,
      totalProjectedSpent: financials.totalProjectedSpent,
      moneyPaidUnpublished: financials.moneyPaidUnpublished,
      moneyInDraftNotPaid: financials.moneyInDraftNotPaid,
      paymentsBreakdown: financials.paymentsBreakdown,
      avgCostPerView: Math.round(avgCostPerView * 100) / 100,
      avgCostPerSubmission: Math.round(avgCostPerSubmission * 100) / 100,
      avgViewsPerSubmission: Math.round(avgViewsPerSubmission * 100) / 100,
      avgSubmissionsPerContest:
        totalContests > 0
          ? Math.round((totalSubmissions / totalContests) * 100) / 100
          : 0,
      engagementRate: Math.round(engagementRate * 100) / 100,
      totalPayoutsCents,
      topContest: topContest
        ? {
            id: topContest.id,
            title: topContest.title,
            views: topActivity?.views ?? 0,
            submissions: topActivity?.submissions ?? 0,
            platform: topContest.platform,
            contest_type: topContest.contest_type,
          }
        : null,
    },
    platformStats,
    contestTypeStats,
    recentContests,
    twitterStats,
  };
}

function countViewsByStatus(
  rows: { status: string; views_sum: number }[],
  statuses: string[],
  ctx?: BrandAnalyticsQueryContext,
): number {
  const set = new Set(statuses);
  return rows.reduce((sum, row) => {
    if (ctx && !statusMatchesFilter(row.status, ctx)) return sum;
    const st = normalizeSubmissionStatus(row.status);
    if (st === "unknown" || !set.has(st)) return sum;
    return sum + (Number(row.views_sum) || 0);
  }, 0);
}

function countTwitterViewsByStatus(
  rows: { status: string; views_sum: number }[],
  statuses: string[],
  ctx?: BrandAnalyticsQueryContext,
): number {
  return countViewsByStatus(rows, statuses, ctx);
}

export async function buildBrandCreatorsResponse(
  bundle: BrandAnalyticsCreatorsBundle,
  supabase: ReturnType<typeof import("@/utils/supabase/admin").createAdminClient>,
  limit: number,
  twitterLeaderboardByCreator: Map<string, number>,
) {
  const ctx = bundle.ctx;
  type CreatorAcc = {
    creator: unknown;
    totalSubmissions: number;
    totalViews: number;
    totalEarnings: number;
    viewsYoutubeInstagram: number;
    viewsTwitter: number;
    submissionsYoutubeInstagram: number;
    submissionsYoutube: number;
    submissionsInstagram: number;
    submissionsTwitter: number;
    platforms: Set<string>;
    contestTypes: Set<string>;
    firstSubmission: Date | null;
    lastSubmission: Date | null;
  };

  const creatorStats: Record<string, CreatorAcc> = {};

  for (const row of bundle.creatorRollup) {
    if (!statusMatchesFilter(row.status, ctx)) continue;
    const id = row.creator_id;
    if (!creatorStats[id]) {
      creatorStats[id] = {
        creator: null,
        totalSubmissions: 0,
        totalViews: 0,
        totalEarnings: 0,
        viewsYoutubeInstagram: 0,
        viewsTwitter: 0,
        submissionsYoutubeInstagram: 0,
        submissionsYoutube: 0,
        submissionsInstagram: 0,
        submissionsTwitter: 0,
        platforms: new Set(),
        contestTypes: new Set(),
        firstSubmission: null,
        lastSubmission: null,
      };
    }
    const acc = creatorStats[id];
    acc.totalSubmissions += row.submission_count;
    acc.totalViews += row.views_sum;
    acc.totalEarnings += row.earnings_cents_sum;
    acc.viewsYoutubeInstagram += row.views_sum;
    acc.submissionsYoutubeInstagram += row.submission_count;
    if (row.platform === "youtube") {
      acc.submissionsYoutube += row.submission_count;
    }
    if (row.platform === "instagram") {
      acc.submissionsInstagram += row.submission_count;
    }
    acc.platforms.add(row.platform);
    acc.contestTypes.add(row.contest_type);
    const first = row.first_created_at ? new Date(row.first_created_at) : null;
    const last = row.last_created_at ? new Date(row.last_created_at) : null;
    if (first && (!acc.firstSubmission || first < acc.firstSubmission)) {
      acc.firstSubmission = first;
    }
    if (last && (!acc.lastSubmission || last > acc.lastSubmission)) {
      acc.lastSubmission = last;
    }
  }

  for (const row of bundle.twitterCreatorRollup) {
    if (!statusMatchesFilter(row.status, ctx)) continue;
    const id = row.creator_id;
    if (!creatorStats[id]) {
      creatorStats[id] = {
        creator: null,
        totalSubmissions: 0,
        totalViews: 0,
        totalEarnings: 0,
        viewsYoutubeInstagram: 0,
        viewsTwitter: 0,
        submissionsYoutubeInstagram: 0,
        submissionsYoutube: 0,
        submissionsInstagram: 0,
        submissionsTwitter: 0,
        platforms: new Set(),
        contestTypes: new Set(),
        firstSubmission: null,
        lastSubmission: null,
      };
    }
    const acc = creatorStats[id];
    acc.totalSubmissions += row.submission_count;
    acc.totalViews += row.views_sum;
    acc.viewsTwitter += row.views_sum;
    acc.submissionsTwitter += row.submission_count;
    acc.platforms.add("twitter");
    acc.contestTypes.add(row.contest_type);
    const lb = twitterLeaderboardByCreator.get(id) ?? 0;
    acc.totalEarnings += lb;
    const first = row.first_created_at ? new Date(row.first_created_at) : null;
    const last = row.last_created_at ? new Date(row.last_created_at) : null;
    if (first && (!acc.firstSubmission || first < acc.firstSubmission)) {
      acc.firstSubmission = first;
    }
    if (last && (!acc.lastSubmission || last > acc.lastSubmission)) {
      acc.lastSubmission = last;
    }
  }

  for (const [creatorId, earnings] of twitterLeaderboardByCreator) {
    if (!creatorStats[creatorId]) continue;
    creatorStats[creatorId].totalEarnings += earnings;
  }

  const creatorIds = Object.keys(creatorStats);
  const ranked = Object.entries(creatorStats)
    .map(([id, acc]) => ({ id, acc }))
    .sort((a, b) => b.acc.totalViews - a.acc.totalViews);

  const profileIds = new Set<string>();
  for (const { id } of ranked.slice(0, limit)) profileIds.add(id);
  for (const { id } of [...ranked]
    .sort((a, b) => b.acc.totalSubmissions - a.acc.totalSubmissions)
    .slice(0, limit)) {
    profileIds.add(id);
  }
  for (const { id } of [...ranked]
    .sort((a, b) => b.acc.totalEarnings - a.acc.totalEarnings)
    .slice(0, limit)) {
    profileIds.add(id);
  }

  const idsToFetch = [...profileIds];
  const CHUNK = 150;
  for (let i = 0; i < idsToFetch.length; i += CHUNK) {
    const chunk = idsToFetch.slice(i, i + CHUNK);
    const { data } = await supabase
      .from("users")
      .select(
        `id, username, creator_profiles (bio, total_views, total_contests_participated, total_contests_won, youtube_account, instagram_account)`,
      )
      .in("id", chunk);
    for (const u of data ?? []) {
      if (creatorStats[u.id]) {
        creatorStats[u.id].creator = u;
      }
    }
  }

  const creatorsLeaderboard = Object.values(creatorStats)
    .filter((c) => c.creator != null)
    .map((creator) => ({
      ...creator,
      platforms: Array.from(creator.platforms),
      contestTypes: Array.from(creator.contestTypes),
      avgViewsPerSubmission:
        creator.totalSubmissions > 0
          ? creator.totalViews / creator.totalSubmissions
          : 0,
      avgViewsPerSubmissionYoutubeInstagram:
        creator.submissionsYoutubeInstagram > 0
          ? creator.viewsYoutubeInstagram / creator.submissionsYoutubeInstagram
          : 0,
      avgViewsPerSubmissionTwitter:
        creator.submissionsTwitter > 0
          ? creator.viewsTwitter / creator.submissionsTwitter
          : 0,
      avgEarningsPerSubmission:
        creator.totalSubmissions > 0
          ? creator.totalEarnings / creator.totalSubmissions
          : 0,
      daysActive:
        creator.lastSubmission && creator.firstSubmission
          ? Math.ceil(
              (creator.lastSubmission.getTime() -
                creator.firstSubmission.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 0,
    }));

  const topByViews = [...creatorsLeaderboard]
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, limit);
  const topBySubmissions = [...creatorsLeaderboard]
    .sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    .slice(0, limit);
  const topByEarnings = [...creatorsLeaderboard]
    .sort((a, b) => b.totalEarnings - a.totalEarnings)
    .slice(0, limit);

  const video = sumDailyRows(bundle.dailyRows, ctx);
  const twitter = sumTwitterDailyRows(bundle.twitterDaily, ctx);
  const videoAll = sumDailyRows(bundle.dailyRows, ctx, { allStatuses: true });

  const platformDemographics: Record<string, number> = {};
  for (const row of bundle.creatorRollup) {
    if (!statusMatchesFilter(row.status, ctx)) continue;
    platformDemographics[row.platform] =
      (platformDemographics[row.platform] || 0) + row.submission_count;
  }
  for (const row of bundle.twitterCreatorRollup) {
    if (!statusMatchesFilter(row.status, ctx)) continue;
    platformDemographics.twitter =
      (platformDemographics.twitter || 0) + row.submission_count;
  }

  const contestTypePreferences: Record<string, number> = {};
  for (const row of bundle.creatorRollup) {
    if (!statusMatchesFilter(row.status, ctx)) continue;
    contestTypePreferences[row.contest_type] =
      (contestTypePreferences[row.contest_type] || 0) + row.submission_count;
  }
  for (const row of bundle.twitterCreatorRollup) {
    if (!statusMatchesFilter(row.status, ctx)) continue;
    contestTypePreferences[row.contest_type] =
      (contestTypePreferences[row.contest_type] || 0) + row.submission_count;
  }

  const totalUniqueCreators = new Set<string>([
    ...bundle.creatorRollup
      .filter((row) => statusMatchesFilter(row.status, ctx))
      .map((row) => row.creator_id),
    ...bundle.twitterCreatorRollup
      .filter((row) => statusMatchesFilter(row.status, ctx))
      .map((row) => row.creator_id),
  ]).size;
  const totalSubmissions = video.submissions + twitter.submissions;
  const totalViews = video.views + twitter.views;
  let totalEarnings = videoAll.payoutsCents;
  for (const earnings of twitterLeaderboardByCreator.values()) {
    totalEarnings += earnings;
  }
  const totalPayoutsCents = totalEarnings;

  return {
    dataSource: ctx.dataSource,
    leaderboards: {
      topByViews,
      topByViewsYoutubeInstagram: [...creatorsLeaderboard]
        .filter((c) => c.submissionsYoutubeInstagram > 0)
        .sort((a, b) => b.viewsYoutubeInstagram - a.viewsYoutubeInstagram)
        .slice(0, limit),
      topByViewsTwitter: [...creatorsLeaderboard]
        .filter((c) => c.submissionsTwitter > 0)
        .sort((a, b) => b.viewsTwitter - a.viewsTwitter)
        .slice(0, limit),
      topBySubmissions,
      topByEarnings,
    },
    summary: {
      totalUniqueCreators,
      totalSubmissions,
      totalViews,
      totalEarnings,
      totalPayoutsCents,
      avgSubmissionsPerCreator:
        totalUniqueCreators > 0 ? totalSubmissions / totalUniqueCreators : 0,
      avgViewsPerCreator:
        totalUniqueCreators > 0 ? totalViews / totalUniqueCreators : 0,
      avgEarningsPerCreator:
        totalUniqueCreators > 0 ? totalEarnings / totalUniqueCreators : 0,
      avgPayoutsPerCreator:
        totalUniqueCreators > 0
          ? totalPayoutsCents / 100 / totalUniqueCreators
          : 0,
    },
    demographics: {
      platformDemographics,
      contestTypePreferences,
    },
  };
}
