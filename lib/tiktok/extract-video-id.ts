/**
 * Extract TikTok video (item) id from common share URLs.
 */
export function extractTikTokVideoIdFromLink(contentLink: string | null | undefined): string | null {
  if (!contentLink || typeof contentLink !== "string") return null;
  const trimmed = contentLink.trim();
  // Standard: https://www.tiktok.com/@user/video/1234567890
  let m = trimmed.match(/\/video\/(\d+)/);
  if (m) return m[1];
  // vm.tiktok.com/ZMxxxx/ or t.tiktok.com — often still contain /video/ in expanded URL; if not, skip
  m = trimmed.match(/[?&]item_id=(\d+)/);
  if (m) return m[1];
  return null;
}
