import { isCpmContestType } from "@/lib/contest-type";
import type { ContestAnalyticsExportSubmission } from "@/lib/contest-analytics-export";

export type ReportMetricsInput = {
  submissions: ContestAnalyticsExportSubmission[];
  totalSubmissionCount: number;
  approvedCount: number;
  totalViews: number;
  durationDays: number | null | undefined;
  contestType: string | null | undefined;
  postContestStatus: string | null | undefined;
  cpmRateUsd: number | null | undefined;
  getStatus: (submission: ContestAnalyticsExportSubmission) => string;
  getSubmissionExpectedCents: (
    submission: ContestAnalyticsExportSubmission,
  ) => number;
  formatMoney: (cents: number) => string;
};

export type ReportCoverMetrics = {
  totalSubmissions: number;
  totalSubmissionsLabel: string;
  totalViews: number;
  totalViewsFormatted: string;
  totalReach: number;
  totalEngagements: number;
  spendCents: number;
  spendLabel: string;
  spendFormatted: string;
  durationLabel: string;
  targetCpmUsd: number | null;
  targetCpmFormatted: string | null;
  effectiveCpmUsd: number | null;
  effectiveCpmFormatted: string | null;
  cpmEfficiency: string | null;
  insightSentence: string | null;
  showMarketingBlock: boolean;
};

function readSubmissionStat(
  submission: ContestAnalyticsExportSubmission,
  keys: string[],
): number {
  const stats = submission.other_stats as Record<string, unknown> | null | undefined;
  for (const key of keys) {
    const raw = stats?.[key];
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

export function computeSubmissionReachEngagements(
  submissions: ContestAnalyticsExportSubmission[],
): { totalReach: number; totalEngagements: number } {
  let totalReach = 0;
  let totalEngagements = 0;

  for (const submission of submissions) {
    totalReach += readSubmissionStat(submission, [
      "reach",
      "impressions",
      "total_reach",
    ]);
    totalEngagements +=
      readSubmissionStat(submission, ["likes", "like_count"]) +
      readSubmissionStat(submission, ["comments", "comment_count"]) +
      readSubmissionStat(submission, ["shares", "share_count", "retweets"]) +
      readSubmissionStat(submission, ["saves", "save_count"]);
  }

  return { totalReach, totalEngagements };
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

export function computeExpectedPayoutCents(
  submissions: ContestAnalyticsExportSubmission[],
  getSubmissionExpectedCents: (
    submission: ContestAnalyticsExportSubmission,
  ) => number,
): number {
  return submissions.reduce(
    (sum, s) => sum + getSubmissionExpectedCents(s),
    0,
  );
}

export function computeActualPaidCents(
  submissions: ContestAnalyticsExportSubmission[],
  getStatus: (submission: ContestAnalyticsExportSubmission) => string,
): number {
  return submissions.reduce((sum, s) => {
    if (!isPaidSubmission(s, getStatus)) return sum;
    return (
      sum +
      Number(s.earnings || 0) +
      Number((s as { bonus_amount?: number }).bonus_amount || 0)
    );
  }, 0);
}

export function computeReportSpend(input: ReportMetricsInput): {
  cents: number;
  label: string;
} {
  const payoutsProcessed =
    input.postContestStatus === "payouts_processed";

  if (payoutsProcessed) {
    return {
      cents: computeActualPaidCents(input.submissions, input.getStatus),
      label: "Amount Paid",
    };
  }

  return {
    cents: computeExpectedPayoutCents(
      input.submissions,
      input.getSubmissionExpectedCents,
    ),
    label: "Expected Payout",
  };
}

function formatCpmUsd(value: number): string {
  return `$${value.toFixed(value >= 1 ? 2 : 3)}`;
}

export function computeEffectiveCpmUsd(
  spendCents: number,
  totalViews: number,
): number | null {
  if (totalViews <= 0 || spendCents <= 0) return null;
  return (spendCents / 100 / totalViews) * 1000;
}

export function computeCpmEfficiency(
  targetCpmUsd: number,
  effectiveCpmUsd: number,
): string | null {
  if (targetCpmUsd <= 0 || effectiveCpmUsd <= 0) return null;
  return `${(targetCpmUsd / effectiveCpmUsd).toFixed(1)}×`;
}

export function buildCpmInsightSentence(
  targetCpmUsd: number,
  effectiveCpmUsd: number,
): string {
  if (targetCpmUsd <= 0 || effectiveCpmUsd <= 0) {
    return "";
  }
  const savingsPct = Math.max(
    0,
    Math.round((1 - effectiveCpmUsd / targetCpmUsd) * 100),
  );
  if (effectiveCpmUsd <= targetCpmUsd) {
    return `The campaign delivered views at ${savingsPct}% lower cost than the target CPM of ${formatCpmUsd(targetCpmUsd)}.`;
  }
  return `Effective CPM (${formatCpmUsd(effectiveCpmUsd)}) is above the campaign target CPM of ${formatCpmUsd(targetCpmUsd)}.`;
}

export function resolveTargetCpmUsd(
  contestType: string | null | undefined,
  cpmRateUsd: number | null | undefined,
): number | null {
  if (!isCpmContestType(contestType)) return null;
  const rate = Number(cpmRateUsd);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

export function computeReportCoverMetrics(
  input: ReportMetricsInput,
): ReportCoverMetrics {
  const spend = computeReportSpend(input);
  const targetCpmUsd = resolveTargetCpmUsd(
    input.contestType,
    input.cpmRateUsd,
  );
  const effectiveCpmUsd = computeEffectiveCpmUsd(
    spend.cents,
    input.totalViews,
  );

  const durationLabel =
    input.durationDays != null
      ? `${input.durationDays} days`
      : "N/A";

  const showMarketingBlock = targetCpmUsd != null && effectiveCpmUsd != null;
  const { totalReach, totalEngagements } = computeSubmissionReachEngagements(
    input.submissions,
  );

  return {
    totalSubmissions: input.totalSubmissionCount,
    totalSubmissionsLabel: String(input.totalSubmissionCount),
    totalViews: input.totalViews,
    totalViewsFormatted: input.totalViews.toLocaleString(),
    totalReach,
    totalEngagements,
    spendCents: spend.cents,
    spendLabel: spend.label,
    spendFormatted: input.formatMoney(spend.cents),
    durationLabel,
    targetCpmUsd,
    targetCpmFormatted:
      targetCpmUsd != null ? formatCpmUsd(targetCpmUsd) : null,
    effectiveCpmUsd,
    effectiveCpmFormatted:
      effectiveCpmUsd != null ? formatCpmUsd(effectiveCpmUsd) : null,
    cpmEfficiency:
      targetCpmUsd != null && effectiveCpmUsd != null
        ? computeCpmEfficiency(targetCpmUsd, effectiveCpmUsd)
        : null,
    insightSentence:
      targetCpmUsd != null && effectiveCpmUsd != null
        ? buildCpmInsightSentence(targetCpmUsd, effectiveCpmUsd)
        : null,
    showMarketingBlock,
  };
}

export function marketingPerformanceRows(
  metrics: ReportCoverMetrics,
): [string, string][] {
  if (!metrics.showMarketingBlock) return [];
  const rows: [string, string][] = [];
  if (metrics.targetCpmFormatted) {
    rows.push(["Target CPM", metrics.targetCpmFormatted]);
  }
  if (metrics.effectiveCpmFormatted) {
    rows.push(["Effective CPM (eCPM)", metrics.effectiveCpmFormatted]);
  }
  if (metrics.cpmEfficiency) {
    rows.push(["CPM Efficiency", metrics.cpmEfficiency]);
  }
  rows.push([metrics.spendLabel, metrics.spendFormatted]);
  rows.push(["Total Views", metrics.totalViewsFormatted]);
  return rows;
}

export function executiveSummaryRows(
  metrics: ReportCoverMetrics,
  approvedCount: number,
): [string, string][] {
  return [
    ["Total Submissions", metrics.totalSubmissionsLabel],
    ["Approved Content", String(approvedCount)],
    ["Total Views", metrics.totalViewsFormatted],
    [metrics.spendLabel, metrics.spendFormatted],
    ["Contest Duration", metrics.durationLabel],
  ];
}
