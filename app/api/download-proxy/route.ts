import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/download-proxy?url=...&filename=...
 * Stream an external HTTPS media URL as an attachment (Instagram CDN, etc.).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fileUrl = searchParams.get("url");
  const filename = searchParams.get("filename") || "instagram-video.mp4";

  if (!fileUrl) {
    return NextResponse.json(
      { error: "missingUrl", message: "url is required" },
      { status: 400 }
    );
  }

  try {
    if (!fileUrl.startsWith("https://")) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Only allow Instagram / Meta CDN hosts
    const parsed = new URL(fileUrl);
    const host = parsed.hostname.toLowerCase();
    const allowed =
      host.endsWith("cdninstagram.com") ||
      host.endsWith("fbcdn.net") ||
      host.endsWith("instagram.com") ||
      host.endsWith("googlevideo.com") ||
      host.endsWith("ytimg.com") ||
      host.includes("googleusercontent.com");
    if (!allowed) {
      return NextResponse.json(
        { error: "hostNotAllowed", message: "url host is not allowed" },
        { status: 400 }
      );
    }

    const videoResponse = await fetch(fileUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36",
        Accept: "*/*",
        Referer: "https://www.instagram.com/",
      },
    });

    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
    }

    const videoStream = videoResponse.body;
    if (!videoStream) {
      throw new Error("Video stream is not available");
    }

    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    headers.set(
      "Content-Type",
      videoResponse.headers.get("Content-Type") || "video/mp4"
    );
    const contentLength = videoResponse.headers.get("Content-Length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new NextResponse(videoStream, {
      status: 200,
      headers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Download failed";
    console.error("Download proxy error:", error);
    return NextResponse.json(
      { error: "serverError", message },
      { status: 500 }
    );
  }
}