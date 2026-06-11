import type { ContestAnalyticsExportSubmission } from "@/lib/contest-analytics-export";
import { filterSubmissionsForAnalyticsTab } from "@/lib/contest-analytics-export";
import {
  buildExportReportBranding,
  buildReportDescription,
  DEFAULT_REPORT_SUBMISSION_FILTER,
  formatSubmissionDataScopeLabel,
  type BrandProfile,
  type ExportReportBranding,
  type ExportReportType,
  type ReportSubmissionFilter,
} from "@/lib/report-export-branding";
import {
  computeReportCoverMetrics,
  type ReportCoverMetrics,
  type ReportMetricsInput,
} from "@/lib/report-export-metrics";
import { buildReportIdFromInstant } from "@/lib/report-export-timestamp";
import { centsToDollars } from "@/lib/currency-utils";

export type ReportExportContestContext = {
  contestId?: string | null;
  contestTitle: string;
  contestType?: string | null;
  contestLifecycleStatus?: string | null;
  postContestStatus?: string | null;
  cpmRateUsd?: number | null;
  durationDays?: number | null;
  contestStart?: string | null;
  contestEnd?: string | null;
  platform?: string | null;
};

export function buildReportMetricsInput(opts: {
  contest: ReportExportContestContext;
  submissions: ContestAnalyticsExportSubmission[];
  approvedCount: number;
  getStatus: (submission: ContestAnalyticsExportSubmission) => string;
  getSubmissionExpectedCents: (
    submission: ContestAnalyticsExportSubmission,
  ) => number;
}): ReportMetricsInput {
  const totalViews = opts.submissions.reduce(
    (sum, s) => sum + (s.views || 0),
    0,
  );

  return {
    submissions: opts.submissions,
    totalSubmissionCount: opts.submissions.length,
    approvedCount: opts.approvedCount,
    totalViews,
    durationDays: opts.contest.durationDays,
    contestType: opts.contest.contestType,
    postContestStatus: opts.contest.postContestStatus,
    cpmRateUsd: opts.contest.cpmRateUsd,
    getStatus: opts.getStatus,
    getSubmissionExpectedCents: opts.getSubmissionExpectedCents,
    formatMoney: (cents: number) => `$${centsToDollars(cents).toFixed(2)}`,
  };
}

function countApprovedSubmissions(
  submissions: ContestAnalyticsExportSubmission[],
  getStatus: (submission: ContestAnalyticsExportSubmission) => string,
): number {
  return submissions.filter((submission) => {
    const status = getStatus(submission);
    return status === "verified" || status === "paid";
  }).length;
}

export function filterSubmissionsForReportExport(
  submissions: ContestAnalyticsExportSubmission[],
  filter: ReportSubmissionFilter,
  getStatus: (submission: ContestAnalyticsExportSubmission) => string,
): ContestAnalyticsExportSubmission[] {
  return filterSubmissionsForAnalyticsTab(submissions, filter, getStatus);
}

export function buildReportExportBundle(opts: {
  brandProfile?: BrandProfile | null;
  contest: ReportExportContestContext;
  reportType: ExportReportType;
  submissions: ContestAnalyticsExportSubmission[];
  approvedCount?: number;
  getStatus: (submission: ContestAnalyticsExportSubmission) => string;
  getSubmissionExpectedCents: (
    submission: ContestAnalyticsExportSubmission,
  ) => number;
  viewLabel?: string;
  sortLabel?: string;
  analyticsTabs?: string[];
  filtersApplied?: string | null;
  submissionFilter?: ReportSubmissionFilter;
  exportedAt?: Date;
}): {
  branding: ExportReportBranding;
  metrics: ReportCoverMetrics;
  approvedCount: number;
  filteredSubmissions: ContestAnalyticsExportSubmission[];
  submissionFilter: ReportSubmissionFilter;
  exportedAt: Date;
} {
  const exportedAt = opts.exportedAt ?? new Date();
  const submissionFilter = opts.submissionFilter ?? DEFAULT_REPORT_SUBMISSION_FILTER;
  const dataScopeLabel = formatSubmissionDataScopeLabel(submissionFilter);
  const filteredSubmissions = filterSubmissionsForReportExport(
    opts.submissions,
    submissionFilter,
    opts.getStatus,
  );
  const approvedCount =
    opts.approvedCount ??
    countApprovedSubmissions(filteredSubmissions, opts.getStatus);

  const metricsInput = buildReportMetricsInput({
    contest: opts.contest,
    submissions: filteredSubmissions,
    approvedCount,
    getStatus: opts.getStatus,
    getSubmissionExpectedCents: opts.getSubmissionExpectedCents,
  });

  const metrics = computeReportCoverMetrics(metricsInput);
  const reportDescription = buildReportDescription({
    viewLabel: opts.viewLabel,
    sortLabel: opts.sortLabel,
    analyticsTabs: opts.analyticsTabs,
  });

  const branding = buildExportReportBranding({
    brandProfile: opts.brandProfile,
    contestTitle: opts.contest.contestTitle,
    reportType: opts.reportType,
    exportedAt,
    reportId: buildReportIdFromInstant(exportedAt),
    dataScopeLabel,
    contestStart: opts.contest.contestStart,
    contestEnd: opts.contest.contestEnd,
    durationDays: opts.contest.durationDays,
    filtersApplied: opts.filtersApplied ?? dataScopeLabel,
    reportDescription,
    contestId: opts.contest.contestId,
    contestLifecycleStatus: opts.contest.contestLifecycleStatus,
    postContestStatus: opts.contest.postContestStatus,
  });

  return {
    branding,
    metrics,
    approvedCount,
    filteredSubmissions,
    submissionFilter,
    exportedAt,
  };
}

export function getCpmRateFromContest(contestBasedDetails: unknown): number | null {
  const details = contestBasedDetails as
    | { cpm_contest?: { cpm_rate_usd?: number } }
    | null
    | undefined;
  const rate = details?.cpm_contest?.cpm_rate_usd;
  return typeof rate === "number" && rate > 0 ? rate : null;
}
