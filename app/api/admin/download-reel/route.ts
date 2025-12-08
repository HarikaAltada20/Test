import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createClient } from "@/utils/supabase/server";
import { YtDlp } from "ytdlp-nodejs";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";


function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 200); // Limit length
}

// Download YouTube video using ytdlp-nodejs (same as Instagram for consistency)
async function downloadYouTubeVideo(url: string): Promise<Buffer> {
  const tempFile = join(tmpdir(), `video_${randomUUID()}.mp4`);
  let downloadedFile: string | null = null;

  try {
    const ytdlp = new YtDlp();

    // Download video - yt-dlp handles YouTube better than ytdl-core
    await ytdlp.downloadAsync(url, {
      format: "best[ext=mp4]/best",
      output: tempFile,
    });

    
    const { access, constants, readdir, stat } = await import("fs/promises");
    let videoBuffer: Buffer;

    try {
      // First try the exact temp file path
      await access(tempFile, constants.F_OK);
      downloadedFile = tempFile;
      videoBuffer = await readFile(tempFile);
    } catch {
     
      const files = await readdir(tmpdir());
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

      if (videoFiles.length > 0) {
        // Get file stats to find the most recently created one
        const fileStats = await Promise.all(
          videoFiles.map(async (f) => {
            try {
              const stats = await stat(f);
              return {
                path: f,
                mtime: stats.mtime.getTime(),
              };
            } catch {
              return null;
            }
          })
        );

        const validStats = fileStats.filter((s) => s !== null) as Array<{
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

    // Clean up temp file
    if (downloadedFile) {
      await unlink(downloadedFile).catch(() => {});
    }

    return videoBuffer;
  } catch (error: any) {
    // Ensure cleanup on error
    if (downloadedFile) {
      await unlink(downloadedFile).catch(() => {});
    }
    await unlink(tempFile).catch(() => {});
    console.error("YouTube download error:", error);
    throw new Error(`Failed to download YouTube video: ${error.message}`);
  }
}

// Download Instagram video using ytdlp-nodejs
async function downloadInstagramVideo(url: string): Promise<Buffer> {
  const tempFile = join(tmpdir(), `video_${randomUUID()}.mp4`);
  let downloadedFile: string | null = null;

  try {
    const ytdlp = new YtDlp();

    // Download video - yt-dlp will use the output path we specify
    await ytdlp.downloadAsync(url, {
      format: "best[ext=mp4]/best",
      output: tempFile,
    });

    // Check if file exists at the temp path
    const { access, constants, readdir, stat } = await import("fs/promises");
    let videoBuffer: Buffer;

    try {
      // First try the exact temp file path
      await access(tempFile, constants.F_OK);
      downloadedFile = tempFile;
      videoBuffer = await readFile(tempFile);
    } catch {
     
      const files = await readdir(tmpdir());
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

      if (videoFiles.length > 0) {
        // Get file stats to find the most recently created one
        const fileStats = await Promise.all(
          videoFiles.map(async (f) => {
            try {
              const stats = await stat(f);
              return {
                path: f,
                mtime: stats.mtime.getTime(),
              };
            } catch {
              return null;
            }
          })
        );

        const validStats = fileStats.filter((s) => s !== null) as Array<{
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

    // Clean up temp file
    if (downloadedFile) {
      await unlink(downloadedFile).catch(() => {});
    }

    return videoBuffer;
  } catch (error: any) {
    // Ensure cleanup on error
    if (downloadedFile) {
      await unlink(downloadedFile).catch(() => {});
    }
    await unlink(tempFile).catch(() => {});
    console.error("Instagram download error:", error);
    throw new Error(`Failed to download Instagram video: ${error.message}`);
  }
}

export async function GET(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, error: adminError } = await verifyAdminAccess();

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get("submissionId");

    if (!submissionId) {
      return NextResponse.json(
        { error: "Submission ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select(
        `
        id,
        content_link,
        platform,
        contests!inner(
          id,
          title
        ),
        users!creator_id(
          username
        )
      `
      )
      .eq("id", submissionId)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    const contentLink = submission.content_link;
    if (!contentLink) {
      return NextResponse.json(
        { error: "No content link found for this submission" },
        { status: 400 }
      );
    }

    // Check if URL is from Instagram or YouTube
    const isInstagram = contentLink.includes("instagram.com");
    const isYouTube =
      contentLink.includes("youtube.com") || contentLink.includes("youtu.be");

    if (!isInstagram && !isYouTube) {
      return NextResponse.json(
        { error: "Only Instagram and YouTube URLs are supported" },
        { status: 400 }
      );
    }

    // Get username and contest title
    const username = (submission.users as any)?.username || "unknown";
    const contestTitle = (submission.contests as any)?.title || "contest";

    // Generate filename: username_contest_name
    const filename = sanitizeFilename(`${username}_${contestTitle}`);

    try {
      
      let videoBuffer: Buffer;

      if (isYouTube) {
        videoBuffer = await downloadYouTubeVideo(contentLink);
      } else if (isInstagram) {
        videoBuffer = await downloadInstagramVideo(contentLink);
      } else {
        return NextResponse.json(
          { error: "Unsupported platform" },
          { status: 400 }
        );
      }

      // Return video as downloadable file
      return new NextResponse(new Uint8Array(videoBuffer), {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${filename}.mp4"`,
          "Content-Length": videoBuffer.length.toString(),
          "Cache-Control": "no-cache",
        },
      });
    } catch (error: any) {
      console.error("Error downloading video:", error);
      return NextResponse.json(
        { error: "Failed to download video", details: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in download-reel endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
