/** YouTube video IDs for creator campaign onboarding (override via env). */
export const CREATOR_PARTICIPATION_VIDEO_ID =
  process.env.NEXT_PUBLIC_CREATOR_PARTICIPATION_VIDEO_ID?.trim() ||
  "Cvn-PKtpMYQ";

export const CREATOR_CAMPAIGN_TYPES_VIDEO_ID =
  process.env.NEXT_PUBLIC_CREATOR_CAMPAIGN_TYPES_VIDEO_ID?.trim() ||
  "KrtpC2DB9zk";

export function youtubeEmbedUrl(
  videoId: string,
  startSeconds?: number,
): string {
  const start =
    startSeconds != null && startSeconds > 0 ? `&start=${startSeconds}` : "";
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1${start}`;
}

export function formatVideoTimestamp(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
