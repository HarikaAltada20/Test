import { sanitizeFilename } from "./utils";

export const VIDEO_FILENAME_PATTERNS = [
  "views",
  "views_username",
  "views_username_status_quality_score",
] as const;

export type VideoFilenamePattern = (typeof VIDEO_FILENAME_PATTERNS)[number];

export const DEFAULT_VIDEO_FILENAME_PATTERN: VideoFilenamePattern = "views";

export const VIDEO_FILENAME_PATTERN_LABELS: Record<
  VideoFilenamePattern,
  { label: string; description: string; example: string }
> = {
  views: {
    label: "Views only",
    description:
      "Names the file with sort rank + view count so Explorer order matches your table sort.",
    example: "001_000000012500.mp4",
  },
  views_username: {
    label: "Views + username",
    description: "Uses sort rank, view count, and creator username.",
    example: "001_000000012500_jane_creator.mp4",
  },
  views_username_status_quality_score: {
    label: "Views + username + status + quality",
    description: "Includes sort rank, moderation status, and quality score.",
    example: "001_000000012500_jane_creator_verified_3.mp4",
  },
};

export type VideoFilenameParts = {
  views?: number | null;
  username?: string | null;
  status?: string | null;
  qualityScore?: number | null;
  uniqueSuffix?: string | null;
  /** 1-based rank in the current leaderboard sort (Explorer name order). */
  sortRank?: number | null;
  /** Total videos in this download (controls rank zero-padding width). */
  sortTotal?: number | null;
};

export function isVideoFilenamePattern(
  value: unknown,
): value is VideoFilenamePattern {
  return (
    typeof value === "string" &&
    (VIDEO_FILENAME_PATTERNS as readonly string[]).includes(value)
  );
}

export function parseVideoFilenamePattern(
  value: unknown,
): VideoFilenamePattern {
  return isVideoFilenamePattern(value) ? value : DEFAULT_VIDEO_FILENAME_PATTERN;
}

export function formatViewCountPart(views: number | null | undefined): string {
  const n = Math.max(0, Math.floor(Number(views) || 0));
  return String(n).padStart(12, "0");
}

/** Zero-padded rank so Explorer A→Z order matches the selected table sort. */
export function formatSortRankPart(
  rank: number | null | undefined,
  total?: number | null,
): string {
  const safeRank = Math.max(1, Math.floor(Number(rank) || 1));
  const safeTotal = Math.max(safeRank, Math.floor(Number(total) || safeRank));
  const width = Math.max(3, String(safeTotal).length);
  return String(safeRank).padStart(width, "0");
}

function sanitizePart(
  value: string | null | undefined,
  fallback: string,
  max = 40,
): string {
  const cleaned = sanitizeFilename(String(value || "")).slice(0, max);
  return cleaned || fallback;
}

export function formatQualityScorePart(
  qualityScore: number | null | undefined,
): string {
  if (qualityScore == null) return "unscored";
  const n = Number(qualityScore);
  if (!Number.isFinite(n)) return "unscored";
  return String(Math.round(n));
}

export function joinedRecordUsername(users: unknown): string {
  if (Array.isArray(users)) return joinedRecordUsername(users[0]);
  if (users && typeof users === "object" && "username" in users) {
    const value = (users as { username?: unknown }).username;
    return typeof value === "string" ? value.trim() : "";
  }
  return "";
}

/** Contest join may be an object (many-to-one) or a one-element array. */
export function joinedRecordAdvertiserId(contests: unknown): string | null {
  if (Array.isArray(contests)) return joinedRecordAdvertiserId(contests[0]);
  if (contests && typeof contests === "object" && "advertiser_id" in contests) {
    const value = (contests as { advertiser_id?: unknown }).advertiser_id;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  return null;
}

/**
 * Filename based on view count.
 * Optional suffix disambiguates equal view counts in the same ZIP.
 */
export function buildViewsBasedVideoFilename(
  views: number | null | undefined,
  uniqueSuffix?: string | null,
): string {
  return buildVideoDownloadFilename("views", { views, uniqueSuffix });
}

export function buildVideoDownloadFilename(
  pattern: VideoFilenamePattern,
  parts: VideoFilenameParts,
): string {
  const views = formatViewCountPart(parts.views);
  const username = sanitizePart(parts.username, "unknown", 40);
  const status = sanitizePart(parts.status, "unknown", 24);
  const quality = formatQualityScorePart(parts.qualityScore);

  let base: string;
  switch (pattern) {
    case "views_username":
      base = `${views}_${username}`;
      break;
    case "views_username_status_quality_score":
      base = `${views}_${username}_${status}_${quality}`;
      break;
    default:
      base = views;
  }

  if (parts.uniqueSuffix) {
    base = `${base}_${sanitizePart(String(parts.uniqueSuffix), "id", 12)}`;
  }

  if (parts.sortRank != null && Number(parts.sortRank) > 0) {
    base = `${formatSortRankPart(parts.sortRank, parts.sortTotal)}_${base}`;
  }

  return sanitizeFilename(base) || views;
}

export function uniqueVideoDownloadFilename(
  used: Set<string>,
  pattern: VideoFilenamePattern,
  parts: VideoFilenameParts,
  format = "mp4",
): string {
  const { uniqueSuffix, ...baseParts } = parts;
  let name = `${buildVideoDownloadFilename(pattern, baseParts)}.${format}`;
  let attempt = 0;
  while (used.has(name)) {
    attempt += 1;
    const suffix =
      attempt === 1 && uniqueSuffix
        ? uniqueSuffix
        : `${String(uniqueSuffix || "dup").slice(0, 8)}_${attempt}`;
    name = `${buildVideoDownloadFilename(pattern, {
      ...baseParts,
      uniqueSuffix: suffix,
    })}.${format}`;
  }
  used.add(name);
  return name;
}

const BULK_ZIP_FILENAME_MAX = 150;
const BULK_ZIP_CONTEST_SLUG_MAX = 40;

const BULK_ZIP_SORT_SLUGS: Record<string, string> = {
  views_desc: "views_high_to_low",
  views_asc: "views_low_to_high",
  time_desc: "submitted_newest_first",
  date_desc: "submitted_newest_first",
  time_asc: "submitted_oldest_first",
  date_asc: "submitted_oldest_first",
  submissions_desc: "submissions_high_to_low",
  submissions_asc: "submissions_low_to_high",
  points_desc: "points_high_to_low",
  points_asc: "points_low_to_high",
  impressions_desc: "impressions_high_to_low",
  impressions_asc: "impressions_low_to_high",
};

const BULK_ZIP_STATUS_SLUGS: Record<string, string> = {
  all: "all",
  verified: "verified",
  rejected: "rejected",
  pending: "pending",
  paid: "paid",
  not_rejected: "nonrejected",
  nonrejected: "nonrejected",
  verified_or_paid: "verified_paid",
  verified_paid: "verified_paid",
};

export type BulkZipNameContext = {
  contestTitle?: string | null;
  sort?: string | null;
  qualityScores?: Array<number | string> | null;
  statusTab?: string | null;
};

function normalizeZipSlugKey(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Sort option → ZIP slug, e.g. views_desc → views_high_to_low. */
export function slugifyBulkZipSort(sort?: string | null): string {
  const key = normalizeZipSlugKey(sort);
  if (!key) return "unsorted";
  return BULK_ZIP_SORT_SLUGS[key] || key;
}

/** Status tab → ZIP slug, e.g. not_rejected → nonrejected. */
export function slugifyBulkZipStatusTab(tab?: string | null): string {
  const key = normalizeZipSlugKey(tab);
  if (!key) return "all";
  return BULK_ZIP_STATUS_SLUGS[key] || key;
}

/** Quality filters → Q1_Q2_Q3, or all_quality when none are selected. */
export function formatBulkZipQualityPart(
  qualityScores?: Array<number | string> | null,
): string {
  if (!qualityScores || qualityScores.length === 0) return "all_quality";
  const parts: string[] = [];
  const normalized = qualityScores.map((value) =>
    String(value).trim().toLowerCase(),
  );
  for (const score of [1, 2, 3] as const) {
    if (
      normalized.some(
        (value) =>
          value === String(score) ||
          value === `q${score}` ||
          Number(value) === score,
      )
    ) {
      parts.push(`Q${score}`);
    }
  }
  if (normalized.some((value) => value === "unscored")) {
    parts.push("unscored");
  }
  return parts.length > 0 ? parts.join("_") : "all_quality";
}

const BULK_ZIP_SORT_LABELS: Record<string, string> = {
  views_high_to_low: "Views (high to low)",
  views_low_to_high: "Views (low to high)",
  submitted_newest_first: "Newest first",
  submitted_oldest_first: "Oldest first",
  submissions_high_to_low: "Submissions (high to low)",
  submissions_low_to_high: "Submissions (low to high)",
  points_high_to_low: "Points (high to low)",
  points_low_to_high: "Points (low to high)",
  impressions_high_to_low: "Impressions (high to low)",
  impressions_low_to_high: "Impressions (low to high)",
  unsorted: "Default sort",
};

const BULK_ZIP_STATUS_LABELS: Record<string, string> = {
  all: "All",
  verified: "Verified",
  rejected: "Rejected",
  pending: "Pending",
  paid: "Paid",
  nonrejected: "Not Rejected",
  verified_paid: "Verified + Paid",
};

const ZIP_SORT_SLUGS_BY_LENGTH = [
  ...new Set(["unsorted", ...Object.values(BULK_ZIP_SORT_SLUGS)]),
].sort((a, b) => b.length - a.length);

const ZIP_STATUS_SLUGS_BY_LENGTH = [
  ...new Set(Object.values(BULK_ZIP_STATUS_SLUGS)),
].sort((a, b) => b.length - a.length);

function qualityLabelFromSlug(slug: string | null): string {
  if (!slug || slug === "all_quality") return "All quality";
  return slug
    .split("_")
    .filter(Boolean)
    .map((part) =>
      part.toLowerCase() === "unscored" ? "Unscored" : part.toUpperCase(),
    )
    .join(", ");
}

function takeTrailingSlug(
  value: string,
  slugs: string[],
): { rest: string; slug: string | null } {
  const haystack = `_${value}`;
  for (const slug of slugs) {
    if (haystack.endsWith(`_${slug}`)) {
      const rest = value.slice(0, Math.max(0, value.length - slug.length - 1));
      return { rest, slug };
    }
  }
  return { rest: value, slug: null };
}

function takeTrailingQuality(value: string): {
  rest: string;
  slug: string | null;
} {
  if (value.endsWith("_all_quality") || value === "all_quality") {
    const rest =
      value === "all_quality"
        ? ""
        : value.slice(0, value.length - "_all_quality".length);
    return { rest, slug: "all_quality" };
  }
  const parts = value.split("_");
  const qualityBits: string[] = [];
  while (parts.length > 0) {
    const last = parts[parts.length - 1];
    const isQuality =
      last === "unscored" || /^Q[1-3]$/i.test(last);
    if (!isQuality) break;
    qualityBits.unshift(parts.pop() as string);
  }
  if (qualityBits.length === 0) return { rest: value, slug: null };
  return { rest: parts.join("_"), slug: qualityBits.join("_") };
}

export type ParsedBulkZipFilenamePrefix = {
  sortSlug: string | null;
  sortLabel: string;
  qualitySlug: string | null;
  qualityLabel: string;
  statusSlug: string | null;
  statusLabel: string;
};

/** Read sort / quality / status from a stored ZIP prefix. */
export function parseBulkZipFilenamePrefix(
  prefix: string | null | undefined,
): ParsedBulkZipFilenamePrefix {
  const raw = String(prefix || "").replace(/\.zip$/i, "").trim();
  const stripped = raw.replace(/^bulk_submissions_/i, "");
  const status = takeTrailingSlug(stripped, ZIP_STATUS_SLUGS_BY_LENGTH);
  const quality = takeTrailingQuality(status.rest);
  const sort = takeTrailingSlug(quality.rest, ZIP_SORT_SLUGS_BY_LENGTH);
  return {
    sortSlug: sort.slug,
    sortLabel: (sort.slug && BULK_ZIP_SORT_LABELS[sort.slug]) || "Default sort",
    qualitySlug: quality.slug,
    qualityLabel: qualityLabelFromSlug(quality.slug),
    statusSlug: status.slug,
    statusLabel:
      (status.slug && BULK_ZIP_STATUS_LABELS[status.slug]) || "All",
  };
}

/**
 * ZIP prefix: contest + sort + quality + status tab.
 * Caller appends `_part_N_of_M` when splitting into multiple archives.
 */
export function buildBulkZipFilenamePrefix(
  context: BulkZipNameContext,
): string {
  const contest =
    (sanitizeFilename(context.contestTitle || "contest") || "contest")
      .slice(0, BULK_ZIP_CONTEST_SLUG_MAX)
      .replace(/_+$/g, "") || "contest";
  const sort = slugifyBulkZipSort(context.sort);
  const quality = formatBulkZipQualityPart(context.qualityScores);
  const tab = slugifyBulkZipStatusTab(context.statusTab);
  return `bulk_submissions_${contest}_${sort}_${quality}_${tab}`;
}

/** ZIP download name: bulk_submissions_{contest}.zip */
export function toBulkZipDownloadFilename(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  const withoutExt = value.replace(/\.zip$/i, "");
  const cleaned =
    withoutExt
      .replace(/[^a-z0-9]/gi, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, BULK_ZIP_FILENAME_MAX) || "bulk_submissions_contest";
  return `${cleaned}.zip`;
}

export function bulkZipFilenameFromContestTitle(
  contestTitle?: string | null,
): string {
  return toBulkZipDownloadFilename(
    buildBulkZipFilenamePrefix({ contestTitle }),
  );
}
