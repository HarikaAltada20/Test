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

export type ContestAnalyticsTabSnapshot = {
  tab: ContestAnalyticsTabId;
  tabLabel: string;
  sections: ContestAnalyticsSnapshotSection[];
  viewsDistribution: {
    headers: string[];
    rows: string[][];
  };
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

function viewsGeneratedSubtitle(tab: ContestAnalyticsTabId): string {
  if (tab === "all") return "All Submissions";
  if (tab === "verified") return "Verified Only";
  if (tab === "paid") return "Paid Only";
  if (tab === "pending") return "Pending Only";
  if (tab === "rejected") return "Rejected Only";
  if (tab === "not_rejected") return "Not Rejected";
  if (tab === "verified_or_paid") return "Verified/Paid";
  return "Filtered";
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
      ["Views Generated (filter)", viewsGeneratedSubtitle(tab)],
    ];

    roiRows.push(["Expected Reward", ctx.formatMoney(expectedRewardCents)]);

    const cpmValue =
      totalViews === 0
        ? "$0.00"
        : `$${((expectedRewardCents / 100 / totalViews) * 1000).toFixed(3)}`;
    roiRows.push(["Expected CPM", cpmValue]);
    roiRows.push([
      "Expected CPM (formula)",
      tab === "paid"
        ? "Paid amount ÷ paid views × 1000"
        : "Expected reward ÷ views × 1000",
    ]);

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
        ["Selected Tab Views", paidStats.tabViews.toLocaleString()],
        ["Effective CPM (Paid)", `$${paidCpm.toFixed(3)}`],
      );
    }

    sections.push({
      title: "ROI & Benefit Analysis",
      rows: roiRows,
    });

    let totalCost = 0;
    if (contestType === "leaderboard") {
      totalCost = ctx.leaderboardTotalPrizeCents;
    } else if (isCpmContestType(contestType) || isMilestoneContestType(contestType)) {
      totalCost = subs
        .filter((s) => isPaidSubmission(s, ctx.getStatus))
        .reduce((sum, s) => sum + Number(s.earnings || 0), 0);
    }
    const efficiency =
      totalCost === 0
        ? "N/A"
        : `${(totalViews / (totalCost / 100 / 100)).toFixed(0)} views per $100`;

    sections.push({
      title: "Performance Summary",
      rows: [
        ["Investment Efficiency", efficiency],
        ["Contest Type", contestTypeDisplay(contestType)],
      ],
    });
  }

  const sorted = [...subs].sort((a, b) => (b.views || 0) - (a.views || 0));
  const top = sorted.slice(0, 10);
  const maxForPct = maxViews;

  return {
    tab,
    tabLabel: contestAnalyticsTabLabel(tab),
    sections,
    viewsDistribution: {
      headers: ["Rank", "Creator", "Views", "% of Highest"],
      rows: top.map((sub, index) => {
        const views = sub.views || 0;
        const pct =
          maxForPct > 0 ? ((views / maxForPct) * 100).toFixed(1) : "0";
        const creator =
          sub.creator_username ||
          sub.creator_display_name ||
          "Unknown Creator";
        return [
          String(index + 1),
          creator,
          views.toLocaleString(),
          `${pct}%`,
        ];
      }),
    },
  };
}

export function buildAllContestAnalyticsTabSnapshots(
  ctx: ContestAnalyticsSnapshotContext,
  tabs: ContestAnalyticsTabId[],
): ContestAnalyticsTabSnapshot[] {
  return tabs.map((tab) => buildContestAnalyticsTabSnapshot(tab, ctx));
}
