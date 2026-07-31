import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { YtDlp } from "ytdlp-nodejs";
import { readFile, writeFile, unlink, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { existsSync, statSync } from "fs";

// ⭐ ADDED: Get yt-dlp binary path (bundled for Vercel)
function getYtDlpBinaryPath(): string | undefined {
  // Only use bundled binary on Linux (Vercel serverless environment)
  // On Windows/Mac, let ytdlp-nodejs handle it automatically
  const isLinux = process.platform === 'linux';
  
  if (!isLinux) {
    console.log(`[YTDLP] Platform is ${process.platform}, letting ytdlp-nodejs handle binary automatically`);
    return undefined;
  }

  // On Linux (Vercel), check for bundled binary
  const possiblePaths = [
    // Bundled binary in bin directory (for Vercel deployment)
    join(process.cwd(), "bin", "yt-dlp"),
    // Alternative: check if we're in a Next.js build
    join(process.cwd(), "..", "bin", "yt-dlp"),
    // Local development (if running on Linux)
    join(__dirname, "..", "..", "..", "bin", "yt-dlp"),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      // Verify it's actually a file (not a directory)
      try {
        const stats = statSync(path);
        if (stats.isFile()) {
          console.log(`[YTDLP] Found binary at: ${path}`);
          return path;
        }
      } catch (err) {
        // File exists but can't stat it, skip
        continue;
      }
    }
  }

  // If no binary found, ytdlp-nodejs will try to download it or use system PATH
  console.log(`[YTDLP] No bundled binary found on Linux, using system PATH or auto-download`);
  return undefined;
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
  // Initialize cookies from env first if needed
  await initializeCookies();

  // Only check the source that was actually initialized
  const cookiePath = INSTAGRAM_COOKIES;

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
    if (!cookiePath) {
      status.error =
        COOKIES_SOURCE === null
          ? "No cookies configured. Set INSTAGRAM_COOKIES env variable."
          : "Cookies file not found";
      return status;
    }

    // At this point, cookiePath is guaranteed to be a non-null string
    const path: string = cookiePath;

    if (!existsSync(path)) {
      status.error = "Cookies file not found";
      return status;
    }

    status.exists = true;
    status.path = path;

    // Check file modification time
    try {
      const stats = await stat(path);
      status.lastModified = stats.mtime;
    } catch (e) {
      status.error = "Could not read file stats";
      return status;
    }

    // Read and validate cookie content
    const cookieContent = await readFile(path, "utf-8");
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

// ⭐ ADDED: Auto-load cookies from env variable only
let INSTAGRAM_COOKIES: string | null = null;
let COOKIES_SOURCE: "env" | null = null;

async function initializeCookies(): Promise<void> {
  try {
    if (process.env.INSTAGRAM_COOKIES) {
      let rawCookies = process.env.INSTAGRAM_COOKIES;
      // Handle literal '\n' escape sequences (common when stored in single-line env vars)
      if (rawCookies.includes("\\n")) {
        rawCookies = rawCookies.replace(/\\n/g, "\n");
      }

      const cookiePath = join(tmpdir(), "cookies.txt");
      try {
        await writeFile(cookiePath, rawCookies, "utf-8");
        INSTAGRAM_COOKIES = cookiePath;
        COOKIES_SOURCE = "env";
      } catch (writeError: any) {
        console.error(
          "Failed to write cookies to temp file:",
          writeError.message
        );
        INSTAGRAM_COOKIES = null;
        COOKIES_SOURCE = null;
      }
    } else {
      // Clean up any old temp file if env var is not set
      const cookiePath = join(tmpdir(), "cookies.txt");
      if (existsSync(cookiePath)) {
        await unlink(cookiePath).catch(() => {});
      }
      INSTAGRAM_COOKIES = null;
      COOKIES_SOURCE = null;
    }
  } catch (error: any) {
    console.error("Error initializing cookies:", error.message);
    INSTAGRAM_COOKIES = null;
    COOKIES_SOURCE = null;
  }
}

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
  const downloadId = randomUUID().substring(0, 8);
  const tempFile = join(tmpdir(), `video_${randomUUID()}.mp4`);
  let downloadedFile: string | null = null;

  console.log(`[YT-${downloadId}] [DEBUG] Starting YouTube download:`, {
    url,
    tempFile,
  });

  try {
    // ⭐ FIXED: Configure yt-dlp with bundled binary path for Vercel
    const binaryPath = getYtDlpBinaryPath();
    const ytdlp = new YtDlp(binaryPath ? { binaryPath } : undefined);
    const downloadStartTime = Date.now();

    console.log(`[YT-${downloadId}] [DEBUG] Calling yt-dlp...`, {
      binaryPath: binaryPath || "system PATH",
    });
    await ytdlp.downloadAsync(url, {
      format: "best[ext=mp4]/best",
      output: tempFile,
    });
    console.log(
      `[YT-${downloadId}] [DEBUG] yt-dlp completed in ${
        Date.now() - downloadStartTime
      }ms`
    );

    const { access, constants, readdir, stat } = await import("fs/promises");
    let videoBuffer: Buffer;

    try {
      console.log(
        `[YT-${downloadId}] [DEBUG] Checking if temp file exists: ${tempFile}`
      );
      await access(tempFile, constants.F_OK);
      downloadedFile = tempFile;
      const fileStats = await stat(tempFile);
      console.log(
        `[YT-${downloadId}] [DEBUG] Temp file found, size: ${fileStats.size} bytes`
      );
      videoBuffer = await readFile(tempFile);
      console.log(
        `[YT-${downloadId}] [DEBUG] File read successfully, buffer size: ${videoBuffer.length} bytes`
      );
    } catch (accessError: any) {
      console.log(
        `[YT-${downloadId}] [DEBUG] Temp file not found, searching in tmpdir:`,
        accessError.message
      );
      const files = await readdir(tmpdir());
      console.log(
        `[YT-${downloadId}] [DEBUG] Found ${files.length} files in tmpdir`
      );
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
        .map((f) => join(tmpdir(), f));

      console.log(
        `[YT-${downloadId}] [DEBUG] Found ${videoFiles.length} potential video files`
      );

      if (videoFiles.length > 0) {
        const fileStats = await Promise.all(
          videoFiles.map(async (f) => {
            try {
              const stats = await stat(f);
              return {
                path: f,
                mtime: stats.mtime.getTime(),
                size: stats.size,
              };
            } catch {
              return null;
            }
          })
        );

        const validStats = fileStats.filter(Boolean) as Array<{
          path: string;
          mtime: number;
          size: number;
        }>;

        if (validStats.length > 0) {
          validStats.sort((a, b) => b.mtime - a.mtime);
          downloadedFile = validStats[0].path;
          console.log(
            `[YT-${downloadId}] [DEBUG] Using most recent file: ${downloadedFile}, size: ${validStats[0].size} bytes`
          );
          videoBuffer = await readFile(downloadedFile);
        } else {
          throw new Error("Downloaded file not found");
        }
      } else {
        throw new Error("Downloaded file not found");
      }
    }

    if (downloadedFile) await unlink(downloadedFile).catch(() => {});
    console.log(
      `[YT-${downloadId}] [DEBUG] YouTube download successful, buffer size: ${videoBuffer.length} bytes`
    );
    return videoBuffer;
  } catch (error: any) {
    console.error(`[YT-${downloadId}] [ERROR] YouTube download failed:`, {
      message: error.message,
      stack: error.stack,
      url,
    });
    if (downloadedFile) await unlink(downloadedFile).catch(() => {});
    await unlink(tempFile).catch(() => {});
    throw new Error(`Failed to download YouTube video: ${error.message}`);
  }
}

// ---------------------------
// INSTAGRAM DOWNLOAD (with cookies + reliability)
// ---------------------------

async function downloadInstagramVideo(url: string): Promise<Buffer> {
  const downloadId = randomUUID().substring(0, 8);
  const tempFile = join(tmpdir(), `video_${randomUUID()}.mp4`);
  let downloadedFile: string | null = null;

  console.log(`[IG-${downloadId}] [DEBUG] Starting Instagram download:`, {
    url,
    tempFile,
  });

  try {
    // ⭐ FIXED: Configure yt-dlp with bundled binary path for Vercel
    const binaryPath = getYtDlpBinaryPath();
    const ytdlp = new YtDlp(binaryPath ? { binaryPath } : undefined);
    const cookieStatus = await checkCookieStatus();

    // Log cookie status for debugging
    console.log(
      `[IG-${downloadId}] [DEBUG] Instagram download - Cookie status:`,
      {
        source: COOKIES_SOURCE || "none",
        exists: cookieStatus.exists,
        valid: cookieStatus.valid,
        hasSessionId: cookieStatus.hasSessionId,
        hasCsrfToken: cookieStatus.hasCsrfToken,
        expired: cookieStatus.expired,
        expiresSoon: cookieStatus.expiresSoon,
        path: cookieStatus.path,
        error: cookieStatus.error,
        cookiePath: INSTAGRAM_COOKIES,
        binaryPath: binaryPath || "system PATH",
      }
    );

    const downloadStartTime = Date.now();
    console.log(
      `[IG-${downloadId}] [DEBUG] Calling yt-dlp with cookies: ${
        INSTAGRAM_COOKIES || "none"
      }...`
    );
    await ytdlp.downloadAsync(url, {
      format: "best[ext=mp4]/best",
      output: tempFile,
      cookies: INSTAGRAM_COOKIES || undefined,
    });
    console.log(
      `[IG-${downloadId}] [DEBUG] yt-dlp completed in ${
        Date.now() - downloadStartTime
      }ms`
    );

    const { access, constants, readdir, stat } = await import("fs/promises");
    let videoBuffer: Buffer;

    try {
      console.log(
        `[IG-${downloadId}] [DEBUG] Checking if temp file exists: ${tempFile}`
      );
      await access(tempFile, constants.F_OK);
      downloadedFile = tempFile;
      const fileStats = await stat(tempFile);
      console.log(
        `[IG-${downloadId}] [DEBUG] Temp file found, size: ${fileStats.size} bytes`
      );
      videoBuffer = await readFile(tempFile);
      console.log(
        `[IG-${downloadId}] [DEBUG] File read successfully, buffer size: ${videoBuffer.length} bytes`
      );
    } catch (accessError: any) {
      console.log(
        `[IG-${downloadId}] [DEBUG] Temp file not found, searching in tmpdir:`,
        accessError.message
      );
      const files = await readdir(tmpdir());
      console.log(
        `[IG-${downloadId}] [DEBUG] Found ${files.length} files in tmpdir`
      );
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
        .map((f) => join(tmpdir(), f));

      console.log(
        `[IG-${downloadId}] [DEBUG] Found ${videoFiles.length} potential video files`
      );

      if (videoFiles.length > 0) {
        const fileStats = await Promise.all(
          videoFiles.map(async (f) => {
            try {
              const stats = await stat(f);
              return {
                path: f,
                mtime: stats.mtime.getTime(),
                size: stats.size,
              };
            } catch {
              return null;
            }
          })
        );

        const validStats = fileStats.filter(Boolean) as Array<{
          path: string;
          mtime: number;
          size: number;
        }>;

        if (validStats.length > 0) {
          validStats.sort((a, b) => b.mtime - a.mtime);
          downloadedFile = validStats[0].path;
          console.log(
            `[IG-${downloadId}] [DEBUG] Using most recent file: ${downloadedFile}, size: ${validStats[0].size} bytes`
          );
          videoBuffer = await readFile(downloadedFile);
        } else {
          throw new Error("Downloaded file not found in temp directory");
        }
      } else {
        throw new Error("Downloaded file not found");
      }
    }

    if (downloadedFile) await unlink(downloadedFile).catch(() => {});
    console.log(
      `[IG-${downloadId}] [DEBUG] Instagram download successful, buffer size: ${videoBuffer.length} bytes`
    );
    return videoBuffer;
  } catch (error: any) {
    console.error(`[IG-${downloadId}] [ERROR] Instagram download failed:`, {
      message: error.message,
      stack: error.stack,
      url,
      cookiePath: INSTAGRAM_COOKIES,
    });
    if (downloadedFile) await unlink(downloadedFile).catch(() => {});
    await unlink(tempFile).catch(() => {});

    // Parse error to get user-friendly message
    const parsedError = parseInstagramError(error.message);
    console.log(`[IG-${downloadId}] [DEBUG] Parsed error:`, parsedError);
    const enhancedError = new Error(parsedError.userMessage);
    (enhancedError as any).parsedError = parsedError;
    (enhancedError as any).originalError = error.message;
    throw enhancedError;
  }
}

// ---------------------------
// MAIN GET HANDLER
// ---------------------------

async function verifyAdminOrBrandAccess() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { allowed: false, user: null };
  const { data: userData } = await supabase
    .from("users")
    .select("user_type, email")
    .eq("id", user.id)
    .single();
  const allowed =
    userData?.user_type === "admin" || userData?.user_type === "advertiser";
  return { allowed, user: allowed ? { id: user.id, email: userData?.email, user_type: userData?.user_type } : null };
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const requestId = randomUUID();

  try {
    console.log(`[${requestId}] [DEBUG] Download reel request started`);

    // Initialize cookies from env variable
    await initializeCookies();
    console.log(
      `[${requestId}] [DEBUG] Cookies initialized, source: ${
        COOKIES_SOURCE || "none"
      }`
    );

    const { allowed } = await verifyAdminOrBrandAccess();
    if (!allowed) {
      console.log(`[${requestId}] [DEBUG] Access denied`);
      return NextResponse.json(
        { error: "Admin or brand access required" },
        { status: 403 }
      );
    }
    console.log(`[${requestId}] [DEBUG] Access verified (admin or brand)`);

    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get("submissionId");
    const checkCookies = searchParams.get("checkCookies") === "true";
    const testCookies = searchParams.get("testCookies") === "true";
    const testUrl = searchParams.get("testUrl");

    console.log(`[${requestId}] [DEBUG] Request params:`, {
      submissionId,
      checkCookies,
      testCookies,
      hasTestUrl: !!testUrl,
    });

    // ⭐ ADDED: Endpoint to check cookie status
    if (checkCookies) {
      const cookieStatus = await checkCookieStatus();

      // Determine source of cookies
      const source =
        COOKIES_SOURCE === "env"
          ? "environment variable (INSTAGRAM_COOKIES)"
          : "none (no cookies found)";

      return NextResponse.json({
        cookies: cookieStatus,
        source,
        status: cookieStatus.valid
          ? "valid"
          : cookieStatus.exists
          ? "invalid"
          : "missing",
        message: cookieStatus.valid
          ? "✅ Cookies are valid and ready to use"
          : cookieStatus.exists
          ? `⚠️ Cookies file exists but has issues: ${
              cookieStatus.error || "Invalid format"
            }`
          : "❌ Cookies not found. Set INSTAGRAM_COOKIES env variable.",
        recommendations: !cookieStatus.valid
          ? [
              cookieStatus.exists && !cookieStatus.hasSessionId
                ? "Missing sessionid cookie - this is required for Instagram downloads"
                : null,
              cookieStatus.exists && !cookieStatus.hasCsrfToken
                ? "Missing csrftoken cookie - this helps with authentication"
                : null,
              cookieStatus.expired
                ? "Cookies have expired - update with fresh cookies from your browser"
                : null,
              cookieStatus.expiresSoon
                ? "Cookies expire soon - consider updating them"
                : null,
              !cookieStatus.exists
                ? "Export cookies from your browser while logged into Instagram and set INSTAGRAM_COOKIES env variable"
                : null,
            ].filter(Boolean)
          : [],
      });
    }

    // ⭐ ADDED: Test cookies by attempting a real download
    if (testCookies) {
      const cookieStatus = await checkCookieStatus();

      if (!cookieStatus.valid) {
        return NextResponse.json(
          {
            success: false,
            message: "Cannot test cookies - they are invalid or missing",
            cookies: cookieStatus,
          },
          { status: 400 }
        );
      }

      if (!testUrl) {
        return NextResponse.json(
          {
            success: false,
            message: "testUrl parameter is required for testing cookies",
            example:
              "/api/admin/download-reel?testCookies=true&testUrl=https://www.instagram.com/reel/ABC123/",
          },
          { status: 400 }
        );
      }

      if (!testUrl.includes("instagram.com")) {
        return NextResponse.json(
          {
            success: false,
            message: "Test URL must be an Instagram URL",
          },
          { status: 400 }
        );
      }

      try {
        // Attempt to download a small portion to verify cookies work
        const binaryPath = getYtDlpBinaryPath();
        const ytdlp = new YtDlp(binaryPath ? { binaryPath } : undefined);
        const tempFile = join(tmpdir(), `test_${randomUUID()}.mp4`);

        await ytdlp.downloadAsync(testUrl, {
          format: "best[ext=mp4]/best",
          output: tempFile,
          cookies: INSTAGRAM_COOKIES || undefined,
        });

        // Check if file was created (even partially)
        const fileExists = existsSync(tempFile);
        const fileSize = fileExists ? (await stat(tempFile)).size : 0;

        // Clean up
        await unlink(tempFile).catch(() => {});

        if (fileExists && fileSize > 0) {
          return NextResponse.json({
            success: true,
            message: "✅ Cookies are working! Test download succeeded.",
            fileSize: `${(fileSize / 1024).toFixed(2)} KB`,
            cookies: cookieStatus,
          });
        } else {
          return NextResponse.json(
            {
              success: false,
              message: "Download started but no file was created",
              cookies: cookieStatus,
            },
            { status: 500 }
          );
        }
      } catch (error: any) {
        const parsedError = parseInstagramError(error.message);
        return NextResponse.json(
          {
            success: false,
            message: "❌ Cookies test failed",
            error: parsedError.userMessage,
            reason: parsedError.reason,
            suggestions: parsedError.suggestions,
            cookies: cookieStatus,
          },
          { status: 500 }
        );
      }
    }

    if (!submissionId) {
      console.log(`[${requestId}] [DEBUG] Missing submissionId`);
      return NextResponse.json(
        { error: "Submission ID is required" },
        { status: 400 }
      );
    }

    console.log(
      `[${requestId}] [DEBUG] Fetching submission from database: ${submissionId}`
    );
    let supabase;
    try {
      supabase = await createClient();
      console.log(
        `[${requestId}] [DEBUG] Supabase client created successfully`
      );
    } catch (clientError: any) {
      console.error(
        `[${requestId}] [ERROR] Failed to create Supabase client:`,
        {
          message: clientError.message,
          stack: clientError.stack,
        }
      );
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select(
        `
        id,
        content_link,
        platform,
        contests!inner(id, title),
        users!creator_id(username)
      `
      )
      .eq("id", submissionId)
      .single();

    if (submissionError) {
      console.error(`[${requestId}] [ERROR] Database query error:`, {
        code: submissionError.code,
        message: submissionError.message,
        details: submissionError.details,
        hint: submissionError.hint,
      });
      return NextResponse.json(
        { error: submissionError.message || "Failed to fetch submission" },
        { status: submissionError.code === "PGRST116" ? 404 : 500 }
      );
    }

    if (!submission) {
      console.log(
        `[${requestId}] [DEBUG] Submission not found: ${submissionId}`
      );
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    console.log(`[${requestId}] [DEBUG] Submission found:`, {
      id: submission.id,
      contentLink: submission.content_link,
      platform: submission.platform,
      hasContest: !!submission.contests,
      hasUser: !!submission.users,
    });

    const contentLink = submission.content_link;
    const isInstagram = contentLink.includes("instagram.com");
    const isYouTube =
      contentLink.includes("youtube.com") || contentLink.includes("youtu.be");

    console.log(`[${requestId}] [DEBUG] Platform detection:`, {
      contentLink,
      isInstagram,
      isYouTube,
    });

    if (!isInstagram && !isYouTube) {
      console.log(`[${requestId}] [DEBUG] Unsupported platform`);
      return NextResponse.json(
        { error: "Only Instagram & YouTube supported" },
        { status: 400 }
      );
    }

    const username = (submission.users as any)?.username || "unknown";
    const contestTitle = (submission.contests as any)?.title || "contest";

    const filename = sanitizeFilename(`${username}_${contestTitle}`);
    console.log(`[${requestId}] [DEBUG] Generated filename: ${filename}`);

    try {
      let videoBuffer: Buffer;
      const downloadStartTime = Date.now();

      if (isYouTube) {
        console.log(
          `[${requestId}] [DEBUG] Starting YouTube download: ${contentLink}`
        );
        videoBuffer = await downloadYouTubeVideo(contentLink);
        console.log(
          `[${requestId}] [DEBUG] YouTube download completed in ${
            Date.now() - downloadStartTime
          }ms, size: ${videoBuffer.length} bytes`
        );
      } else {
        // Check cookie status before attempting download
        const cookieStatus = await checkCookieStatus();
        console.log(
          `[${requestId}] [DEBUG] Cookie status before Instagram download:`,
          {
            valid: cookieStatus.valid,
            exists: cookieStatus.exists,
            error: cookieStatus.error,
          }
        );
        if (!cookieStatus.valid && cookieStatus.exists) {
          console.warn(
            `[${requestId}] [WARN] Instagram download attempted with invalid/expired cookies:`,
            cookieStatus.error
          );
        }
        console.log(
          `[${requestId}] [DEBUG] Starting Instagram download: ${contentLink}`
        );
        videoBuffer = await downloadInstagramVideo(contentLink);
        console.log(
          `[${requestId}] [DEBUG] Instagram download completed in ${
            Date.now() - downloadStartTime
          }ms, size: ${videoBuffer.length} bytes`
        );
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

      console.log(
        `[${requestId}] [DEBUG] Sending video response, total time: ${
          Date.now() - startTime
        }ms`
      );
      return new NextResponse(new Uint8Array(videoBuffer), { headers });
    } catch (error: any) {
      console.error(`[${requestId}] [ERROR] Video download error:`, {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        originalError: (error as any)?.originalError,
        parsedError: (error as any)?.parsedError,
        contentLink,
        platform: isInstagram ? "instagram" : "youtube",
        submissionId,
      });

      if (isInstagram) {
        // Get parsed error to provide user-friendly message
        const parsedError =
          (error as any).parsedError || parseInstagramError(error.message);

        console.log(
          `[${requestId}] [DEBUG] Returning Instagram error response:`,
          parsedError
        );

        return NextResponse.json(
          {
            error: parsedError.userMessage,
            reason: parsedError.reason,
            suggestions: parsedError.suggestions,
            debug:
              process.env.NODE_ENV === "development"
                ? {
                    originalError: error?.message,
                    requestId,
                  }
                : undefined,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to download video. Please try again.",
          debug:
            process.env.NODE_ENV === "development"
              ? {
                  message: error?.message,
                  requestId,
                }
              : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error(`[${requestId}] [ERROR] Download reel endpoint error:`, {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      submissionId: new URL(request.url).searchParams.get("submissionId"),
      requestId,
      totalTime: Date.now() - startTime,
    });

    // Return more detailed error in development, generic in production
    const errorMessage =
      process.env.NODE_ENV === "development"
        ? error?.message || "Internal server error"
        : "Internal server error";

    return NextResponse.json(
      {
        error: errorMessage,
      
      },
      { status: 500 }
    );
  }
}
