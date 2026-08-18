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
    description: "Names the file with the view count. Zero-padded so Explorer sort matches popularity.",
    example: "000000012500.mp4",
  },
  views_username: {
    label: "Views + username",
    description: "Uses the view count and creator username.",
    example: "000000012500_jane_creator.mp4",
  },
  views_username_status_quality_score: {
    label: "Views + username + status + quality",
    description: "Includes moderation status and quality score.",
    example: "000000012500_jane_creator_verified_3.mp4",
  },
};

export type VideoFilenameParts = {
  views?: number | null;
  username?: string | null;
  status?: string | null;
  qualityScore?: number | null;
  uniqueSuffix?: string | null;
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
  return isVideoFilenamePattern(value)
    ? value
    : DEFAULT_VIDEO_FILENAME_PATTERN;
}

export function formatViewCountPart(views: number | null | undefined): string {
  const n = Math.max(0, Math.floor(Number(views) || 0));
  return String(n).padStart(12, "0");
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
  const title = sanitizeFilename(contestTitle || "contest") || "contest";
  return toBulkZipDownloadFilename(`bulk_submissions_${title}`);
}
