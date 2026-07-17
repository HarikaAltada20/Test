/** Client-safe YouTube URL helpers (no googleapis / Node-only deps). */

/** Open as Shorts when clip length is under 3 minutes. */
export const YOUTUBE_SHORTS_MAX_DURATION_SECONDS = 3 * 60;

export function extractYoutubeId(url: string): string | null {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})(?:&\S+)?/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export function isYoutubeShortUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /youtube\.com\/shorts\//i.test(url);
}

/** Parse YouTube Data API ISO-8601 duration (e.g. PT1M30S) to seconds. */
export function parseYouTubeIso8601Duration(
  iso: string | null | undefined,
): number | null {
  if (!iso || typeof iso !== "string") return null;
  const match = iso.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.\d+)?S)?)?$/i,
  );
  if (!match) return null;
  const days = parseInt(match[1] || "0", 10);
  const hours = parseInt(match[2] || "0", 10);
  const minutes = parseInt(match[3] || "0", 10);
  const seconds = parseFloat(match[4] || "0");
  const total = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.round(total);
}

/**
 * Prefer Shorts player when duration is known and under 3 minutes;
 * prefer watch URL when duration is known and >= 3 minutes;
 * otherwise keep the submitted link.
 */
export function buildYouTubeContentViewUrl(
  contentLink: string | null | undefined,
  durationSeconds?: number | null,
): string {
  if (!contentLink) return "#";
  const videoId = extractYoutubeId(contentLink);
  if (!videoId) return contentLink;

  if (
    typeof durationSeconds === "number" &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0
  ) {
    if (durationSeconds < YOUTUBE_SHORTS_MAX_DURATION_SECONDS) {
      return `https://www.youtube.com/shorts/${videoId}`;
    }
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  return contentLink;
}

/** Format clip length for tables (e.g. 45s, 2m 15s, 1h 2m). */
export function formatClipDurationSeconds(
  seconds: number | null | undefined,
): string {
  if (
    seconds == null ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return "—";
  }
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}
