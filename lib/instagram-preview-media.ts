export type InstagramMediaPreview = {
  mediaUrl: string | null;
  thumbnailUrl: string | null;
};

export async function fetchInstagramMediaPreview(
  videoId: string,
  accessToken: string,
): Promise<InstagramMediaPreview> {
  const url = `https://graph.instagram.com/${videoId}?fields=media_type,media_url,thumbnail_url&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    return { mediaUrl: null, thumbnailUrl: null };
  }
  return {
    mediaUrl: typeof data.media_url === "string" ? data.media_url : null,
    thumbnailUrl:
      typeof data.thumbnail_url === "string" ? data.thumbnail_url : null,
  };
}

/** Public reel/post thumbnail via Meta oEmbed (app access token). */
export async function fetchInstagramOembedThumbnail(
  contentLink: string,
): Promise<string | null> {
  const appId = process.env.INSTAGRAM_CLIENT_ID;
  const appSecret = process.env.INSTAGRAM_CLIENT_SECRET;
  if (!appId || !appSecret) return null;

  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&grant_type=client_credentials`,
      { cache: "no-store" },
    );
    const tokenData = await tokenRes.json().catch(() => ({}));
    const appToken = tokenData.access_token as string | undefined;
    if (!appToken) return null;

    const oembedUrl = new URL("https://graph.facebook.com/v21.0/instagram_oembed");
    oembedUrl.searchParams.set("url", contentLink);
    oembedUrl.searchParams.set("fields", "thumbnail_url");
    oembedUrl.searchParams.set("access_token", appToken);

    const res = await fetch(oembedUrl.toString(), { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) return null;
    return typeof data.thumbnail_url === "string" ? data.thumbnail_url : null;
  } catch {
    return null;
  }
}
