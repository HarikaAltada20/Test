import { getContentEmbedInfo } from "@/lib/content-embed";
import { extractYoutubeId } from "@/lib/youtube-url";

export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** Stored submission thumbnails — HTTPS only (user-controlled DB values). */
export function isValidHttpsImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    return new URL(url.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

/** Best-effort thumbnail URL for instant preview (no API). */
export function getSubmissionThumbnailUrl(
  contentLink: string | null | undefined,
  videoThumbnailUrl?: string | null,
): string | null {
  const stored = videoThumbnailUrl?.trim();
  if (stored && isValidImageUrl(stored)) return stored;

  const youtubeId = extractYoutubeId(contentLink || "");
  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  }

  return null;
}

export function submissionPlatformIncludes(
  platform: string | null | undefined,
  needle: string,
): boolean {
  return (platform || "").toLowerCase().includes(needle);
}

/** Whether a background API call may upgrade playback/thumbnails (Instagram, TikTok). */
export function shouldFetchContentPreviewApi(
  platform: string | null | undefined,
  contentLink: string | null | undefined,
): boolean {
  const embedPlatform = getContentEmbedInfo(contentLink, { platform }).platform;
  if (
    submissionPlatformIncludes(platform, "instagram") ||
    embedPlatform === "instagram" ||
    submissionPlatformIncludes(platform, "tiktok") ||
    embedPlatform === "tiktok"
  ) {
    return true;
  }
  return false;
}
