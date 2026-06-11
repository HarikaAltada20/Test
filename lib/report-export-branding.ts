export const GOC_PLATFORM_NAME = "Game of Creators";

import { formatReportExportDateIST, formatReportGeneratedTimestampIST } from "@/lib/report-export-timestamp";

export const GOC_TAGLINE =
  "India\u2019s First & Largest Purely Performance-Driven Viral Marketing Engine.";

export const REPORT_THEME = {
  navyDark: "06021D",
  navyMid: "170337",
  indigo: "4F46E5",
  gold: "C9A227",
  goldLight: "D4AF37",
  white: "FFFFFF",
  slate: "64748B",
  rowAlt: "F1F5F9",
} as const;

export type ExportReportType =
  | "full"
  | "submissions"
  | "creator-wise"
  | "analytics";

export type ReportSubmissionFilter =
  | "all"
  | "verified"
  | "paid"
  | "verified_or_paid"
  | "pending"
  | "rejected"
  | "not_rejected";

export const DEFAULT_REPORT_SUBMISSION_FILTER: ReportSubmissionFilter =
  "verified_or_paid";

export function formatSubmissionDataScopeLabel(
  filter: ReportSubmissionFilter,
): string {
  switch (filter) {
    case "all":
      return "All Submissions Data";
    case "verified":
      return "Verified Submissions Data";
    case "paid":
      return "Paid Submissions Data";
    case "verified_or_paid":
      return "Verified + Paid Submissions Data";
    case "pending":
      return "Pending Submissions Data";
    case "rejected":
      return "Rejected Submissions Data";
    case "not_rejected":
      return "Not Rejected Submissions Data";
    default:
      return "All Submissions Data";
  }
}

/** Short filter label for export section titles */
export function formatSubmissionFilterShort(
  filter: ReportSubmissionFilter,
): string {
  switch (filter) {
    case "all":
      return "All";
    case "verified":
      return "Verified";
    case "paid":
      return "Paid";
    case "verified_or_paid":
      return "Verified + Paid";
    case "pending":
      return "Pending";
    case "rejected":
      return "Rejected";
    case "not_rejected":
      return "Not Rejected";
    default:
      return "All";
  }
}

export function buildSubmissionsWiseSectionTitle(
  filter: ReportSubmissionFilter = DEFAULT_REPORT_SUBMISSION_FILTER,
): string {
  const filterShort = formatSubmissionFilterShort(filter);
  return `Submissions wise view - ${filterShort} - submissions list`;
}

export function buildCreatorWiseSectionTitle(
  filter: ReportSubmissionFilter = DEFAULT_REPORT_SUBMISSION_FILTER,
): string {
  const filterShort = formatSubmissionFilterShort(filter);
  return `Creator wise view - ${filterShort} - submissions list`;
}

export type ExportReportBranding = {
  brandCompanyName: string;
  brandWebsite?: string | null;
  platformName: string;
  contestTitle: string;
  reportTitle: string;
  reportDescription: string;
  exportedAt: string;
  exportDateLabel: string;
  reportId: string;
  dataScopeLabel: string;
  contestStart?: string | null;
  contestEnd?: string | null;
  durationDays?: number | null;
  filtersApplied?: string | null;
  reportType: ExportReportType;
  contestId?: string | null;
  contestLifecycleStatus?: string | null;
  postContestStatus?: string | null;
};

export type BrandProfile = {
  company_name: string | null;
  website_url?: string | null;
};

export function buildReportDescription(opts: {
  viewLabel?: string;
  sortLabel?: string;
  analyticsTabs?: string[];
}): string {
  const parts: string[] = [];
  if (opts.viewLabel) parts.push(opts.viewLabel);
  if (opts.sortLabel) parts.push(opts.sortLabel);
  if (opts.analyticsTabs?.length) {
    parts.push(`Analytics: ${opts.analyticsTabs.join(", ")}`);
  }
  return parts.join(" · ") || "All data";
}

export function reportTitleForType(type: ExportReportType): string {
  switch (type) {
    case "full":
      return "Campaign Performance Report";
    case "submissions":
      return "Submissions Leaderboard Report";
    case "creator-wise":
      return "Creator-wise Leaderboard Report";
    case "analytics":
      return "Campaign Analytics Report";
    default:
      return "Campaign Report";
  }
}

export function buildExportReportBranding(opts: {
  brandProfile?: BrandProfile | null;
  contestTitle: string;
  reportType: ExportReportType;
  exportedAt: Date;
  reportId: string;
  dataScopeLabel: string;
  contestStart?: string | null;
  contestEnd?: string | null;
  durationDays?: number | null;
  filtersApplied?: string | null;
  reportDescription?: string;
  contestId?: string | null;
  contestLifecycleStatus?: string | null;
  postContestStatus?: string | null;
}): ExportReportBranding {
  return {
    brandCompanyName:
      opts.brandProfile?.company_name?.trim() || "Campaign Owner",
    brandWebsite: opts.brandProfile?.website_url ?? null,
    platformName: GOC_PLATFORM_NAME,
    contestTitle: opts.contestTitle,
    reportTitle: reportTitleForType(opts.reportType),
    reportDescription: opts.reportDescription ?? "",
    exportedAt: formatReportGeneratedTimestampIST(opts.exportedAt),
    exportDateLabel: formatReportExportDateIST(opts.exportedAt),
    reportId: opts.reportId,
    dataScopeLabel: opts.dataScopeLabel,
    contestStart: opts.contestStart,
    contestEnd: opts.contestEnd,
    durationDays: opts.durationDays,
    filtersApplied: opts.filtersApplied ?? opts.dataScopeLabel,
    reportType: opts.reportType,
    contestId: opts.contestId ?? null,
    contestLifecycleStatus: opts.contestLifecycleStatus ?? null,
    postContestStatus: opts.postContestStatus ?? null,
  };
}

