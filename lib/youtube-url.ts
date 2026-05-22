/** Client-safe YouTube URL helpers (no googleapis / Node-only deps). */

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
