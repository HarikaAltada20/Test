import { extractYoutubeId } from "@/lib/youtube-url";
import { extractTikTokVideoIdFromLink } from "@/lib/tiktok/extract-video-id";

export type EmbeddablePlatform = "youtube" | "instagram" | "tiktok";

export type ContentEmbedInfo = {
  platform: EmbeddablePlatform | null;
  embedUrl: string | null;
};

export type ContentEmbedOptions = {
  /** submissions.platform — used so numeric video_id is not mistaken for TikTok */
  platform?: string | null;
  /** TikTok-only: stored video_id when content_link is a short/unparseable URL */
  videoId?: string | null;
};

function normalizePlatform(platform?: string | null): string {
  return (platform || "").toLowerCase();
}

function isInstagramPlatform(platform?: string | null): boolean {
  return normalizePlatform(platform).includes("instagram");
}

function isTiktokPlatform(platform?: string | null): boolean {
  return normalizePlatform(platform).includes("tiktok");
}

function isInstagramLink(contentLink: string): boolean {
  return contentLink.toLowerCase().includes("instagram.com");
}

function isTiktokLink(contentLink: string): boolean {
  return contentLink.toLowerCase().includes("tiktok.com");
}

export function buildInstagramEmbedUrl(
  shortcode: string,
  pathKind: "reel" | "p" | "tv",
): string {
  const path =
    pathKind === "reel" ? "reel" : pathKind === "tv" ? "tv" : "p";
  return `https://www.instagram.com/${path}/${shortcode}/embed/`;
}

/** Official TikTok iframe player — https://developers.tiktok.com/doc/embed-player */
export function buildTikTokPlayerEmbedUrl(
  videoId: string,
  options?: { autoplay?: boolean },
): string {
  const params = new URLSearchParams({
    controls: "1",
    rel: "0",
    autoplay: options?.autoplay ? "1" : "0",
    music_info: "0",
    description: "0",
  });
  return `https://www.tiktok.com/player/v1/${encodeURIComponent(videoId)}?${params.toString()}`;
}

/** Add autoplay params when the user explicitly starts playback (click). */
export function withEmbedAutoplay(
  embedUrl: string,
  platform: string | null | undefined,
): string {
  try {
    const url = new URL(embedUrl);
    const p = (platform || "").toLowerCase();

    if (p === "youtube" || url.hostname.includes("youtube.com")) {
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("playsinline", "1");
    }
    if (p === "tiktok" || url.hostname.includes("tiktok.com")) {
      url.searchParams.set("autoplay", "1");
    }

    return url.toString();
  } catch {
    return embedUrl;
  }
}

export function resolveTikTokVideoId(
  contentLink: string | null | undefined,
  videoId?: string | null,
): string | null {
  const fromLink = extractTikTokVideoIdFromLink(contentLink);
  if (fromLink) return fromLink;

  // Instagram media IDs are numeric too — only use DB id for TikTok links/platform
  const fromDb = videoId?.trim();
  if (!fromDb || !/^\d+$/.test(fromDb)) return null;
  const link = (contentLink || "").trim();
  if (!link) return null;
  if (isInstagramLink(link)) return null;
  if (isTiktokLink(link)) return fromDb;
  return null;
}

export function extractInstagramShortcode(
  contentLink: string,
): { shortcode: string; pathKind: "reel" | "p" | "tv" } | null {
  const m = contentLink.match(
    /instagram\.com\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i,
  );
  if (!m) return null;
  const segment = m[1].toLowerCase();
  const pathKind =
    segment === "reel" || segment === "reels"
      ? "reel"
      : segment === "tv"
        ? "tv"
        : "p";
  return { shortcode: m[2], pathKind };
}

/** Build an embed URL for in-app playback (YouTube, Instagram, TikTok). */
export function getContentEmbedInfo(
  contentLink: string | null | undefined,
  options?: ContentEmbedOptions,
): ContentEmbedInfo {
  if (!contentLink || typeof contentLink !== "string") {
    return { platform: null, embedUrl: null };
  }

  const trimmed = contentLink.trim();
  const lower = trimmed.toLowerCase();
  const platform = options?.platform;

  const youtubeId = extractYoutubeId(trimmed);
  if (youtubeId && !isInstagramPlatform(platform) && !isTiktokPlatform(platform)) {
    return {
      platform: "youtube",
      embedUrl: `https://www.youtube.com/embed/${youtubeId}?rel=0&playsinline=1&modestbranding=1`,
    };
  }

  // Instagram before TikTok — numeric video_id must not be treated as TikTok
  const ig = extractInstagramShortcode(trimmed);
  if (ig || isInstagramPlatform(platform) || isInstagramLink(trimmed)) {
    if (ig) {
      return {
        platform: "instagram",
        embedUrl: buildInstagramEmbedUrl(ig.shortcode, ig.pathKind),
      };
    }
    return { platform: "instagram", embedUrl: null };
  }

  const useTiktokVideoId =
    isTiktokPlatform(platform) || isTiktokLink(trimmed);
  const tiktokId = useTiktokVideoId
    ? resolveTikTokVideoId(trimmed, options?.videoId)
    : extractTikTokVideoIdFromLink(trimmed);
  if (tiktokId || (useTiktokVideoId && lower.includes("tiktok.com"))) {
    if (tiktokId) {
      return {
        platform: "tiktok",
        embedUrl: buildTikTokPlayerEmbedUrl(tiktokId),
      };
    }
    return { platform: "tiktok", embedUrl: null };
  }

  if (youtubeId) {
    return {
      platform: "youtube",
      embedUrl: `https://www.youtube.com/embed/${youtubeId}?rel=0&playsinline=1&modestbranding=1`,
    };
  }

  return { platform: null, embedUrl: null };
}

export function canEmbedContentLink(
  contentLink: string | null | undefined,
): boolean {
  return getContentEmbedInfo(contentLink).embedUrl != null;
}
