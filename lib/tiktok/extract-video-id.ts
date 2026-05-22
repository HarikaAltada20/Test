/**
 * Extract TikTok video (item) id from common share URLs.
 */
export function extractTikTokVideoIdFromLink(
  contentLink: string | null | undefined,
): string | null {
  if (!contentLink || typeof contentLink !== "string") return null;
  const trimmed = contentLink.trim();

  try {
    const urlObj = new URL(trimmed);
    if (urlObj.hostname.includes("tiktok.com")) {
      const pathParts = urlObj.pathname.split("/");
      const videoIndex = pathParts.indexOf("video");
      if (videoIndex !== -1 && pathParts[videoIndex + 1]) {
        return pathParts[videoIndex + 1].split("?")[0];
      }
      const vIndex = pathParts.indexOf("v");
      if (vIndex !== -1 && pathParts[vIndex + 1]) {
        return pathParts[vIndex + 1].split("?")[0];
      }
    }
  } catch {
    // fall through to regex
  }

  const patterns = [/\/video\/(\d+)/, /\/v\/(\d+)/, /[?&]item_id=(\d+)/];
  for (const pattern of patterns) {
    const m = trimmed.match(pattern);
    if (m?.[1]) return m[1];
  }
  return null;
}
