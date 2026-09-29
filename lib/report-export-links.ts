import {
  extractInstagramShortcode,
  resolveTikTokVideoId,
} from "@/lib/content-embed";
import { extractTweetId } from "@/lib/twitter-utils";
import { extractYoutubeId } from "@/lib/youtube-url";

const INSTAGRAM_RESERVED = new Set([
  "reel",
  "reels",
  "p",
  "tv",
  "stories",
  "explore",
  "accounts",
  "direct",
  "about",
  "legal",
  "developer",
]);

function normalizeHttpUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/\//, "")}`;
}

function extractInstagramMediaFromUrl(contentLink: string): {
  shortcode: string;
  pathKind: "reel" | "p" | "tv";
} | null {
  const direct = extractInstagramShortcode(contentLink);
  if (direct) return direct;

  const nested = contentLink.match(
    /instagram\.com\/[^/?#]+\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i,
  );
  if (!nested?.[1] || !nested[2]) return null;

  const segment = nested[1].toLowerCase();
  const pathKind =
    segment === "reel" || segment === "reels"
      ? "reel"
      : segment === "tv"
        ? "tv"
        : "p";
  return { shortcode: nested[2], pathKind };
}

function buildInstagramMediaUrl(
  shortcode: string,
  pathKind: "reel" | "p" | "tv",
): string {
  const path =
    pathKind === "reel" ? "reel" : pathKind === "tv" ? "tv" : "p";
  return `https://www.instagram.com/${path}/${shortcode}/`;
}

function isInstagramProfileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("instagram.com")) return false;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return false;
    return !INSTAGRAM_RESERVED.has(parts[0]!.toLowerCase());
  } catch {
    return false;
  }
}

/** Canonical post/reel URL for export links — never a creator profile URL. */
export function resolveExportContentUrl(
  contentLink: string | null | undefined,
  platform?: string | null,
  videoId?: string | null,
): string | null {
  const raw = String(contentLink || "").trim();
  if (!raw) return null;

  const url = normalizeHttpUrl(raw);
  const platformLower = (platform || "").toLowerCase();

  const ig = extractInstagramMediaFromUrl(url);
  if (ig) return buildInstagramMediaUrl(ig.shortcode, ig.pathKind);

  if (/instagram\.com/i.test(url)) {
    if (isInstagramProfileUrl(url)) return null;
  }

  const tweetId = extractTweetId(url);
  if (tweetId) {
    const handleMatch = url.match(/(?:x\.com|twitter\.com)\/([^/?#]+)\/status\//i);
    const handle = handleMatch?.[1] ?? "i";
    return `https://x.com/${handle}/status/${tweetId}`;
  }

  const youtubeId = extractYoutubeId(url);
  if (youtubeId) {
    return /shorts\//i.test(url)
      ? `https://www.youtube.com/shorts/${youtubeId}`
      : `https://www.youtube.com/watch?v=${youtubeId}`;
  }

  const tiktokId = resolveTikTokVideoId(url, videoId);
  if (tiktokId) {
    const handleMatch = url.match(/tiktok\.com\/@([^/?#]+)/i);
    if (handleMatch?.[1]) {
      return `https://www.tiktok.com/@${handleMatch[1]}/video/${tiktokId}`;
    }
    return `https://www.tiktok.com/video/${tiktokId}`;
  }

  if (
    platformLower.includes("twitter") ||
    platformLower === "x" ||
    /(?:x\.com|twitter\.com)/i.test(url)
  ) {
    return /\/status\//i.test(url) ? url : null;
  }

  if (/^https?:\/\//i.test(url) && !isInstagramProfileUrl(url)) {
    return url;
  }

  return null;
}

/** Public profile URL for a creator handle on the contest platform. */
export function buildCreatorProfileUrl(
  username: string | null | undefined,
  platform?: string | null,
): string | null {
  const handle = String(username || "")
    .trim()
    .replace(/^@/, "");
  if (!handle || handle === "\u2014" || handle === "-") return null;

  const p = (platform || "").toLowerCase();
  const encoded = encodeURIComponent(handle);

  if (p.includes("instagram")) {
    return `https://www.instagram.com/${encoded}/`;
  }
  if (p.includes("tiktok")) {
    return `https://www.tiktok.com/@${encoded}`;
  }
  if (p.includes("youtube")) {
    return `https://www.youtube.com/@${encoded}`;
  }
  if (p.includes("twitter") || p === "x") {
    return `https://x.com/${encoded}`;
  }

  return null;
}

export function isPdfUrlColumn(header: string): boolean {
  const hl = header.toLowerCase().trim();
  return (
    hl === "content url" ||
    hl === "content link" ||
    hl === "url" ||
    hl === "tweet url" ||
    hl === "video url" ||
    hl === "post url"
  );
}

export function isPdfUsernameColumn(header: string): boolean {
  const hl = header.toLowerCase().trim();
  return hl === "username" || hl === "creator username";
}

export function resolvePdfCellLink(
  rowIndex: number,
  colIndex: number,
  header: string,
  displayValue: string,
  cellLinks?: (string | null)[][],
  platform?: string,
): string | null {
  const fromMatrix = cellLinks?.[rowIndex]?.[colIndex];
  if (fromMatrix) return fromMatrix;

  if (isPdfUrlColumn(header)) {
    return resolveExportContentUrl(displayValue, platform);
  }
  if (isPdfUsernameColumn(header)) {
    return buildCreatorProfileUrl(displayValue, platform);
  }
  return null;
}
