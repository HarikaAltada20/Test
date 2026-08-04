import { extractYoutubeId } from "@/lib/youtube-url";

const YTSTREAM_HOST = "ytstream-download-youtube-videos.p.rapidapi.com";
const YTSTREAM_BASE = `https://${YTSTREAM_HOST}/dl`;

type YtStreamFormat = {
  itag?: number | string;
  url?: string;
  mimeType?: string;
  qualityLabel?: string;
  quality?: string;
  bitrate?: number | string;
  contentLength?: string | number;
  audioQuality?: string;
  height?: number;
  width?: number;
};

type YtStreamResponse = {
  status?: string | number;
  error?: string;
  message?: string;
  id?: string;
  title?: string;
  formats?: YtStreamFormat[];
  adaptiveFormats?: YtStreamFormat[];
};

export class YouTubeDownloadError extends Error {
  reason: string;
  suggestions: string[];

  constructor(userMessage: string, reason: string, suggestions: string[] = []) {
    super(userMessage);
    this.name = "YouTubeDownloadError";
    this.reason = reason;
    this.suggestions = suggestions;
  }
}

function getRapidApiKey(): string {
  const key =
    process.env.YOUTUBE_RAPIDAPI_KEY?.trim() ||
  
    "";
  if (!key) {
    throw new YouTubeDownloadError(
      "YouTube download is not configured. Missing RapidAPI key.",
      "YOUTUBE_RAPIDAPI_KEY is not set",
      [
        "Set YOUTUBE_RAPIDAPI_KEY in your environment",
        "Subscribe to YTStream on RapidAPI: https://rapidapi.com/ytjar/api/ytstream-download-youtube-videos",
      ]
    );
  }
  return key;
}

function parseQualityHeight(label?: string, height?: number): number {
  if (typeof height === "number" && height > 0) return height;
  if (!label) return 0;
  const match = label.match(/(\d{3,4})p/i);
  return match ? parseInt(match[1], 10) : 0;
}

function isMp4(mimeType?: string): boolean {
  return (mimeType || "").toLowerCase().includes("video/mp4");
}

/** Prefer highest-quality muxed MP4 from `formats`, then any muxed URL. */
export function pickBestDownloadUrl(payload: YtStreamResponse): string | null {
  const progressive = (payload.formats || []).filter((f) => f.url);
  const adaptive = (payload.adaptiveFormats || []).filter((f) => f.url);

  const score = (f: YtStreamFormat) => {
    const height = parseQualityHeight(f.qualityLabel || f.quality, f.height);
    const mp4Bonus = isMp4(f.mimeType) ? 1_000_000 : 0;
    const bitrate =
      typeof f.bitrate === "number"
        ? f.bitrate
        : parseInt(String(f.bitrate || "0"), 10) || 0;
    return mp4Bonus + height * 1000 + bitrate / 1000;
  };

  const muxedMp4 = progressive
    .filter((f) => isMp4(f.mimeType))
    .sort((a, b) => score(b) - score(a));
  if (muxedMp4[0]?.url) return muxedMp4[0].url;

  const anyProgressive = [...progressive].sort((a, b) => score(b) - score(a));
  if (anyProgressive[0]?.url) return anyProgressive[0].url;

  // Last resort: adaptive video/mp4 (may be video-only).
  const adaptiveVideo = adaptive
    .filter((f) => (f.mimeType || "").toLowerCase().startsWith("video/"))
    .sort((a, b) => score(b) - score(a));
  if (adaptiveVideo[0]?.url) return adaptiveVideo[0].url;

  return null;
}

export async function resolveYouTubeDownloadUrl(
  contentLinkOrId: string
): Promise<{ videoId: string; videoUrl: string; title?: string }> {
  const videoId =
    extractYoutubeId(contentLinkOrId) ||
    (/^[\w-]{11}$/.test(contentLinkOrId.trim()) ? contentLinkOrId.trim() : null);

  if (!videoId) {
    throw new YouTubeDownloadError(
      "Could not parse YouTube video ID from the URL.",
      "invalid_youtube_url",
      ["Verify the content link is a valid YouTube watch, shorts, or youtu.be URL"]
    );
  }

  const apiKey = getRapidApiKey();
  const cgeo = (process.env.YOUTUBE_RAPIDAPI_CGEO || "US").trim();
  const url = new URL(YTSTREAM_BASE);
  url.searchParams.set("id", videoId);
  if (cgeo) url.searchParams.set("cgeo", cgeo);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-rapidapi-host": YTSTREAM_HOST,
      "x-rapidapi-key": apiKey,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let payload: YtStreamResponse = {};
  try {
    payload = text ? (JSON.parse(text) as YtStreamResponse) : {};
  } catch {
    throw new YouTubeDownloadError(
      "YouTube download API returned an invalid response.",
      text.slice(0, 200) || `HTTP ${response.status}`,
      ["Try again in a few minutes"]
    );
  }

  if (!response.ok) {
    const message =
      payload.message || payload.error || `HTTP ${response.status}`;
    if (response.status === 403 && /not subscribed/i.test(message)) {
      throw new YouTubeDownloadError(
        "YouTube RapidAPI key is not subscribed to YTStream.",
        message,
        [
          "Open https://rapidapi.com/ytjar/api/ytstream-download-youtube-videos and subscribe (Basic/Pro)",
          "Confirm YOUTUBE_RAPIDAPI_KEY matches the subscribed RapidAPI app",
        ]
      );
    }
    if (response.status === 429) {
      throw new YouTubeDownloadError(
        "Too many YouTube download requests. Please wait and try again.",
        message,
        ["Wait a few minutes before retrying"]
      );
    }
    throw new YouTubeDownloadError(
      "Failed to resolve YouTube video download URL.",
      message,
      ["Verify the video is public", "Check RapidAPI key and subscription"]
    );
  }

  if (payload.error || payload.status === "error") {
    throw new YouTubeDownloadError(
      "This YouTube video could not be downloaded.",
      String(payload.error || payload.message || "API error"),
      [
        "Verify the YouTube video URL is correct and public",
        "Age-restricted or private videos may fail",
      ]
    );
  }

  const videoUrl = pickBestDownloadUrl(payload);
  if (!videoUrl) {
    throw new YouTubeDownloadError(
      "No downloadable YouTube stream URL was returned.",
      "missing_formats",
      [
        "The video may be region-locked, private, or live-only",
        "Try again later",
      ]
    );
  }

  return { videoId, videoUrl, title: payload.title };
}

/** Resolve via YTStream RapidAPI, then fetch MP4 bytes. */
export async function downloadYouTubeVideoBuffer(
  contentLink: string
): Promise<Buffer> {
  const { videoId, videoUrl } = await resolveYouTubeDownloadUrl(contentLink);

  const videoResponse = await fetch(videoUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
      Referer: "https://www.youtube.com/",
    },
  });

  if (!videoResponse.ok) {
    throw new YouTubeDownloadError(
      `Failed to fetch YouTube video bytes (${videoResponse.status}).`,
      videoResponse.statusText || "CDN fetch failed",
      [
        "Stream URLs expire quickly — try downloading again",
        "Verify the video is still public",
      ]
    );
  }

  const buffer = Buffer.from(await videoResponse.arrayBuffer());
  if (buffer.length === 0) {
    throw new YouTubeDownloadError(
      "YouTube returned an empty video file.",
      `Empty body for video ${videoId}`,
      ["Try again in a few minutes"]
    );
  }

  return buffer;
}
