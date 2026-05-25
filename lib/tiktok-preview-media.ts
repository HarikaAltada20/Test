import { TikTokApiClient } from "@/lib/tiktok/api/TikTokApiClient";

export type TikTokMediaPreview = {
  thumbnailUrl: string | null;
};

export async function fetchTikTokMediaPreview(
  videoId: string,
  accessToken: string,
): Promise<TikTokMediaPreview> {
  try {
    const apiClient = new TikTokApiClient();
    const response = await apiClient.queryVideos(accessToken, [videoId]);
    const video = response?.data?.videos?.[0];
    return {
      thumbnailUrl:
        typeof video?.cover_image_url === "string"
          ? video.cover_image_url
          : null,
    };
  } catch {
    return { thumbnailUrl: null };
  }
}

/** Public video thumbnail via TikTok oEmbed (no creator token). */
export async function fetchTikTokOembedThumbnail(
  contentLink: string,
): Promise<string | null> {
  const oembedUrl = new URL("https://www.tiktok.com/oembed");
  oembedUrl.searchParams.set("url", contentLink.trim());

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(oembedUrl.toString(), { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        if (res.status === 400 && attempt < 2) continue;
        return null;
      }
      return typeof data.thumbnail_url === "string" ? data.thumbnail_url : null;
    } catch {
      if (attempt === 2) return null;
    }
  }
  return null;
}
