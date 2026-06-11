import type { PlatformMetrics } from "@/lib/submission-leaderboard-export";

export type ReportExportSortOption =
  | "views_desc"
  | "views_asc"
  | "time_desc"
  | "time_asc"
  | "points_desc"
  | "points_asc"
  | "impressions_desc"
  | "impressions_asc"
  | "submissions_desc"
  | "submissions_asc";

export const DEFAULT_REPORT_EXPORT_SORT: ReportExportSortOption = "views_desc";

export const REPORT_EXPORT_SORT_LABELS: Record<ReportExportSortOption, string> =
  {
    views_desc: "Views · High → Low",
    views_asc: "Views · Low → High",
    time_desc: "Submitted · Newest First",
    time_asc: "Submitted · Oldest First",
    points_desc: "Points · High → Low",
    points_asc: "Points · Low → High",
    impressions_desc: "Impressions · High → Low",
    impressions_asc: "Impressions · Low → High",
    submissions_desc: "Submissions · High → Low",
    submissions_asc: "Submissions · Low → High",
  };

export function getReportExportSortOptions(
  isTwitterTextImage = false,
): ReportExportSortOption[] {
  if (isTwitterTextImage) {
    return [
      "views_desc",
      "views_asc",
      "points_desc",
      "points_asc",
      "impressions_desc",
      "impressions_asc",
      "time_desc",
      "time_asc",
    ];
  }
  return [
    "views_desc",
    "views_asc",
    "time_desc",
    "time_asc",
    "submissions_desc",
    "submissions_asc",
  ];
}

export function getReportExportSortLabel(
  sortOption: ReportExportSortOption,
): string {
  return REPORT_EXPORT_SORT_LABELS[sortOption] ?? sortOption;
}

export function getReportExportSortDividerLine(
  sortOption: ReportExportSortOption,
): string {
  return `Sorted by ${getReportExportSortLabel(sortOption)}`;
}

function getTwitterSubmissionPoints(submission: Record<string, unknown>): number {
  const manual = Number((submission as { manual_points_adjustment?: number }).manual_points_adjustment) || 0;
  const otherStats = (submission.other_stats ?? {}) as Record<string, unknown>;
  const base = Number(otherStats.base_points) || 0;
  const pts = otherStats.points;
  if (typeof pts === "number" && !Number.isNaN(pts)) {
    return pts;
  }
  return base + manual;
}

function getSubmissionViews(
  submission: Record<string, unknown>,
  getMetrics?: (submission: Record<string, unknown>) => PlatformMetrics,
): number {
  if (getMetrics) {
    const metrics = getMetrics(submission);
    if (typeof metrics.views === "number") return metrics.views;
  }
  return Number(submission.views) || 0;
}

function getSubmissionImpressions(submission: Record<string, unknown>): number {
  const otherStats = (submission.other_stats ?? {}) as Record<string, unknown>;
  return Number(otherStats.impressions) || 0;
}

function getSubmissionCreatedAt(submission: Record<string, unknown>): number {
  const created = submission.created_at;
  return created ? new Date(String(created)).getTime() : 0;
}

export function sortSubmissionsForExport(
  submissions: Record<string, unknown>[],
  sortOption: ReportExportSortOption,
  options: {
    isTwitterTextImage?: boolean;
    getMetrics?: (submission: Record<string, unknown>) => PlatformMetrics;
  } = {},
): Record<string, unknown>[] {
  const sorted = [...submissions];

  sorted.sort((a, b) => {
    switch (sortOption) {
      case "views_asc":
        return (
          getSubmissionViews(a, options.getMetrics) -
          getSubmissionViews(b, options.getMetrics)
        );
      case "views_desc":
        return (
          getSubmissionViews(b, options.getMetrics) -
          getSubmissionViews(a, options.getMetrics)
        );
      case "time_asc":
        return getSubmissionCreatedAt(a) - getSubmissionCreatedAt(b);
      case "time_desc":
        return getSubmissionCreatedAt(b) - getSubmissionCreatedAt(a);
      case "points_asc":
        return getTwitterSubmissionPoints(a) - getTwitterSubmissionPoints(b);
      case "points_desc":
        return getTwitterSubmissionPoints(b) - getTwitterSubmissionPoints(a);
      case "impressions_asc":
        return getSubmissionImpressions(a) - getSubmissionImpressions(b);
      case "impressions_desc":
        return getSubmissionImpressions(b) - getSubmissionImpressions(a);
      default:
        return (
          getSubmissionViews(b, options.getMetrics) -
          getSubmissionViews(a, options.getMetrics)
        );
    }
  });

  return sorted;
}

export function sortCreatorGroupsForExport(
  groups: Record<string, unknown>[],
  sortOption: ReportExportSortOption,
): Record<string, unknown>[] {
  const sorted = [...groups];
  const metrics = (group: Record<string, unknown>) =>
    (group.metrics ?? {}) as Record<string, number | undefined>;

  sorted.sort((a, b) => {
    const am = metrics(a);
    const bm = metrics(b);
    const subs = (group: Record<string, unknown>) =>
      Number(group.totalCount ?? 0);
    const created = (group: Record<string, unknown>) => {
      const value = group.firstSubmittedAt;
      return value ? new Date(String(value)).getTime() : 0;
    };

    switch (sortOption) {
      case "views_asc":
        return (am.views ?? 0) - (bm.views ?? 0);
      case "views_desc":
        return (bm.views ?? 0) - (am.views ?? 0);
      case "time_asc":
        return created(a) - created(b);
      case "time_desc":
        return created(b) - created(a);
      case "points_asc":
        return (am.points ?? 0) - (bm.points ?? 0);
      case "points_desc":
        return (bm.points ?? 0) - (am.points ?? 0);
      case "impressions_asc":
        return (am.impressions ?? 0) - (bm.impressions ?? 0);
      case "impressions_desc":
        return (bm.impressions ?? 0) - (am.impressions ?? 0);
      case "submissions_asc":
        return subs(a) - subs(b);
      case "submissions_desc":
        return subs(b) - subs(a);
      default:
        return (bm.views ?? 0) - (am.views ?? 0);
    }
  });

  return sorted;
}
