import ytdl from "@distube/ytdl-core";
import { YtDlp } from "ytdlp-nodejs";
import { readFile, rm } from "fs/promises";
import { existsSync, copyFileSync, chmodSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { Readable } from "stream";
import { extractYoutubeId } from "@/lib/youtube-url";

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

function getYtDlpInstance(): YtDlp {
  if (process.platform === "linux") {
    const srcBin = join(process.cwd(), "bin", "yt-dlp");
    const tmpBin = join(tmpdir(), "yt-dlp");

    if (existsSync(srcBin)) {
      try {
        if (!existsSync(tmpBin)) {
          copyFileSync(srcBin, tmpBin);
        }
        chmodSync(tmpBin, 0o755);
        return new YtDlp({ binaryPath: tmpBin });
      } catch (err) {
        console.warn(
          "[YouTube Download] Failed to copy/chmod /tmp/yt-dlp binary:",
          err
        );
      }
    }
  }

  return new YtDlp();
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function toWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function resolveVideoId(urlOrId: string): string | null {
  const fromUrl = extractYoutubeId(urlOrId);
  if (fromUrl && ytdl.validateID(fromUrl)) return fromUrl;
  if (ytdl.validateID(urlOrId)) return urlOrId;
  return null;
}

async function downloadWithYtDlp(watchUrl: string): Promise<Buffer> {
  const ytdlp = getYtDlpInstance();
  const tmpFile = join(
    tmpdir(),
    `yt-dl-${Date.now()}-${randomUUID().substring(0, 6)}.mp4`
  );

  try {
    await ytdlp.execAsync(watchUrl, {
      output: tmpFile,
      format: "b[ext=mp4]/best[ext=mp4]/best",
      additionalOptions: [
        "--extractor-args",
        "youtube:player_client=android,ios",
        "--no-warnings",
      ],
    });

    if (!existsSync(tmpFile)) {
      throw new Error("yt-dlp output file was not created.");
    }

    const buffer = await readFile(tmpFile);
    if (!buffer.length) {
      throw new Error("yt-dlp returned an empty file (0 bytes).");
    }

    return buffer;
  } finally {
    if (existsSync(tmpFile)) {
      await rm(tmpFile, { force: true }).catch(() => {});
    }
  }
}

async function downloadWithYtdlCore(watchUrl: string): Promise<Buffer> {
  const info = await ytdl.getInfo(watchUrl);

  if (info.videoDetails.isPrivate) {
    throw new YouTubeDownloadError(
      "Can't download private YouTube content.",
      "Private video",
      ["Verify the video is public and the URL is correct"]
    );
  }

  if (info.videoDetails.isLiveContent) {
    throw new YouTubeDownloadError(
      "Can't download live YouTube content.",
      "Live content",
      ["Wait until the livestream ends, then try again"]
    );
  }

  const progressive = ytdl.filterFormats(info.formats, "audioandvideo");
  if (progressive.length === 0) {
    throw new YouTubeDownloadError(
      "No downloadable video+audio format is available for this video.",
      "No progressive format",
      [
        "The video may be restricted or only available as separate streams",
        "Try again later or verify the video plays in a browser",
      ]
    );
  }

  let format = progressive[0];
  try {
    format = ytdl.chooseFormat(progressive, { quality: "highest" });
  } catch {
    // keep first progressive format
  }

  const stream = ytdl.downloadFromInfo(info, { format });
  const buffer = await streamToBuffer(stream);

  if (!buffer.length) {
    throw new YouTubeDownloadError(
      "YouTube returned an empty video file.",
      "Downloaded file is empty (0 bytes)",
      [
        "Verify the video is public and plays in a browser",
        "Try again in a few minutes",
      ]
    );
  }

  return buffer;
}

/**
 * Download a YouTube video as an MP4 buffer.
 * Tries yt-dlp first (more robust against YouTube player JS changes),
 * then falls back to @distube/ytdl-core.
 */
export async function downloadYouTubeVideoBuffer(
  urlOrId: string
): Promise<Buffer> {
  const videoId = resolveVideoId(urlOrId);
  if (!videoId) {
    throw new YouTubeDownloadError(
      "Invalid YouTube URL or video ID.",
      "Invalid videoId",
      ["Provide a valid youtube.com or youtu.be link"]
    );
  }

  const watchUrl = toWatchUrl(videoId);

  // 1. Try yt-dlp first
  try {
    const buffer = await downloadWithYtDlp(watchUrl);
    return buffer;
  } catch (ytDlpError: any) {
    console.warn(
      "[YouTube Download] yt-dlp download failed, attempting ytdl-core fallback:",
      ytDlpError?.message || ytDlpError
    );
  }

  // 2. Fallback to @distube/ytdl-core
  try {
    return await downloadWithYtdlCore(watchUrl);
  } catch (ytdlError: any) {
    if (ytdlError instanceof YouTubeDownloadError) {
      throw ytdlError;
    }
    const message = ytdlError?.message || String(ytdlError);
    throw mapYtdlError(message);
  }
}

export async function getYouTubeVideoTitle(
  urlOrId: string
): Promise<string | null> {
  const videoId = resolveVideoId(urlOrId);
  if (!videoId) return null;

  const watchUrl = toWatchUrl(videoId);

  // Try yt-dlp first
  try {
    const ytdlp = getYtDlpInstance();
    const info = await ytdlp.getInfoAsync(watchUrl, {
      additionalOptions: [
        "--extractor-args",
        "youtube:player_client=android,ios",
        "--no-warnings",
      ],
    });
    if (info?.title && info.title.trim()) return info.title.trim();
  } catch {
    // ignore yt-dlp error, try fallback
  }

  // Fallback to @distube/ytdl-core
  try {
    const info = await ytdl.getBasicInfo(watchUrl);
    return info.videoDetails?.title || null;
  } catch {
    return null;
  }
}

function mapYtdlError(message: string): YouTubeDownloadError {
  const lower = message.toLowerCase();

  if (
    lower.includes("private video") ||
    lower.includes("video unavailable") ||
    lower.includes("members-only")
  ) {
    return new YouTubeDownloadError(
      "This YouTube video is private, members-only, or unavailable.",
      message,
      [
        "Verify the YouTube video URL is correct and public",
        "Check if the video was removed or marked private",
      ]
    );
  }

  if (lower.includes("age") || lower.includes("sign in to confirm your age")) {
    return new YouTubeDownloadError(
      "This YouTube video is age-restricted and cannot be downloaded.",
      message,
      ["Try a different public video that is not age-restricted"]
    );
  }

  if (
    lower.includes("sign in to confirm") ||
    lower.includes("bot") ||
    lower.includes("confirm you're not a bot")
  ) {
    return new YouTubeDownloadError(
      "YouTube is blocking this download request.",
      message,
      ["Try again in a few minutes", "Verify the video plays in a browser"]
    );
  }

  return new YouTubeDownloadError(
    "Failed to download YouTube video.",
    message,
    ["Verify the video link in your browser", "Try again in a few minutes"]
  );
}

