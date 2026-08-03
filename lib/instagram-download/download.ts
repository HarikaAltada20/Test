import { writeFile } from "fs/promises";
import { extractInstagramShortcode } from "@/lib/content-embed";
import { resolveInstagramVideoUrl } from "@/lib/instagram-download/graphql";

const VIDEO_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36",
  Accept: "*/*",
  Referer: "https://www.instagram.com/",
};

export class InstagramDownloadError extends Error {
  reason: string;
  suggestions: string[];

  constructor(userMessage: string, reason: string, suggestions: string[] = []) {
    super(userMessage);
    this.name = "InstagramDownloadError";
    this.reason = reason;
    this.suggestions = suggestions;
  }
}

function mapResolveError(
  error: string,
  message: string
): InstagramDownloadError {
  switch (error) {
    case "noShortcode":
      return new InstagramDownloadError(
        "Could not parse Instagram shortcode from the URL.",
        message,
        ["Verify the content link is a valid Instagram reel or post URL"]
      );
    case "notFound":
      return new InstagramDownloadError(
        "This Instagram video could not be found. It may have been deleted.",
        message,
        [
          "Verify the video URL is correct",
          "Check if the post still exists on Instagram",
        ]
      );
    case "notVideo":
      return new InstagramDownloadError(
        "This Instagram post is not a video.",
        message,
        ["Only Reels and video posts can be downloaded"]
      );
    case "tooManyRequests":
      return new InstagramDownloadError(
        "Too many requests to Instagram. Please wait a few minutes before trying again.",
        message,
        ["Wait 5-10 minutes before retrying", "Reduce download frequency"]
      );
    default:
      return new InstagramDownloadError(
        "Unable to download this Instagram video. Instagram may be blocking the request.",
        message,
        [
          "Verify the video is public and accessible",
          "Wait a few minutes and try again",
        ]
      );
  }
}

/** Resolve CDN video URL for an Instagram post/reel URL. */
export async function getInstagramVideoUrlFromLink(
  contentLink: string
): Promise<{ videoUrl: string; shortcode: string }> {
  const parsed = extractInstagramShortcode(contentLink);
  if (!parsed?.shortcode) {
    throw mapResolveError("noShortcode", "shortcode is required");
  }

  const result = await resolveInstagramVideoUrl(parsed.shortcode);
  if (!result.ok) {
    throw mapResolveError(result.error, result.message);
  }

  return { videoUrl: result.videoUrl, shortcode: result.shortcode };
}

/** Fetch Instagram video bytes via Polaris GraphQL + CDN proxy fetch. */
export async function downloadInstagramVideoBuffer(
  contentLink: string
): Promise<Buffer> {
  const { videoUrl, shortcode } = await getInstagramVideoUrlFromLink(contentLink);

  const videoResponse = await fetch(videoUrl, {
    headers: VIDEO_FETCH_HEADERS,
  });

  if (!videoResponse.ok) {
    throw new InstagramDownloadError(
      `Failed to fetch video from Instagram CDN (${videoResponse.status}).`,
      videoResponse.statusText || "CDN fetch failed",
      ["Try again in a few minutes", "Verify the post is still public"]
    );
  }

  const arrayBuffer = await videoResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new InstagramDownloadError(
      "Instagram returned an empty video file.",
      `Empty body for shortcode ${shortcode}`,
      ["The post may be restricted or the CDN URL expired"]
    );
  }

  return buffer;
}

/** Write Instagram video to a file path (for bulk ZIP downloads). */
export async function downloadInstagramVideoToFile(
  contentLink: string,
  outputPath: string
): Promise<void> {
  const buffer = await downloadInstagramVideoBuffer(contentLink);
  await writeFile(outputPath, buffer);
}