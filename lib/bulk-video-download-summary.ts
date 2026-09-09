export type BulkDownloadSummaryUserType = "admin" | "advertiser";

export type BulkVideoDownloadJobSummary = {
  id: string;
  contestId: string;
  userId: string;
  userType: BulkDownloadSummaryUserType;
  status: "queued" | "running" | "completed" | "failed";
  totalCount: number;
  successCount: number;
  failedCount: number;
  zipPartTotal: number;
  namingPattern: string | null;
  fileNamePrefix: string | null;
  createdAt: string;
  finishedAt: string | null;
  source?: "cloud" | "desktop";
  deliveryMode?: string | null;
};

function createdAtMs(value: string | null | undefined): number {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortBulkDownloadJobsNewestFirst<
  T extends { createdAt: string },
>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt));
}

export function groupBulkDownloadJobsByUserType<
  T extends { userType: BulkDownloadSummaryUserType; createdAt: string },
>(jobs: T[]): {
  admin: T[];
  advertiser: T[];
} {
  const sorted = sortBulkDownloadJobsNewestFirst(jobs);
  return {
    admin: sorted.filter((job) => job.userType === "admin"),
    advertiser: sorted.filter((job) => job.userType === "advertiser"),
  };
}

export function defaultBulkDownloadSummaryTab(options: {
  viewerUserType: BulkDownloadSummaryUserType;
  hasAdminJobs: boolean;
  hasAdvertiserJobs: boolean;
  preferLiveUserType?: BulkDownloadSummaryUserType | null;
}): BulkDownloadSummaryUserType {
  const prefer = options.preferLiveUserType;
  if (prefer === "admin" && options.hasAdminJobs) return "admin";
  if (prefer === "advertiser" && options.hasAdvertiserJobs) return "advertiser";
  if (options.viewerUserType === "admin") {
    if (options.hasAdminJobs) return "admin";
    if (options.hasAdvertiserJobs) return "advertiser";
    return "admin";
  }
  return "advertiser";
}

export function canAccessBulkVideoDownloadJob(options: {
  viewerUserType: BulkDownloadSummaryUserType;
  viewerUserId: string;
  jobUserId: string;
}): boolean {
  if (options.viewerUserType === "admin") return true;
  return options.viewerUserId === options.jobUserId;
}

export type DownloadSummaryStatusTab =
  | "all"
  | "verified"
  | "pending"
  | "rejected"
  | "paid"
  | "not_rejected"
  | "verified_paid";

export const DOWNLOAD_SUMMARY_STATUS_TABS: {
  id: DownloadSummaryStatusTab;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "verified", label: "Verified" },
  { id: "pending", label: "Pending" },
  { id: "rejected", label: "Rejected" },
  { id: "paid", label: "Paid" },
  { id: "not_rejected", label: "Not Rejected" },
  { id: "verified_paid", label: "Verified + Paid" },
];

export type DownloadSummarySort =
  | "views_desc"
  | "quality_desc"
  | "downloaded_desc";

export function normalizeDownloadSubmissionStatus(
  value: string | null | undefined,
): "pending" | "verified" | "rejected" | "paid" {
  const raw = String(value || "pending").toLowerCase();
  if (raw === "paid") return "paid";
  if (raw === "verified" || raw === "approved") return "verified";
  if (raw === "rejected") return "rejected";
  return "pending";
}

export function rowMatchesDownloadStatusTab(
  submissionStatus: string | null | undefined,
  tab: DownloadSummaryStatusTab,
): boolean {
  const status = normalizeDownloadSubmissionStatus(submissionStatus);
  if (tab === "all") return true;
  if (tab === "not_rejected") return status !== "rejected";
  if (tab === "verified_paid") return status === "verified" || status === "paid";
  return status === tab;
}

const ZIP_STATUS_SLUG_TO_TAB: Record<string, DownloadSummaryStatusTab> = {
  all: "all",
  verified: "verified",
  pending: "pending",
  rejected: "rejected",
  paid: "paid",
  nonrejected: "not_rejected",
  verified_paid: "verified_paid",
  verified_or_paid: "verified_paid",
  verifiedorpaid: "verified_paid",
};

export function downloadJobStatusSlugToTab(
  statusSlug: string | null | undefined,
): DownloadSummaryStatusTab {
  const slug = String(statusSlug || "all")
    .trim()
    .toLowerCase()
    .replace(/-/g, "");
  return ZIP_STATUS_SLUG_TO_TAB[slug] || "all";
}

export function jobMatchesListStatusTab(
  statusSlug: string | null | undefined,
  tab: DownloadSummaryStatusTab,
): boolean {
  if (tab === "all") return true;
  return downloadJobStatusSlugToTab(statusSlug) === tab;
}

export function countDownloadJobsByStatusTab(
  jobs: Array<{ statusSlug?: string | null }>,
): Record<DownloadSummaryStatusTab, number> {
  const counts: Record<DownloadSummaryStatusTab, number> = {
    all: jobs.length,
    verified: 0,
    pending: 0,
    rejected: 0,
    paid: 0,
    not_rejected: 0,
    verified_paid: 0,
  };
  for (const job of jobs) {
    const tab = downloadJobStatusSlugToTab(job.statusSlug);
    if (tab !== "all") counts[tab] += 1;
  }
  return counts;
}

export function countDownloadRowsByStatusTab(
  rows: Array<{ submissionStatus?: string | null }>,
): Record<DownloadSummaryStatusTab, number> {
  const counts: Record<DownloadSummaryStatusTab, number> = {
    all: rows.length,
    verified: 0,
    pending: 0,
    rejected: 0,
    paid: 0,
    not_rejected: 0,
    verified_paid: 0,
  };
  for (const row of rows) {
    const status = normalizeDownloadSubmissionStatus(row.submissionStatus);
    counts[status] += 1;
    if (status !== "rejected") counts.not_rejected += 1;
    if (status === "verified" || status === "paid") counts.verified_paid += 1;
  }
  return counts;
}

function timeMs(value: string | null | undefined): number {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortDownloadSummaryRows<
  T extends {
    views?: number | null;
    qualityScore?: number | null;
    downloadedAt?: string | null;
  },
>(rows: T[], sort: DownloadSummarySort): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "quality_desc") {
      const aq =
        typeof a.qualityScore === "number" && Number.isFinite(a.qualityScore)
          ? a.qualityScore
          : -1;
      const bq =
        typeof b.qualityScore === "number" && Number.isFinite(b.qualityScore)
          ? b.qualityScore
          : -1;
      if (bq !== aq) return bq - aq;
    } else if (sort === "downloaded_desc") {
      const cmp = timeMs(b.downloadedAt) - timeMs(a.downloadedAt);
      if (cmp !== 0) return cmp;
    }
    return (Number(b.views) || 0) - (Number(a.views) || 0);
  });
  return copy;
}

export function jobRowToDownloadSummary(row: {
  id: string;
  contest_id: string;
  user_id: string;
  user_type?: string | null;
  status?: string | null;
  total_count?: number | null;
  success_count?: number | null;
  failed_count?: number | null;
  zip_part_total?: number | null;
  naming_pattern?: string | null;
  file_name_prefix?: string | null;
  created_at?: string | null;
  finished_at?: string | null;
  source?: string | null;
  delivery_mode?: string | null;
}): BulkVideoDownloadJobSummary {
  const status =
    row.status === "queued" ||
    row.status === "running" ||
    row.status === "completed" ||
    row.status === "failed"
      ? row.status
      : "running";
  return {
    id: String(row.id),
    contestId: String(row.contest_id),
    userId: String(row.user_id),
    userType: row.user_type === "advertiser" ? "advertiser" : "admin",
    status,
    totalCount: Number(row.total_count) || 0,
    successCount: Number(row.success_count) || 0,
    failedCount: Number(row.failed_count) || 0,
    zipPartTotal: Math.max(1, Number(row.zip_part_total) || 1),
    namingPattern:
      typeof row.naming_pattern === "string" ? row.naming_pattern : null,
    fileNamePrefix:
      typeof row.file_name_prefix === "string" && row.file_name_prefix.trim()
        ? row.file_name_prefix.trim()
        : null,
    createdAt: String(row.created_at || ""),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    source: row.source === "desktop" ? "desktop" : "cloud",
    deliveryMode:
      typeof row.delivery_mode === "string" ? row.delivery_mode : null,
  };
}
