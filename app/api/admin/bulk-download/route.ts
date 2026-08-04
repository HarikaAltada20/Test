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
  YouTubeDownloadError,
} from "@/lib/youtube-download/ytstream";

function parseDownloadError(error: unknown, isInstagram: boolean): string {
  if (error instanceof InstagramDownloadError || error instanceof YouTubeDownloadError) {
    return error.message;
  }
  const message = error instanceof Error ? error.message : String(error);
  const errorLower = message.toLowerCase();
  if (errorLower.includes("rate limit") || errorLower.includes("too many") || errorLower.includes("429")) {
    return isInstagram
      ? "Too many requests to Instagram. Please wait a few minutes."
      : "Too many YouTube download requests. Please wait a few minutes.";
  }
  return isInstagram
    ? "Instagram download failed. The post may be private or restricted."
    : "YouTube download failed. The video may be private or restricted.";
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
  const buffer = isInstagram
    ? await downloadInstagramVideoBuffer(url)
    : await downloadYouTubeVideoBuffer(url);
  await writeFile(outputPath, buffer);
}

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

export async function POST(request: Request) {
  const requestId = randomUUID().substring(0, 8);
  const startTime = Date.now();
  const tempDir = join(tmpdir(), `bulk_${randomUUID()}`);

  try {
    const { allowed } = await verifyAdminOrBrandAccess();
    if (!allowed) {
      return NextResponse.json({ error: "Admin or brand access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { urls = [], submissionIds = [], options = {} } = body;
    const format = options.format === "audio" ? "mp3" : "mp4";

    const downloadQueue: { url: string; filename: string; isInstagram: boolean }[] = [];

    if (submissionIds && submissionIds.length > 0) {
      console.log(`[BULK-${requestId}] Resolving ${submissionIds.length} submission IDs`);
      const supabase = await createClient();
      const { data: submissions, error: submissionsError } = await supabase
        .from("submissions")
        .select(`
          id,
          content_link,
          platform,
          contests(title),
          users!creator_id(username)
        `)
        .in("id", submissionIds);

      if (submissionsError) {
        console.error(`[BULK-${requestId}] Database fetch error:`, submissionsError);
        return NextResponse.json({ error: "Failed to fetch submissions information" }, { status: 500 });
      }

      for (const sub of submissions || []) {
        if (!sub.content_link) continue;
        const username = (sub.users as any)?.username || "unknown";
        const contestTitle = (sub.contests as any)?.title || "contest";
        const cleanName = sanitizeFilename(`${username}_${contestTitle}_${sub.id}`);
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
        downloadQueue.push({
          url,
          filename: `video_${i + 1}.${format}`,
          isInstagram,
        });
      }
    }

    if (downloadQueue.length === 0) {
      return NextResponse.json({ error: "No valid URLs or submissions to download" }, { status: 400 });
    }

    await mkdir(tempDir, { recursive: true });

    const zippedFiles: { path: string; name: string }[] = [];
    const failedQueue: { url: string; error: string }[] = [];

    for (const item of downloadQueue) {
      const targetPath = join(tempDir, item.filename);
      try {
        console.log(`[BULK-${requestId}] Downloading: ${item.url} -> ${targetPath}`);
        await downloadVideoFile(item.url, targetPath, item.isInstagram);

        if (existsSync(targetPath)) {
          zippedFiles.push({ path: targetPath, name: item.filename });
        } else {
          failedQueue.push({ url: item.url, error: "Download completed but file was not generated." });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[BULK-${requestId}] Failed downloading ${item.url}:`, message);
        failedQueue.push({
          url: item.url,
          error: parseDownloadError(err, item.isInstagram),
        });
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

    console.log(`[BULK-${requestId}] Initiating file download stream after ${Date.now() - startTime}ms`);
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
    return NextResponse.json({ error: error.message || "Failed to initiate bulk download" }, { status: 500 });
  }
}
