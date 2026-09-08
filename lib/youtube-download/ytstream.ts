import { createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { extractYoutubeId } from "@/lib/youtube-url";

const YTSTREAM_HOST = "ytstream-download-youtube-videos.p.rapidapi.com";
const YTSTREAM_BASE = `https://${YTSTREAM_HOST}/dl`;

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ANDROID_UA =
  "com.google.android.youtube/19.50.37 (Linux; U; Android 14) gzip";
const IOS_UA =
  "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)";
const TV_UA = "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version";

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
  const key = process.env.YOUTUBE_RAPIDAPI_KEY?.trim() || "";
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

function scoreFormat(f: YtStreamFormat): number {
  const height = parseQualityHeight(f.qualityLabel || f.quality, f.height);
  const mp4Bonus = isMp4(f.mimeType) ? 1_000_000 : 0;
  const bitrate =
    typeof f.bitrate === "number"
      ? f.bitrate
      : parseInt(String(f.bitrate || "0"), 10) || 0;
  return mp4Bonus + height * 1000 + bitrate / 1000;
}

export function isGoogleVideoUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes("googlevideo.com");
  } catch {
    return /googlevideo\.com/i.test(url);
  }
}

/**
 * Match the InnerTube client encoded in the stream URL (`c=`). A Chrome UA
 * against ANDROID/IOS/TV playback URLs is a common cause of CDN 403s.
 */
export function userAgentForStreamUrl(videoUrl: string): string {
  try {
    const client = new URL(videoUrl).searchParams.get("c")?.toUpperCase() || "";
    if (client.includes("ANDROID")) return ANDROID_UA;
    if (client.includes("IOS")) return IOS_UA;
    if (client.includes("TV")) return TV_UA;
  } catch {
    // ignore malformed URLs
  }
  return CHROME_UA;
}

/**
 * YTStream `cgeo` requests direct (IP-bound) googlevideo links for that region.
 * Server-side fetches from a different IP then 403. Omit cgeo unless explicitly
 * configured so RapidAPI can return proxied links.
 */
export function resolveCgeoParam(
  envValue: string | undefined = process.env.YOUTUBE_RAPIDAPI_CGEO,
  omitCgeo = false
): string | null {
  if (omitCgeo) return null;
  const cgeo = envValue?.trim() || "";
  return cgeo || null;
}

/**
 * Ranked muxed (audio+video) URLs. Proxy/non-googlevideo links are listed
 * after same-quality googlevideo URLs so we still try the highest-quality
 * direct link first, then fall back if YouTube rejects it with 403.
 */
export function pickDownloadCandidates(payload: YtStreamResponse): string[] {
  const progressive = (payload.formats || []).filter((f) => f.url);
  const muxedMp4 = progressive
    .filter((f) => isMp4(f.mimeType))
    .sort((a, b) => scoreFormat(b) - scoreFormat(a));
  const anyProgressive = [...progressive].sort(
    (a, b) => scoreFormat(b) - scoreFormat(a)
  );

  const ranked = muxedMp4.length > 0 ? [...muxedMp4, ...anyProgressive] : anyProgressive;
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const format of ranked) {
    const url = format.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  // After quality ranking, pull any non-googlevideo (proxied) URL forward as
  // a fallback immediately after the best direct URL — not instead of it.
  if (urls.length < 2) return urls;
  const proxyIndex = urls.findIndex((url) => !isGoogleVideoUrl(url));
  if (proxyIndex <= 1) return urls;
  const [proxyUrl] = urls.splice(proxyIndex, 1);
  urls.splice(1, 0, proxyUrl);
  return urls;
}

/**
 * Prefer highest-quality muxed (audio+video) MP4 from `formats`, then any
 * progressive muxed URL. Never fall back to adaptiveFormats — those are
 * typically video-only or audio-only and would produce silent/incomplete files.
 */
export function pickBestDownloadUrl(payload: YtStreamResponse): string | null {
  return pickDownloadCandidates(payload)[0] || null;
}

function parseYtStreamPayload(
  text: string,
  status: number
): YtStreamResponse {
  try {
    return text ? (JSON.parse(text) as YtStreamResponse) : {};
  } catch {
    throw new YouTubeDownloadError(
      "YouTube download API returned an invalid response.",
      text.slice(0, 200) || `HTTP ${status}`,
      ["Try again in a few minutes"]
    );
  }
}

function throwIfYtStreamFailed(
  response: { ok: boolean; status: number },
  payload: YtStreamResponse
): void {
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
}

function parseVideoId(contentLinkOrId: string): string {
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
  return videoId;
}

async function fetchYtStreamPayload(
  videoId: string,
  omitCgeo = false
): Promise<YtStreamResponse> {
  const apiKey = getRapidApiKey();
  const cgeo = resolveCgeoParam(process.env.YOUTUBE_RAPIDAPI_CGEO, omitCgeo);
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
  const payload = parseYtStreamPayload(text, response.status);
  throwIfYtStreamFailed(response, payload);
  return payload;
}

export async function resolveYouTubeDownloadUrl(
  contentLinkOrId: string,
  options?: { omitCgeo?: boolean }
): Promise<{ videoId: string; videoUrl: string; title?: string; videoUrls: string[] }> {
  const videoId = parseVideoId(contentLinkOrId);
  const payload = await fetchYtStreamPayload(videoId, options?.omitCgeo === true);
  const videoUrls = pickDownloadCandidates(payload);
  if (videoUrls.length === 0) {
    throw new YouTubeDownloadError(
      "No downloadable YouTube stream with audio was returned.",
      "missing_formats",
      [
        "The video may be region-locked, private, or live-only",
        "Only muxed audio+video streams are supported (adaptive-only is not)",
        "Try again later",
      ]
    );
  }

  return { videoId, videoUrl: videoUrls[0], title: payload.title, videoUrls };
}

function streamHost(videoUrl: string): string {
  try {
    return new URL(videoUrl).hostname;
  } catch {
    return "unknown-host";
  }
}

async function fetchVideoBytes(videoUrl: string): Promise<Response> {
  const headers: Record<string, string> = {
    "User-Agent": userAgentForStreamUrl(videoUrl),
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "identity",
  };

  if (isGoogleVideoUrl(videoUrl)) {
    headers.Origin = "https://www.youtube.com";
    headers.Referer = "https://www.youtube.com/";
    headers.Range = "bytes=0-";
  } else if (/rapidapi\.com|ytjar/i.test(videoUrl)) {
    headers["x-rapidapi-host"] = YTSTREAM_HOST;
    headers["x-rapidapi-key"] = getRapidApiKey();
  }

  return fetch(videoUrl, { headers, redirect: "follow" });
}

async function tryFetchCandidates(
  videoUrls: string[],
  videoId: string
): Promise<{
  ok: true;
  stream: ReadableStream<Uint8Array>;
  contentLength: string | null;
} | { ok: false; lastStatus: number }> {
  let lastStatus = 0;
  for (const videoUrl of videoUrls) {
    const videoResponse = await fetchVideoBytes(videoUrl);
    lastStatus = videoResponse.status;
    if (videoResponse.ok && videoResponse.body) {
      return {
        ok: true,
        stream: videoResponse.body,
        contentLength:
          videoResponse.headers.get("content-length") ||
          videoResponse.headers.get("content-range")?.split("/")[1] ||
          null,
      };
    }

    console.warn(
      `[YTStream] CDN fetch ${videoResponse.status} for ${videoId} host=${streamHost(videoUrl)}`
    );

    if (videoResponse.body) {
      try {
        await videoResponse.body.cancel();
      } catch {
        // ignore
      }
    }
  }

  return { ok: false, lastStatus };
}

/** Resolve via YTStream RapidAPI, then fetch MP4 ReadableStream. */
export async function getYouTubeVideoStream(
  contentLink: string
): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentLength: string | null;
  videoId: string;
  title?: string;
}> {
  const videoId = parseVideoId(contentLink);
  let title: string | undefined;
  let lastStatus = 0;

  try {
    const first = await resolveYouTubeDownloadUrl(contentLink);
    title = first.title;
    const seen = new Set(first.videoUrls);
    let fetched = await tryFetchCandidates(first.videoUrls, first.videoId);

    // Direct googlevideo URLs are bound to RapidAPI's extractor IP. Omitting
    // cgeo asks YTStream for proxied links that work from our server.
    if (!fetched.ok && resolveCgeoParam()) {
      try {
        const proxied = await resolveYouTubeDownloadUrl(contentLink, {
          omitCgeo: true,
        });
        const extra = proxied.videoUrls.filter((url) => !seen.has(url));
        if (extra.length > 0) {
          fetched = await tryFetchCandidates(extra, first.videoId);
        }
      } catch (error) {
        console.warn("[YTStream] Proxied-link retry failed:", error);
      }
    }

    if (fetched.ok) {
      return {
        stream: fetched.stream,
        contentLength: fetched.contentLength,
        videoId: first.videoId,
        title: first.title,
      };
    }
    lastStatus = fetched.lastStatus;
  } catch (error) {
    if (error instanceof YouTubeDownloadError && error.reason === "invalid_youtube_url") {
      throw error;
    }
    console.warn("[YTStream] RapidAPI resolve/fetch failed:", error);
  }

  // Same-IP extract+download. RapidAPI googlevideo URLs 403 from a different host.
  try {
    console.warn(
      `[YTStream] Trying InnerTube ANDROID fallback for ${videoId} (cdn=${lastStatus || "n/a"})`
    );
    const innertube = await import("./innertube");
    const fallback = await innertube.getYouTubeVideoStreamViaInnertube(videoId);
    return {
      stream: fallback.stream,
      contentLength: fallback.contentLength,
      videoId,
      title,
    };
  } catch (error) {
    console.warn("[YTStream] InnerTube fallback failed:", error);
  }

  const status = lastStatus || 403;
  throw new YouTubeDownloadError(
    `Failed to fetch YouTube video bytes (${status}).`,
    "CDN fetch failed",
    [
      "YouTube stream URLs are IP-bound; RapidAPI proxied links may be required",
      "Unset YOUTUBE_RAPIDAPI_CGEO so YTStream can return proxied download URLs",
      "Verify the video is still public and try again",
    ]
  );
}

/** Fetch YouTube video bytes via stream into a Buffer (for backwards compatibility). */
export async function downloadYouTubeVideoBuffer(
  contentLink: string
): Promise<Buffer> {
  const { stream, videoId } = await getYouTubeVideoStream(contentLink);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) {
    throw new YouTubeDownloadError(
      "YouTube returned an empty video file.",
      `Empty body for video ${videoId}`,
      ["Try again in a few minutes"]
    );
  }

  return buffer;
}

/** Write YouTube video stream directly to a file path (for bulk ZIP downloads). */
export async function downloadYouTubeVideoToFile(
  contentLink: string,
  outputPath: string
): Promise<void> {
  const { stream } = await getYouTubeVideoStream(contentLink);
  const writeStream = createWriteStream(outputPath);
  await pipeline(Readable.fromWeb(stream as any), writeStream);
}
