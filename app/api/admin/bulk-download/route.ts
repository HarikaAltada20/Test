import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { ZipArchive } from "archiver";
import { PassThrough } from "stream";
import {
  downloadInstagramVideoBuffer,
  InstagramDownloadError,
} from "@/lib/instagram-download/download";
import {
  downloadYouTubeVideoBuffer,
  getYouTubeVideoTitle,
  YouTubeDownloadError,
} from "@/lib/youtube-download";

function parseInstagramError(errorMessage: string): {
  userMessage: string;
  reason: string;
} {
  const errorLower = errorMessage.toLowerCase();
  if (
    errorLower.includes("empty media response") ||
    errorLower.includes("instagram sent an empty media response")
  ) {
    return {
      userMessage:
        "This Instagram video is not accessible. The post may be private, deleted, or restricted.",
      reason: "Instagram returned empty media response",
    };
  }
  if (
    errorLower.includes("instagram api is not granting access") ||
    errorLower.includes("api is not granting access")
  ) {
    return {
      userMessage:
        "Instagram is blocking access to this video. Authentication may have failed.",
      reason: "Instagram API access denied",
    };
  }
  if (
    errorLower.includes("rate limit") ||
    errorLower.includes("too many requests") ||
    errorLower.includes("429")
  ) {
    return {
      userMessage: "Too many requests to Instagram. Please wait a few minutes.",
      reason: "Rate limit exceeded",
    };
  }
  return {
    userMessage: "Instagram download failed. The post may be private or restricted.",
    reason: errorMessage,
  };
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 100);
}

async function downloadVideoFile(
  url: string,
  outputPath: string,
  isInstagram: boolean
): Promise<void> {
  if (isInstagram) {
    const buffer = await downloadInstagramVideoBuffer(url);
    await writeFile(outputPath, buffer);
    return;
  }

  const buffer = await downloadYouTubeVideoBuffer(url);
  await writeFile(outputPath, buffer);
}

async function verifyAdminOrBrandAccess() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { allowed: false, user: null };
  const { data: userData } = await supabase
    .from("users")
    .select("user_type, email")
    .eq("id", user.id)
    .single();
  const allowed =
    userData?.user_type === "admin" || userData?.user_type === "advertiser";
  return {
    allowed,
    user: allowed
      ? { id: user.id, email: userData?.email, user_type: userData?.user_type }
      : null,
  };
}

export async function POST(request: Request) {
  const requestId = randomUUID().substring(0, 8);
  const startTime = Date.now();
  const tempDir = join(tmpdir(), `bulk_${randomUUID()}`);

  try {
    const { allowed } = await verifyAdminOrBrandAccess();
    if (!allowed) {
      return NextResponse.json(
        { error: "Admin or brand access required" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { urls = [], submissionIds = [], options = {} } = body;
    const format = options.format === "audio" ? "mp3" : "mp4";

    const downloadQueue: {
      url: string;
      filename: string;
      isInstagram: boolean;
    }[] = [];

    if (submissionIds && submissionIds.length > 0) {
      console.log(
        `[BULK-${requestId}] Resolving ${submissionIds.length} submission IDs`
      );
      const supabase = await createClient();
      const { data: submissions, error: submissionsError } = await supabase
        .from("submissions")
        .select(
          `
          id,
          content_link,
          platform,
          contests(title),
          users!creator_id(username)
        `
        )
        .in("id", submissionIds);

      if (submissionsError) {
        console.error(
          `[BULK-${requestId}] Database fetch error:`,
          submissionsError
        );
        return NextResponse.json(
          { error: "Failed to fetch submissions information" },
          { status: 500 }
        );
      }

      for (const sub of submissions || []) {
        if (!sub.content_link) continue;
        const username = (sub.users as any)?.username || "unknown";
        const contestTitle = (sub.contests as any)?.title || "contest";
        const cleanName = sanitizeFilename(
          `${username}_${contestTitle}_${sub.id}`
        );
        const isInstagram = sub.content_link.includes("instagram.com");

        downloadQueue.push({
          url: sub.content_link,
          filename: `${cleanName}.${format}`,
          isInstagram,
        });
      }
    } else if (urls && urls.length > 0) {
      console.log(`[BULK-${requestId}] Resolving ${urls.length} custom URLs`);
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        if (!url) continue;
        const isInstagram = url.includes("instagram.com");

        let title = "video";
        if (!isInstagram) {
          const rawTitle = await getYouTubeVideoTitle(url);
          if (rawTitle) {
            title = sanitizeFilename(rawTitle);
          }
        }

        downloadQueue.push({
          url,
          filename: `${title}_${i + 1}.${format}`,
          isInstagram,
        });
      }
    }

    if (downloadQueue.length === 0) {
      return NextResponse.json(
        { error: "No valid URLs or submissions to download" },
        { status: 400 }
      );
    }

    await mkdir(tempDir, { recursive: true });

    const zippedFiles: { path: string; name: string }[] = [];
    const failedQueue: { url: string; error: string }[] = [];

    for (const item of downloadQueue) {
      const targetPath = join(tempDir, item.filename);
      try {
        console.log(
          `[BULK-${requestId}] Downloading: ${item.url} -> ${targetPath}`
        );
        await downloadVideoFile(item.url, targetPath, item.isInstagram);

        if (existsSync(targetPath)) {
          zippedFiles.push({ path: targetPath, name: item.filename });
        } else {
          failedQueue.push({
            url: item.url,
            error: "Download completed but file was not generated.",
          });
        }
      } catch (err: any) {
        console.error(
          `[BULK-${requestId}] Failed downloading ${item.url}:`,
          err.message
        );
        if (item.isInstagram && err instanceof InstagramDownloadError) {
          failedQueue.push({ url: item.url, error: err.message });
        } else if (!item.isInstagram && err instanceof YouTubeDownloadError) {
          failedQueue.push({ url: item.url, error: err.message });
        } else if (item.isInstagram) {
          const parsed = parseInstagramError(err.message);
          failedQueue.push({ url: item.url, error: parsed.userMessage });
        } else {
          failedQueue.push({
            url: item.url,
            error: err.message || "YouTube download failed",
          });
        }
      }
    }

    const passthrough = new PassThrough();
    const archive = new ZipArchive({ zlib: { level: 9 } });

    archive.pipe(passthrough);

    for (const file of zippedFiles) {
      archive.file(file.path, { name: file.name });
    }

    if (failedQueue.length > 0) {
      const report = failedQueue
        .map((f, idx) => `${idx + 1}. URL: ${f.url}\n   Error: ${f.error}`)
        .join("\n\n");
      archive.append(report, { name: "failed_downloads_report.txt" });
    }

    archive.finalize();

    passthrough.on("close", async () => {
      console.log(`[BULK-${requestId}] Clean up temp folder: ${tempDir}`);
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    });

    console.log(
      `[BULK-${requestId}] Initiating file download stream after ${
        Date.now() - startTime
      }ms`
    );
    return new NextResponse(passthrough as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="bulk_download_${requestId}.zip"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error(`[BULK-${requestId}] Fatal bulk downloader error:`, error);
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    return NextResponse.json(
      { error: error.message || "Failed to initiate bulk download" },
      { status: 500 }
    );
  }
}
