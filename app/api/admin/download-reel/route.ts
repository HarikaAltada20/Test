import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  getInstagramVideoStream,
  InstagramDownloadError,
} from "@/lib/instagram-download/download";
import {
  getYouTubeVideoStream,
  YouTubeDownloadError,
} from "@/lib/youtube-download/ytstream";
import {
  isAdminDownloadUser,
  submissionOwnedByDownloadUser,
  verifyAdminOrBrandDownloadAccess,
} from "@/lib/video-download-auth";
import { buildViewsBasedVideoFilename } from "@/lib/utils";

function parseInstagramError(errorMessage: string): {
  userMessage: string;
  reason: string;
  suggestions: string[];
} {
  const errorLower = errorMessage.toLowerCase();
  const originalError = errorMessage;

  if (
    errorLower.includes("empty media response") ||
    errorLower.includes("not found") ||
    errorLower.includes("does not exist") ||
    errorLower.includes("404")
  ) {
    return {
      userMessage:
        "This Instagram video could not be found. It may have been deleted or restricted.",
      reason: originalError,
      suggestions: [
        "Verify the video URL is correct",
        "Check if the post still exists on Instagram",
        "Only public videos can be downloaded",
      ],
    };
  }

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

  if (
    errorLower.includes("not a video") ||
    errorLower.includes("notvideo")
  ) {
    return {
      userMessage: "This Instagram post is not a video.",
      reason: originalError,
      suggestions: ["Only Reels and video posts can be downloaded"],
    };
  }

  if (
    errorLower.includes("private") ||
    errorLower.includes("restricted") ||
    errorLower.includes("login required")
  ) {
    return {
      userMessage:
        "This Instagram video is private or restricted. It cannot be downloaded.",
      reason: "Private or restricted content",
      suggestions: [
        "Only public videos can be downloaded",
        "The account may be private",
      ],
    };
  }

  return {
    userMessage:
      "Unable to download this Instagram video. The video may not be accessible or Instagram may be blocking the request.",
    reason: originalError,
    suggestions: [
      "Verify the video URL is correct and accessible",
      "Check if the post is public and not deleted",
      "Wait a few minutes and try again",
    ],
  };
}

function parseYouTubeError(errorMessage: string): {
  userMessage: string;
  reason: string;
  suggestions: string[];
} {
  const errorLower = errorMessage.toLowerCase();

  if (errorLower.includes("not subscribed")) {
    return {
      userMessage:
        "YouTube RapidAPI key is not subscribed to YTStream. Subscribe on RapidAPI, then retry.",
      reason: errorMessage,
      suggestions: [
        "Subscribe at https://rapidapi.com/ytjar/api/ytstream-download-youtube-videos",
        "Set YOUTUBE_RAPIDAPI_KEY to a subscribed key",
      ],
    };
  }

  if (
    errorLower.includes("private") ||
    errorLower.includes("unavailable") ||
    errorLower.includes("members-only")
  ) {
    return {
      userMessage:
        "This YouTube video is private, members-only, or unavailable.",
      reason: "Private or unavailable content",
      suggestions: [
        "Verify the YouTube video URL is correct and public",
        "Check if the video was removed or marked private",
      ],
    };
  }

  if (
    errorLower.includes("rate limit") ||
    errorLower.includes("too many") ||
    errorLower.includes("429")
  ) {
    return {
      userMessage:
        "Too many YouTube download requests. Please wait and try again.",
      reason: "Rate limit exceeded",
      suggestions: ["Wait a few minutes before retrying"],
    };
  }

  return {
    userMessage: "Failed to download YouTube video.",
    reason: errorMessage,
    suggestions: [
      "Verify the video link in your browser",
      "Confirm YOUTUBE_RAPIDAPI_KEY is set and subscribed to YTStream",
      "Try again in a few minutes",
    ],
  };
}

// ---------------------------
// YOUTUBE DOWNLOAD (YTStream RapidAPI)
// ---------------------------

async function downloadYouTubeVideoStream(url: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentLength: string | null;
}> {
  const downloadId = randomUUID().substring(0, 8);
  console.log(`[YT-${downloadId}] [DEBUG] Starting YTStream download stream:`, { url });

  try {
    const result = await getYouTubeVideoStream(url);
    return { stream: result.stream, contentLength: result.contentLength };
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

    const parsedError = parseYouTubeError(error.message);
    const enhancedError = new Error(parsedError.userMessage);
    (enhancedError as any).parsedError = parsedError;
    (enhancedError as any).originalError = error.message;
    throw enhancedError;
  }
}

// ---------------------------
// INSTAGRAM DOWNLOAD (Polaris GraphQL + CDN)
// ---------------------------

async function downloadInstagramVideoStream(url: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentLength: string | null;
}> {
  const downloadId = randomUUID().substring(0, 8);
  console.log(`[IG-${downloadId}] [DEBUG] Starting Instagram GraphQL download stream:`, {
    url,
  });

  try {
    const result = await getInstagramVideoStream(url);
    return { stream: result.stream, contentLength: result.contentLength };
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

export async function GET(request: Request) {
  const startTime = Date.now();
  const requestId = randomUUID();

  try {
    console.log(`[${requestId}] [DEBUG] Download reel request started`);

    const access = await verifyAdminOrBrandDownloadAccess();
    if (!access.allowed) {
      console.log(`[${requestId}] [DEBUG] Access denied`);
      return NextResponse.json(
        { error: access.error || "Admin or brand access required" },
        { status: 403 }
      );
    }
    const { user, supabase } = access;
    console.log(`[${requestId}] [DEBUG] Access verified (${user.user_type})`);

    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get("submissionId");
    const testDownload = searchParams.get("testDownload") === "true" || searchParams.get("testCookies") === "true";
    const testUrl = searchParams.get("testUrl");

    console.log(`[${requestId}] [DEBUG] Request params:`, {
      submissionId,
      testDownload,
      hasTestUrl: !!testUrl,
    });

    // Test Instagram GraphQL download path — admin only (arbitrary URL proxy).
    if (testDownload) {
      if (!isAdminDownloadUser(user)) {
        return NextResponse.json(
          { error: "Admin access required for download tests" },
          { status: 403 }
        );
      }

      if (!testUrl) {
        return NextResponse.json(
          {
            success: false,
            message: "testUrl parameter is required for testing Instagram download",
            example:
              "/api/admin/download-reel?testDownload=true&testUrl=https://www.instagram.com/reel/ABC123/",
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
        const { stream, contentLength } = await getInstagramVideoStream(testUrl);
        let sizeKB = "unknown";
        if (contentLength) {
          sizeKB = `${(parseInt(contentLength, 10) / 1024).toFixed(2)} KB`;
        } else {
          const reader = stream.getReader();
          let bytes = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) bytes += value.length;
          }
          sizeKB = `${(bytes / 1024).toFixed(2)} KB`;
        }
        return NextResponse.json({
          success: true,
          message: "✅ Instagram GraphQL download succeeded.",
          method: "polaris-graphql",
          fileSize: sizeKB,
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

    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select(
        `
        id,
        content_link,
        platform,
        views,
        contests!inner(id, title, advertiser_id),
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

    const advertiserId = (submission.contests as { advertiser_id?: string } | null)
      ?.advertiser_id;
    if (!submissionOwnedByDownloadUser(user, advertiserId)) {
      console.log(
        `[${requestId}] [DEBUG] Advertiser ${user.id} denied access to submission ${submissionId}`
      );
      return NextResponse.json(
        { error: "You can only download submissions from your own contests" },
        { status: 403 }
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
    if (!contentLink || typeof contentLink !== "string") {
      return NextResponse.json(
        { error: "Submission has no downloadable content link" },
        { status: 400 }
      );
    }

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

    // Name file by views so downloads sort/find easily by popularity.
    const filename = buildViewsBasedVideoFilename(submission.views);
    console.log(`[${requestId}] [DEBUG] Generated filename: ${filename} (views=${submission.views})`);

    try {
      let videoStream: ReadableStream<Uint8Array>;
      let contentLengthHeader: string | null = null;
      const downloadStartTime = Date.now();

      if (isYouTube) {
        console.log(
          `[${requestId}] [DEBUG] Starting YouTube download stream: ${contentLink}`
        );
        const yt = await downloadYouTubeVideoStream(contentLink);
        videoStream = yt.stream;
        contentLengthHeader = yt.contentLength;
        console.log(
          `[${requestId}] [DEBUG] YouTube stream initialized in ${
            Date.now() - downloadStartTime
          }ms`
        );
      } else {
        console.log(
          `[${requestId}] [DEBUG] Starting Instagram GraphQL download stream: ${contentLink}`
        );
        const ig = await downloadInstagramVideoStream(contentLink);
        videoStream = ig.stream;
        contentLengthHeader = ig.contentLength;
        console.log(
          `[${requestId}] [DEBUG] Instagram stream initialized in ${
            Date.now() - downloadStartTime
          }ms`
        );
      }

      const headers: Record<string, string> = {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${filename}.mp4"`,
        "Cache-Control": "no-cache",
      };

      if (contentLengthHeader) {
        headers["Content-Length"] = contentLengthHeader;
      }

      if (isInstagram) {
        headers["X-Download-Method"] = "polaris-graphql";
      } else if (isYouTube) {
        headers["X-Download-Method"] = "ytstream-rapidapi";
      }

      console.log(
        `[${requestId}] [DEBUG] Sending video stream response, total time: ${
          Date.now() - startTime
        }ms`
      );
      return new NextResponse(videoStream, { headers });
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
        const parsedError =
          (error as any).parsedError || parseYouTubeError(error.message);

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