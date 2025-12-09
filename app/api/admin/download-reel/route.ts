import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createClient } from "@/utils/supabase/server";
import { YtDlp } from "ytdlp-nodejs";
import { readFile, unlink, stat, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { existsSync } from "fs";

// Serverless-compatible temp directory
function getTempDir(): string {
  // In serverless (Vercel), use /tmp explicitly
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "/tmp";
  }
  return tmpdir();
}

// ⭐ ADDED: Instagram reliability info
function getInstagramStatusMessage() {
  return {
    info: "Instagram videos are unreliable due to strict scraping protection.",
    tips: [
      "Use cookies from a logged-in browser.",
      "Download only public reels.",
      "Avoid sending too many requests (rate limiting).",
      "Private/close-friends/region-locked posts will always fail.",
    ],
    cannotBypass: [
      "Private accounts",
      "Close friends stories",
      "Region-locked while logged out",
      "Deleted or expired posts",
      "New platform protections until yt-dlp is updated",
    ],
  };
}

// ⭐ ADDED: Parse Instagram error messages to provide user-friendly feedback
function parseInstagramError(errorMessage: string): {
  userMessage: string;
  reason: string;
  suggestions: string[];
} {
  const errorLower = errorMessage.toLowerCase();
  const originalError = errorMessage;

  // Empty media response - video not accessible
  if (
    errorLower.includes("empty media response") ||
    errorLower.includes("instagram sent an empty media response")
  ) {
    return {
      userMessage:
        "This Instagram video is not accessible. The post may be private, deleted, or restricted.",
      reason: "Instagram returned empty media response",
      suggestions: [
        "Check if the video is accessible in your browser while logged in",
        "The post might be from a private account",
        "The video may have been deleted or removed",
        "Try updating your cookies.txt with fresh session cookies",
      ],
    };
  }

  // API access denied
  if (
    errorLower.includes("instagram api is not granting access") ||
    errorLower.includes("api is not granting access")
  ) {
    return {
      userMessage:
        "Instagram is blocking access to this video. Authentication may have failed.",
      reason: "Instagram API access denied",
      suggestions: [
        "Update your cookies.txt file with fresh cookies",
        "Make sure you're logged into Instagram in your browser",
        "The video might require special permissions",
      ],
    };
  }

  // Rate limiting
  if (
    errorLower.includes("rate limit") ||
    errorLower.includes("too many requests") ||
    errorLower.includes("429")
  ) {
    return {
      userMessage:
        "Too many requests to Instagram. Please wait a few minutes before trying again.",
      reason: "Rate limit exceeded",
      suggestions: [
        "Wait 5-10 minutes before retrying",
        "Reduce the frequency of download requests",
      ],
    };
  }

  // Video not found
  if (
    errorLower.includes("not found") ||
    errorLower.includes("does not exist") ||
    errorLower.includes("404")
  ) {
    return {
      userMessage:
        "This Instagram video could not be found. It may have been deleted.",
      reason: "Video not found",
      suggestions: [
        "Verify the video URL is correct",
        "Check if the post still exists on Instagram",
        "The video may have been removed by the creator",
      ],
    };
  }

  // Private/restricted content
  if (
    errorLower.includes("private") ||
    errorLower.includes("restricted") ||
    errorLower.includes("not accessible")
  ) {
    return {
      userMessage:
        "This Instagram video is private or restricted. It cannot be downloaded.",
      reason: "Private or restricted content",
      suggestions: [
        "Only public videos can be downloaded",
        "The account may be private",
        "The post may be restricted to close friends",
      ],
    };
  }

  // Cookie/authentication issues
  if (
    errorLower.includes("cookies") ||
    errorLower.includes("authentication") ||
    errorLower.includes("login required")
  ) {
    return {
      userMessage:
        "Authentication failed. Your cookies may be expired or invalid.",
      reason: "Authentication error",
      suggestions: [
        "Update your cookies.txt file with fresh cookies",
        "Export new cookies from your browser while logged into Instagram",
        "Check if your Instagram session is still active",
      ],
    };
  }

  // Generic error
  return {
    userMessage:
      "Unable to download this Instagram video. The video may not be accessible or Instagram may be blocking the request.",
    reason: originalError,
    suggestions: [
      "Verify the video URL is correct and accessible",
      "Check if the post is public and not deleted",
      "Try updating your cookies.txt file",
      "Wait a few minutes and try again",
    ],
  };
}

// ⭐ ADDED: Cookie validation and status checking
interface CookieStatus {
  exists: boolean;
  path: string | null;
  valid: boolean;
  expired: boolean;
  hasSessionId: boolean;
  hasCsrfToken: boolean;
  expiresSoon: boolean;
  lastModified: Date | null;
  error?: string;
}

async function checkCookieStatus(): Promise<CookieStatus> {
  const cookiePath = getCookiesPath() || "cookies.txt";
  const status: CookieStatus = {
    exists: false,
    path: null,
    valid: false,
    expired: false,
    hasSessionId: false,
    hasCsrfToken: false,
    expiresSoon: false,
    lastModified: null,
  };

  try {
    if (!existsSync(cookiePath)) {
      status.error = "Cookies file not found";
      return status;
    }

    status.exists = true;
    status.path = cookiePath;

    // Check file modification time
    try {
      const stats = await stat(cookiePath);
      status.lastModified = stats.mtime;
    } catch (e) {
      status.error = "Could not read file stats";
      return status;
    }

    // Read and validate cookie content
    const cookieContent = await readFile(cookiePath, "utf-8");
    const lines = cookieContent
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"));

    if (lines.length === 0) {
      status.error = "Cookies file is empty";
      return status;
    }

    const now = Math.floor(Date.now() / 1000);
    let hasValidCookie = false;
    let earliestExpiry = Infinity;

    for (const line of lines) {
      const parts = line.split("\t");
      if (parts.length < 7) continue;

      const domain = parts[0];
      const expiryStr = parts[4];
      const name = parts[5];
      const value = parts[6];

      // Check if it's an Instagram cookie
      if (domain.includes("instagram.com")) {
        hasValidCookie = true;

        // Check for important cookies
        if (name === "sessionid" && value && value.length > 10) {
          status.hasSessionId = true;
        }
        if (name === "csrftoken" && value && value.length > 5) {
          status.hasCsrfToken = true;
        }

        // Check expiration
        const expiry = parseInt(expiryStr, 10);
        if (!isNaN(expiry) && expiry > 0) {
          if (expiry < earliestExpiry) {
            earliestExpiry = expiry;
          }
          if (expiry < now) {
            status.expired = true;
          }
        }
      }
    }

    status.valid = hasValidCookie && status.hasSessionId && status.hasCsrfToken;

    // Check if cookies expire soon (within 7 days)
    if (earliestExpiry !== Infinity) {
      const daysUntilExpiry = (earliestExpiry - now) / (24 * 60 * 60);
      status.expiresSoon = daysUntilExpiry > 0 && daysUntilExpiry < 7;
    }

    if (!hasValidCookie) {
      status.error = "No Instagram cookies found in file";
    } else if (!status.hasSessionId) {
      status.error = "Missing sessionid cookie (most important)";
    } else if (!status.hasCsrfToken) {
      status.error = "Missing csrftoken cookie";
    }
  } catch (error: any) {
    status.error = `Error reading cookies: ${error.message}`;
  }

  return status;
}

// ⭐ ADDED: Auto-load cookies if available
// Check both project root and /tmp for cookies.txt (serverless environments)
function getCookiesPath(): string | null {
  const paths = [
    "cookies.txt",
    "/tmp/cookies.txt",
    join(process.cwd(), "cookies.txt"),
  ];

  for (const path of paths) {
    try {
      if (existsSync(path)) {
        return path;
      }
    } catch {
      // Ignore errors checking file existence
    }
  }
  return null;
}

const INSTAGRAM_COOKIES = getCookiesPath();

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 200);
}

// ---------------------------
// YOUTUBE DOWNLOAD
// ---------------------------

async function downloadYouTubeVideo(url: string): Promise<Buffer> {
  const tempDir = getTempDir();
  const tempFile = join(tempDir, `video_${randomUUID()}.mp4`);
  let downloadedFile: string | null = null;

  try {
    // Ensure temp directory exists (important for serverless)
    try {
      await mkdir(tempDir, { recursive: true });
    } catch {
      // Directory might already exist, ignore
    }

    const ytdlp = new YtDlp();

    // Add timeout for serverless environments (60 seconds max for Vercel Pro)
    const downloadPromise = ytdlp.downloadAsync(url, {
      format: "best[ext=mp4]/best",
      output: tempFile,
    });

    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Download timeout: exceeded 50 seconds")),
        50000
      );
    });

    await Promise.race([downloadPromise, timeoutPromise]);

    const { access, constants, readdir, stat } = await import("fs/promises");
    let videoBuffer: Buffer;

    try {
      await access(tempFile, constants.F_OK);
      downloadedFile = tempFile;
      videoBuffer = await readFile(tempFile);
    } catch {
      const files = await readdir(tempDir);
      const videoFiles = files
        .filter((f) => {
          const lower = f.toLowerCase();
          return (
            (f.startsWith("video_") ||
              lower.includes("youtube") ||
              lower.includes("instagram")) &&
            (lower.endsWith(".mp4") ||
              lower.endsWith(".m4a") ||
              lower.endsWith(".webm"))
          );
        })
        .map((f) => join(tempDir, f));

      if (videoFiles.length > 0) {
        const fileStats = await Promise.all(
          videoFiles.map(async (f) => {
            try {
              const stats = await stat(f);
              return { path: f, mtime: stats.mtime.getTime() };
            } catch {
              return null;
            }
          })
        );

        const validStats = fileStats.filter(Boolean) as Array<{
          path: string;
          mtime: number;
        }>;

        if (validStats.length > 0) {
          validStats.sort((a, b) => b.mtime - a.mtime);
          downloadedFile = validStats[0].path;
          videoBuffer = await readFile(downloadedFile);
        } else {
          throw new Error("Downloaded file not found");
        }
      } else {
        throw new Error("Downloaded file not found");
      }
    }

    if (downloadedFile) await unlink(downloadedFile).catch(() => {});
    return videoBuffer;
  } catch (error: any) {
    if (downloadedFile) await unlink(downloadedFile).catch(() => {});
    await unlink(tempFile).catch(() => {});

    // Provide more specific error messages for serverless environments
    const errorMessage = error.message || "Unknown error";
    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("ETIMEDOUT")
    ) {
      throw new Error(
        `Download timeout: The video download took too long. This may be due to serverless function limits.`
      );
    }
    if (errorMessage.includes("ENOENT") || errorMessage.includes("not found")) {
      throw new Error(
        `yt-dlp binary not found. This may not work in serverless environments. Error: ${errorMessage}`
      );
    }
    throw new Error(`Failed to download YouTube video: ${errorMessage}`);
  }
}

// ---------------------------
// INSTAGRAM DOWNLOAD (with cookies + reliability)
// ---------------------------

async function downloadInstagramVideo(url: string): Promise<Buffer> {
  const tempDir = getTempDir();
  const tempFile = join(tempDir, `video_${randomUUID()}.mp4`);
  let downloadedFile: string | null = null;

  try {
    // Ensure temp directory exists (important for serverless)
    try {
      await mkdir(tempDir, { recursive: true });
    } catch {
      // Directory might already exist, ignore
    }

    const ytdlp = new YtDlp();
    const cookieStatus = await checkCookieStatus();

    // Log cookie status for debugging
    console.log("Instagram download - Cookie status:", {
      exists: cookieStatus.exists,
      valid: cookieStatus.valid,
      hasSessionId: cookieStatus.hasSessionId,
      hasCsrfToken: cookieStatus.hasCsrfToken,
      expired: cookieStatus.expired,
      expiresSoon: cookieStatus.expiresSoon,
      error: cookieStatus.error,
      cookiesPath: INSTAGRAM_COOKIES,
      tempDir: tempDir,
    });

    const downloadPromise = ytdlp.downloadAsync(url, {
      format: "best[ext=mp4]/best",
      output: tempFile,
      cookies: INSTAGRAM_COOKIES || undefined,
    });

    // Add timeout wrapper (50 seconds to stay under Vercel's 60s limit)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Download timeout: exceeded 50 seconds")),
        50000
      );
    });

    await Promise.race([downloadPromise, timeoutPromise]);

    const { access, constants, readdir, stat } = await import("fs/promises");
    let videoBuffer: Buffer;

    try {
      await access(tempFile, constants.F_OK);
      downloadedFile = tempFile;
      videoBuffer = await readFile(tempFile);
    } catch {
      const files = await readdir(tempDir);
      const videoFiles = files
        .filter((f) => {
          const lower = f.toLowerCase();
          return (
            (f.startsWith("video_") || lower.includes("instagram")) &&
            (lower.endsWith(".mp4") ||
              lower.endsWith(".m4a") ||
              lower.endsWith(".webm"))
          );
        })
        .map((f) => join(tempDir, f));

      if (videoFiles.length > 0) {
        const fileStats = await Promise.all(
          videoFiles.map(async (f) => {
            try {
              const stats = await stat(f);
              return { path: f, mtime: stats.mtime.getTime() };
            } catch {
              return null;
            }
          })
        );

        const validStats = fileStats.filter(Boolean) as Array<{
          path: string;
          mtime: number;
        }>;

        if (validStats.length > 0) {
          validStats.sort((a, b) => b.mtime - a.mtime);
          downloadedFile = validStats[0].path;
          videoBuffer = await readFile(downloadedFile);
        } else {
          throw new Error("Downloaded file not found in temp directory");
        }
      } else {
        throw new Error("Downloaded file not found");
      }
    }

    if (downloadedFile) await unlink(downloadedFile).catch(() => {});
    return videoBuffer;
  } catch (error: any) {
    if (downloadedFile) await unlink(downloadedFile).catch(() => {});
    await unlink(tempFile).catch(() => {});

    // Provide more specific error messages for serverless environments
    const errorMessage = error.message || "Unknown error";
    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("ETIMEDOUT")
    ) {
      const timeoutError = new Error(
        "Download timeout: The video download took too long. This may be due to serverless function limits."
      );
      (timeoutError as any).parsedError = {
        userMessage:
          "Download timeout: The video download exceeded the time limit. Please try again or contact support.",
        reason: "Serverless function timeout",
        suggestions: [
          "Try downloading again",
          "The video might be too large or slow to download",
          "Contact support if the issue persists",
        ],
      };
      throw timeoutError;
    }
    if (errorMessage.includes("ENOENT") || errorMessage.includes("not found")) {
      const binaryError = new Error(
        "yt-dlp binary not found. This may not work in serverless environments."
      );
      (binaryError as any).parsedError = {
        userMessage:
          "Video download service is not available. This feature may not work in serverless environments.",
        reason: "yt-dlp binary not available",
        suggestions: [
          "This feature requires system dependencies that may not be available in serverless environments",
          "Contact support for alternative solutions",
        ],
      };
      throw binaryError;
    }

    // Parse error to get user-friendly message
    const parsedError = parseInstagramError(errorMessage);
    const enhancedError = new Error(parsedError.userMessage);
    (enhancedError as any).parsedError = parsedError;
    (enhancedError as any).originalError = errorMessage;
    throw enhancedError;
  }
}

// ---------------------------
// MAIN GET HANDLER
// ---------------------------

export async function GET(request: Request) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin)
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );

    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get("submissionId");
    const checkCookies = searchParams.get("checkCookies") === "true";

    // ⭐ ADDED: Endpoint to check cookie status
    if (checkCookies) {
      const cookieStatus = await checkCookieStatus();
      return NextResponse.json({
        cookies: cookieStatus,
        message: cookieStatus.valid
          ? "Cookies are valid and ready to use"
          : cookieStatus.exists
          ? `Cookies file exists but has issues: ${
              cookieStatus.error || "Invalid format"
            }`
          : "Cookies file not found. Please add cookies.txt to the project root.",
      });
    }

    if (!submissionId) {
      return NextResponse.json(
        { error: "Submission ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // First, try to fetch the submission with relationships
    let { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select(
        `
        id,
        content_link,
        platform,
        contest_id,
        creator_id,
        contests!inner(id, title),
        users!creator_id(username)
      `
      )
      .eq("id", submissionId)
      .single();

    // If the query fails due to missing relationships, try a simpler query
    if (submissionError) {
      console.warn("Initial query failed, trying fallback:", submissionError);
      const fallbackResult = await supabase
        .from("submissions")
        .select("id, content_link, platform, contest_id, creator_id")
        .eq("id", submissionId)
        .single();

      if (fallbackResult.error || !fallbackResult.data) {
        console.error(
          "Submission fetch error:",
          submissionError || fallbackResult.error
        );
        return NextResponse.json(
          {
            error: "Submission not found",
            details:
              (submissionError || fallbackResult.error)?.message ||
              "Unknown error",
          },
          { status: 404 }
        );
      }

      // Fetch contest and user separately
      const [contestResult, userResult] = await Promise.all([
        fallbackResult.data.contest_id
          ? supabase
              .from("contests")
              .select("id, title")
              .eq("id", fallbackResult.data.contest_id)
              .single()
          : Promise.resolve({ data: null, error: null }),
        fallbackResult.data.creator_id
          ? supabase
              .from("users")
              .select("username")
              .eq("id", fallbackResult.data.creator_id)
              .single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      submission = {
        ...fallbackResult.data,
        contests: contestResult.data as any,
        users: userResult.data as any,
      } as any;
    }

    if (!submission) {
      console.error("Submission not found after fallback");
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    const contentLink = submission.content_link;
    if (!contentLink) {
      return NextResponse.json(
        { error: "Submission has no content link" },
        { status: 400 }
      );
    }

    const isInstagram = contentLink.includes("instagram.com");
    const isYouTube =
      contentLink.includes("youtube.com") || contentLink.includes("youtu.be");

    if (!isInstagram && !isYouTube) {
      return NextResponse.json(
        { error: "Only Instagram & YouTube supported" },
        { status: 400 }
      );
    }

    const username = (submission.users as any)?.username || "unknown";
    const contestTitle = (submission.contests as any)?.title || "contest";

    const filename = sanitizeFilename(`${username}_${contestTitle}`);

    try {
      let videoBuffer: Buffer;

      if (isYouTube) {
        videoBuffer = await downloadYouTubeVideo(contentLink);
      } else {
        // Check cookie status before attempting download
        const cookieStatus = await checkCookieStatus();
        if (!cookieStatus.valid && cookieStatus.exists) {
          console.warn(
            "Instagram download attempted with invalid/expired cookies:",
            cookieStatus.error
          );
        }
        videoBuffer = await downloadInstagramVideo(contentLink);
      }

      // Include cookie status in response headers for Instagram downloads
      const headers: Record<string, string> = {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${filename}.mp4"`,
        "Cache-Control": "no-cache",
      };

      if (isInstagram) {
        const cookieStatus = await checkCookieStatus();
        headers["X-Cookie-Status"] = cookieStatus.valid
          ? "valid"
          : cookieStatus.exists
          ? "invalid"
          : "missing";
        if (cookieStatus.expiresSoon) {
          headers["X-Cookie-Warning"] = "Cookies expire soon";
        }
      }

      return new NextResponse(new Uint8Array(videoBuffer), { headers });
    } catch (error: any) {
      console.error("Video download error:", error);
      console.error("Error stack:", error.stack);
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        cause: error.cause,
      });

      if (isInstagram) {
        // Get parsed error to provide user-friendly message
        const parsedError =
          (error as any).parsedError || parseInstagramError(error.message);

        return NextResponse.json(
          {
            error: parsedError.userMessage,
            reason: parsedError.reason,
            suggestions: parsedError.suggestions,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to download video. Please try again.",
          details: error.message || "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Route handler error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      cause: error.cause,
    });

    return NextResponse.json({ status: 500 });
  }
}
