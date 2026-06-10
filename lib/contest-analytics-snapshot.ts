import {
  contestAnalyticsTabLabel,
  filterSubmissionsForAnalyticsTab,
  type ContestAnalyticsExportSubmission,
  type ContestAnalyticsTabId,
} from "@/lib/contest-analytics-export";
import {
  isCpmContestType,
  isMilestoneContestType,
} from "@/lib/contest-type";
import { platformCampaignMetricsToRows } from "@/lib/contest-analytics-campaign-metrics";
import {
  buildTwitterRaidExportRows,
  campaignMetricsToRows,
  computeTwitterCampaignMetrics,
  computeTwitterPointsStatistics,
  pointsStatisticsToRows,
  type TwitterRaidExportContext,
} from "@/lib/contest-analytics-twitter-metrics";

export type ContestAnalyticsSnapshotSection = {
  title: string;
  rows: [string, string][];
};

export type ViewsDistributionTable = {
  title: string;
  headers: string[];
  rows: string[][];
  combinedViews?: number;
};

export type ViewsDistributionChartItem = {
  id: string;
  rank: number;
  label: string;
  sublabel?: string;
  views: number;
  posts?: number;
  shareOfTop10Combined?: number;
};

/** Each row's % of the combined views across the displayed top 10. */
export function attachTopTenCombinedShare(
  items: ViewsDistributionChartItem[],
): ViewsDistributionChartItem[] {
  const combinedViews = items.reduce((sum, item) => sum + item.views, 0);
  return items.map((item) => ({
    ...item,
    shareOfTop10Combined:
      combinedViews > 0 ? (item.views / combinedViews) * 100 : 0,
  }));
}

function formatTopTenSharePct(sharePct: number | undefined): string {
  return `${(sharePct ?? 0).toFixed(1)}%`;
}

function topTenCombinedViews(items: ViewsDistributionChartItem[]): number {
  return items.reduce((sum, item) => sum + item.views, 0);
}

export type ContestAnalyticsTabSnapshot = {
  tab: ContestAnalyticsTabId;
  tabLabel: string;
  sections: ContestAnalyticsSnapshotSection[];
  viewsDistributionBySubmission: ViewsDistributionTable;
  viewsDistributionByCreator: ViewsDistributionTable;
};

export type ContestAnalyticsSnapshotContext = {
  contestTitle: string;
  contestType: string | null | undefined;
  postContestStatus: string | null | undefined;
  durationDays: number | null | undefined;
  totalSubmissionCount: number;
  approvedCount: number;
  isTwitterTextImage: boolean;
  isTwitterPlatform: boolean;
  contestFormat: string | null | undefined;
  platform: string | null | undefined;
  contentType: string | null | undefined;
  leaderboardTotalPrizeCents: number;
  allSubmissions: ContestAnalyticsExportSubmission[];
  getStatus: (submission: ContestAnalyticsExportSubmission) => string;
  getSubmissionExpectedCents: (
    submission: ContestAnalyticsExportSubmission,
  ) => number;
  getCreatorManualAdjustment: (creatorId: string) => number;
  creatorModerationData?: Record<
    string,
    { total_points?: number | null; manual_points_adjustment?: number | null }
  >;
  twitterRaid?: TwitterRaidExportContext | null;
  formatMoney: (cents: number) => string;
};

function filteredViewsLabel(tab: ContestAnalyticsTabId): string {
  if (tab === "verified") return "Verified Views";
  if (tab === "paid") return "Paid Views";
  if (tab === "pending") return "Pending Views";
  if (tab === "rejected") return "Rejected Views";
  if (tab === "not_rejected") return "Not Rejected Views";
  if (tab === "verified_or_paid") return "Verified/Paid Views";
  return "Filtered Views";
}

/** Label for paid-tab view totals in ROI (e.g. Verified/Paid submissions views). */
export function filteredSubmissionsViewsLabel(tab: ContestAnalyticsTabId): string {
  if (tab === "all") return "All submissions views";
  return `${contestAnalyticsTabLabel(tab)} submissions views`;
}

function isPaidSubmission(
  submission: ContestAnalyticsExportSubmission,
  getStatus: (s: ContestAnalyticsExportSubmission) => string,
): boolean {
  const status = getStatus(submission);
  return (
    status === "paid" ||
    Boolean((submission as { paid_at?: string | null }).paid_at) ||
    (submission as { paid?: boolean }).paid === true
  );
}

function contestTypeDisplay(contestType: string | null | undefined): string {
  if (!contestType) return "Contest";
  if (contestType === "dual_rewards") return "Dual rewards contest";
  return `${contestType.replace(/_/g, " ")} contest`;
}

function sumExpectedRewardCents(
  subs: ContestAnalyticsExportSubmission[],
  ctx: ContestAnalyticsSnapshotContext,
  tab: ContestAnalyticsTabId,
): number {
  return subs.reduce((sum, s) => {
    if (tab === "paid") return sum + Number(s.earnings || 0);
    return sum + ctx.getSubmissionExpectedCents(s);
  }, 0);
}

function showsAnalyticsExpectedRewardMetrics(
  contestType: string | null | undefined,
): boolean {
  return (
    isCpmContestType(contestType) ||
    isMilestoneContestType(contestType) ||
    contestType === "leaderboard"
  );
}

function computeTotalInvestment(
  subs: ContestAnalyticsExportSubmission[],
  ctx: ContestAnalyticsSnapshotContext,
  tab: ContestAnalyticsTabId,
): { label: string; value: string; note: string } {
  const payoutsProcessed = ctx.postContestStatus === "payouts_processed";
  const contestType = ctx.contestType;

  if (payoutsProcessed) {
    return {
      label: "Total Investment (Expected)",
      value: ctx.formatMoney(sumExpectedRewardCents(subs, ctx, tab)),
      note: "Expected Reward",
    };
  }

  if (contestType === "leaderboard") {
    return {
      label: "Total Investment",
      value: ctx.formatMoney(ctx.leaderboardTotalPrizeCents),
      note: "Prize Pool",
    };
  }

  if (isCpmContestType(contestType) || isMilestoneContestType(contestType)) {
    const totalPaid = subs
      .filter((s) => isPaidSubmission(s, ctx.getStatus))
      .reduce((sum, s) => sum + Number(s.earnings || 0), 0);
    return {
      label: "Total Investment",
      value: ctx.formatMoney(totalPaid),
      note: "Total Paid",
    };
  }

  return {
    label: "Total Investment",
    value: ctx.formatMoney(0),
    note: "Total Paid",
  };
}

function creatorLabel(submission: ContestAnalyticsExportSubmission): string {
  return (
    submission.creator_username ||
    submission.creator_display_name ||
    "Unknown Creator"
  );
}

function creatorKey(submission: ContestAnalyticsExportSubmission): string {
  return (
    submission.creator_id ??
    submission.creator_username ??
    `submission:${submission.id}`
  );
}

/** Top submissions by individual post views (within the active filter). */
export function buildTopSubmissionChartItems(
  subs: ContestAnalyticsExportSubmission[],
): ViewsDistributionChartItem[] {
  return attachTopTenCombinedShare(
    [...subs]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)
      .map((sub, index) => ({
        id: sub.id,
        rank: index + 1,
        label: creatorLabel(sub),
        sublabel: sub.video_title
          ? String(sub.video_title).slice(0, 56)
          : undefined,
        views: sub.views || 0,
      })),
  );
}

export function buildTopCreatorChartItems(
  subs: ContestAnalyticsExportSubmission[],
): ViewsDistributionChartItem[] {
  const byCreator = new Map<
    string,
    { id: string; name: string; views: number; posts: number }
  >();

  for (const sub of subs) {
    const key = creatorKey(sub);
    const existing = byCreator.get(key);
    if (existing) {
      existing.views += sub.views || 0;
      existing.posts += 1;
    } else {
      byCreator.set(key, {
        id: key,
        name: creatorLabel(sub),
        views: sub.views || 0,
        posts: 1,
      });
    }
  }

  return attachTopTenCombinedShare(
    [...byCreator.values()]
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map((creator, index) => ({
        id: creator.id,
        rank: index + 1,
        label: creator.name,
        sublabel: `${creator.posts} post${creator.posts === 1 ? "" : "s"}`,
        views: creator.views,
        posts: creator.posts,
      })),
  );
}

/** Top submissions by individual post views (within the active filter). */
export function buildTopSubmissionsViewsDistribution(
  subs: ContestAnalyticsExportSubmission[],
): ViewsDistributionTable {
  const items = buildTopSubmissionChartItems(subs);
  const combinedViews = topTenCombinedViews(items);

  return {
    title: "Top 10 Submissions by Views",
    headers: ["Rank", "Creator", "Views", "% of Top 10 Combined"],
    rows: items.map((item) => [
      String(item.rank),
      item.label,
      item.views.toLocaleString(),
      formatTopTenSharePct(item.shareOfTop10Combined),
    ]),
    combinedViews,
  };
}

/** Top creators by combined views across all their posts (within the active filter). */
export function buildTopCreatorsViewsDistribution(
  subs: ContestAnalyticsExportSubmission[],
): ViewsDistributionTable {
  const items = buildTopCreatorChartItems(subs);
  const combinedViews = topTenCombinedViews(items);

  return {
    title: "Top 10 Creators by Views",
    headers: ["Rank", "Creator", "Total Views", "Posts", "% of Top 10 Combined"],
    rows: items.map((item) => [
      String(item.rank),
      item.label,
      item.views.toLocaleString(),
      String(item.posts ?? 0),
      formatTopTenSharePct(item.shareOfTop10Combined),
    ]),
    combinedViews,
  };
}

export function buildViewsDistributionTables(
  subs: ContestAnalyticsExportSubmission[],
): {
  bySubmission: ViewsDistributionTable;
  byCreator: ViewsDistributionTable;
} {
  return {
    bySubmission: buildTopSubmissionsViewsDistribution(subs),
    byCreator: buildTopCreatorsViewsDistribution(subs),
  };
}

export function buildContestAnalyticsTabSnapshot(
  tab: ContestAnalyticsTabId,
  ctx: ContestAnalyticsSnapshotContext,
): ContestAnalyticsTabSnapshot {
  const subs = filterSubmissionsForAnalyticsTab(
    ctx.allSubmissions,
    tab,
    ctx.getStatus,
  );
  const count = subs.length;
  const totalViews = subs.reduce((sum, s) => sum + (s.views || 0), 0);
  const avgViews = count > 0 ? Math.round(totalViews / count) : 0;
  const maxViews = count > 0 ? Math.max(...subs.map((s) => s.views || 0)) : 0;

  const overview: ContestAnalyticsSnapshotSection = {
    title: "Overview",
    rows: [
      ["Total Submissions", String(ctx.totalSubmissionCount)],
      ["Approved Content", String(ctx.approvedCount)],
      [
        "Contest Duration",
        ctx.durationDays != null ? `${ctx.durationDays} days` : "N/A",
      ],
    ],
  };

  const viewsStatistics: ContestAnalyticsSnapshotSection = {
    title: "Views Statistics",
    rows: [
      ["Total Views", totalViews.toLocaleString()],
      ["Avg Views", avgViews.toLocaleString()],
      ["Highest Views", maxViews.toLocaleString()],
      [filteredViewsLabel(tab), totalViews.toLocaleString()],
    ],
  };

  const sections: ContestAnalyticsSnapshotSection[] = [overview];

  if (ctx.isTwitterPlatform) {
    const campaignMetrics = computeTwitterCampaignMetrics(subs, {
      platform: ctx.platform,
      contestFormat: ctx.contestFormat,
      contestType: ctx.contestType,
      activeTab: tab,
      creatorModerationData: ctx.creatorModerationData,
    });
    sections.push({
      title: "Campaign Metrics",
      rows: campaignMetricsToRows(campaignMetrics),
    });

    const isRaid =
      ctx.contentType === "raid" && ctx.contestFormat === "text_image";
    if (isRaid && ctx.twitterRaid) {
      const raidRows = buildTwitterRaidExportRows(ctx.twitterRaid);
      if (raidRows.length > 0) {
        sections.push({
          title: "Raid Campaign",
          rows: raidRows,
        });
      }
    }
  } else {
    const platformRows = platformCampaignMetricsToRows(subs, ctx.platform);
    if (platformRows.length > 0) {
      sections.push({
        title: "Campaign Metrics",
        rows: platformRows,
      });
    }
  }

  sections.push(viewsStatistics);

  if (ctx.isTwitterTextImage) {
    const pointsStats = computeTwitterPointsStatistics(
      subs,
      ctx.getCreatorManualAdjustment,
    );
    sections.push({
      title: "Points Statistics",
      rows: pointsStatisticsToRows(pointsStats),
    });
  }

  const contestType = ctx.contestType;
  const isCpm = isCpmContestType(contestType);
  const isMilestone = isMilestoneContestType(contestType);
  const showRoiExtras = showsAnalyticsExpectedRewardMetrics(contestType);

  if (showRoiExtras) {
    const investment = computeTotalInvestment(subs, ctx, tab);
    const expectedRewardCents = sumExpectedRewardCents(subs, ctx, tab);
    const roiRows: [string, string][] = [
      [investment.label, `${investment.value} (${investment.note})`],
      ["Views Generated", totalViews.toLocaleString()],
    ];

    roiRows.push(["Expected Reward", ctx.formatMoney(expectedRewardCents)]);

    const cpmValue =
      totalViews === 0
        ? "$0.00"
        : `$${((expectedRewardCents / 100 / totalViews) * 1000).toFixed(3)}`;
    roiRows.push(["Expected CPM", cpmValue]);

    if (isCpm && ctx.postContestStatus !== "payouts_processed") {
      const totalPaid = subs
        .filter((s) => isPaidSubmission(s, ctx.getStatus))
        .reduce((sum, s) => sum + Number(s.earnings || 0), 0);
      const effectiveCpm =
        totalViews === 0
          ? "$0.00"
          : `$${((totalPaid / 100 / totalViews) * 1000).toFixed(3)}`;
      roiRows.push(["Effective CPM", effectiveCpm]);
    }

    if (ctx.postContestStatus === "payouts_processed") {
      const paidStats = subs.reduce(
        (acc, s) => {
          acc.tabViews += Number(s.views || 0);
          if (!isPaidSubmission(s, ctx.getStatus)) return acc;
          acc.actualPaidCents +=
            Number(s.earnings || 0) +
            Number((s as { bonus_amount?: number }).bonus_amount || 0);
          return acc;
        },
        { actualPaidCents: 0, tabViews: 0 },
      );
      const paidCpm =
        paidStats.tabViews > 0
          ? (paidStats.actualPaidCents / 100 / paidStats.tabViews) * 1000
          : 0;
      roiRows.push(
        ["Total Amount Paid", ctx.formatMoney(paidStats.actualPaidCents)],
        [filteredSubmissionsViewsLabel(tab), paidStats.tabViews.toLocaleString()],
        ["Effective CPM (Paid)", `$${paidCpm.toFixed(3)}`],
      );
    }

    sections.push({
      title: "ROI & Benefit Analysis",
      rows: roiRows,
    });
  }

  const distributions = buildViewsDistributionTables(subs);

  return {
    tab,
    tabLabel: contestAnalyticsTabLabel(tab),
    sections,
    viewsDistributionBySubmission: distributions.bySubmission,
    viewsDistributionByCreator: distributions.byCreator,
  };
}

export function buildAllContestAnalyticsTabSnapshots(
  ctx: ContestAnalyticsSnapshotContext,
  tabs: ContestAnalyticsTabId[],
): ContestAnalyticsTabSnapshot[] {
  return tabs.map((tab) => buildContestAnalyticsTabSnapshot(tab, ctx));
}
