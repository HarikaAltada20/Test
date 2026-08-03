import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { randomUUID } from "crypto";
import { checkInstagramCookieStatus } from "@/lib/instagram-cookies";
import {
  downloadInstagramVideoBuffer,
  InstagramDownloadError,
} from "@/lib/instagram-download/download";
import {
  downloadYouTubeVideoBuffer,
  YouTubeDownloadError,
} from "@/lib/youtube-download";

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

  // Invalid option or yt-dlp syntax error
  if (
    errorLower.includes("no such option") ||
    errorLower.includes("unrecognized option")
  ) {
    return {
      userMessage: "Internal download error: Downloader configuration issue.",
      reason: originalError,
      suggestions: [
        "Check server logs for yt-dlp option errors",
        "Report this issue to support",
      ],
    };
  }

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

  // Explicit Cookie/authentication issues
  if (
    errorLower.includes("login required") ||
    errorLower.includes("session expired") ||
    errorLower.includes("invalid cookie")
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

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 200);
}

// ---------------------------
// YOUTUBE DOWNLOAD (@distube/ytdl-core, no cookies)
// ---------------------------

async function downloadYouTubeVideo(url: string): Promise<Buffer> {
  const downloadId = randomUUID().substring(0, 8);
  console.log(`[YT-${downloadId}] [DEBUG] Starting YouTube download:`, { url });

  try {
    const downloadStartTime = Date.now();
    const videoBuffer = await downloadYouTubeVideoBuffer(url);
    console.log(
      `[YT-${downloadId}] [DEBUG] YouTube download successful in ${
        Date.now() - downloadStartTime
      }ms, buffer size: ${videoBuffer.length} bytes`
    );
    return videoBuffer;
  } catch (error: any) {
    console.error(`[YT-${downloadId}] [ERROR] YouTube download failed:`, {
      message: error.message,
      stack: error.stack,
      url,
    });

    if (error instanceof YouTubeDownloadError) {
      const parsedError = {
        userMessage: error.message,
        reason: error.reason,
        suggestions: error.suggestions,
      };
      const enhancedError = new Error(parsedError.userMessage);
      (enhancedError as any).parsedError = parsedError;
      (enhancedError as any).originalError = error.reason;
      throw enhancedError;
    }

    const enhancedError = new Error(
      error?.message || "Failed to download YouTube video."
    );
    (enhancedError as any).parsedError = {
      userMessage: enhancedError.message,
      reason: error?.message || "Unknown error",
      suggestions: [
        "Verify the video link in your browser",
        "Try again in a few minutes",
      ],
    };
    (enhancedError as any).originalError = error?.message;
    throw enhancedError;
  }
}

// ---------------------------
// INSTAGRAM DOWNLOAD (Polaris GraphQL + CDN)
// ---------------------------

async function downloadInstagramVideo(url: string): Promise<Buffer> {
  const downloadId = randomUUID().substring(0, 8);
  console.log(`[IG-${downloadId}] [DEBUG] Starting Instagram GraphQL download:`, {
    url,
  });

  try {
    const downloadStartTime = Date.now();
    const videoBuffer = await downloadInstagramVideoBuffer(url);
    console.log(
      `[IG-${downloadId}] [DEBUG] Instagram download successful in ${
        Date.now() - downloadStartTime
      }ms, buffer size: ${videoBuffer.length} bytes`
    );
    return videoBuffer;
  } catch (error: any) {
    console.error(`[IG-${downloadId}] [ERROR] Instagram download failed:`, {
      message: error.message,
      stack: error.stack,
      url,
    });

    if (error instanceof InstagramDownloadError) {
      const parsedError = {
        userMessage: error.message,
        reason: error.reason,
        suggestions: error.suggestions,
      };
      const enhancedError = new Error(parsedError.userMessage);
      (enhancedError as any).parsedError = parsedError;
      (enhancedError as any).originalError = error.reason;
      throw enhancedError;
    }

    const parsedError = parseInstagramError(error.message);
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
      const cookieStatus = await checkInstagramCookieStatus();
      const sourceLabel =
        cookieStatus.source === "db"
          ? "database (live refreshed session)"
          : cookieStatus.source === "env"
          ? "environment variable (INSTAGRAM_COOKIES)"
          : cookieStatus.source === "file"
          ? "local cookies file"
          : "none (no cookies found)";

      return NextResponse.json({
        cookies: cookieStatus,
        source: sourceLabel,
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
          : "❌ Cookies not found. Upload via PUT /api/admin/instagram-cookies or set INSTAGRAM_COOKIES.",
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
                ? "Use a dedicated IG account, export cookies, PUT /api/admin/instagram-cookies — then do not reuse that session in a browser"
                : null,
            ].filter(Boolean)
          : [],
      });
    }

    // Test Instagram GraphQL download path with a real reel URL
    if (testCookies) {
      if (!testUrl) {
        return NextResponse.json(
          {
            success: false,
            message: "testUrl parameter is required for testing Instagram download",
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
        const videoBuffer = await downloadInstagramVideoBuffer(testUrl);
        return NextResponse.json({
          success: true,
          message: "✅ Instagram GraphQL download succeeded.",
          method: "polaris-graphql",
          fileSize: `${(videoBuffer.length / 1024).toFixed(2)} KB`,
        });
      } catch (error: any) {
        const parsedError =
          error instanceof InstagramDownloadError
            ? {
                userMessage: error.message,
                reason: error.reason,
                suggestions: error.suggestions,
              }
            : parseInstagramError(error.message);
        return NextResponse.json(
          {
            success: false,
            message: "❌ Instagram download test failed",
            error: parsedError.userMessage,
            reason: parsedError.reason,
            suggestions: parsedError.suggestions,
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
        console.log(
          `[${requestId}] [DEBUG] Starting Instagram GraphQL download: ${contentLink}`
        );
        videoBuffer = await downloadInstagramVideo(contentLink);
        console.log(
          `[${requestId}] [DEBUG] Instagram download completed in ${
            Date.now() - downloadStartTime
          }ms, size: ${videoBuffer.length} bytes`
        );
      }

      const headers: Record<string, string> = {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${filename}.mp4"`,
        "Cache-Control": "no-cache",
      };

      if (isInstagram) {
        headers["X-Download-Method"] = "polaris-graphql";
      } else if (isYouTube) {
        headers["X-Download-Method"] = "ytdl-core";
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

      if (isYouTube) {
        const parsedError = (error as any).parsedError || {
          userMessage: error?.message || "Failed to download YouTube video.",
          reason: error?.message || "Unknown error",
          suggestions: [
            "Verify the video link in your browser",
            "Try again in a few minutes",
          ],
        };

        console.log(
          `[${requestId}] [DEBUG] Returning YouTube error response:`,
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
