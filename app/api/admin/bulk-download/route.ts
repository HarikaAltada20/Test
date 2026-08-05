import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createWriteStream, existsSync } from "fs";
import { mkdir, readFile, rm, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { ZipArchive } from "archiver";
import {
  downloadInstagramVideoToFile,
  InstagramDownloadError,
} from "@/lib/instagram-download/download";
import {
  downloadYouTubeVideoToFile,
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
  if (isInstagram) {
    await downloadInstagramVideoToFile(url, outputPath);
  } else {
    await downloadYouTubeVideoToFile(url, outputPath);
  }
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

async function buildZipFile(
  zipPath: string,
  files: { path: string; name: string }[],
  failedReport: string | null,
): Promise<void> {
  const output = createWriteStream(zipPath);
  // MP4s are already compressed — store avoids CPU and speeds up zip.
  const archive = new ZipArchive({ store: true });

  await new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);

    for (const file of files) {
      archive.file(file.path, { name: file.name });
    }

    if (failedReport) {
      archive.append(failedReport, { name: "failed_downloads_report.txt" });
    }

    void archive.finalize();
  });
}

export async function POST(request: Request) {
  const requestId = randomUUID().substring(0, 8);
  const startTime = Date.now();
  const tempDir = join(tmpdir(), `bulk_${randomUUID()}`);
  let cleanedUp = false;

  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    console.log(`[BULK-${requestId}] Clean up temp folder: ${tempDir}`);
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  };

  try {
    const { allowed } = await verifyAdminOrBrandAccess();
    if (!allowed) {
      return NextResponse.json({ error: "Admin or brand access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { urls = [], submissionIds = [], options = {} } = body;
    // Only muxed video is supported (IG GraphQL + YTStream); do not claim .mp3.
    if (options.format === "audio" || options.format === "mp3") {
      return NextResponse.json(
        {
          error:
            "Audio-only downloads are not supported. Use format mp4 (default).",
        },
        { status: 400 }
      );
    }
    const format = "mp4";

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
          const fileStat = await stat(targetPath);
          if (fileStat.size > 0) {
            zippedFiles.push({ path: targetPath, name: item.filename });
          } else {
            failedQueue.push({ url: item.url, error: "Download completed but file was empty." });
          }
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

    if (zippedFiles.length === 0 && failedQueue.length === 0) {
      await cleanup();
      return NextResponse.json({ error: "No files to download" }, { status: 400 });
    }

    const failedReport =
      failedQueue.length > 0
        ? failedQueue
            .map((f, idx) => `${idx + 1}. URL: ${f.url}\n   Error: ${f.error}`)
            .join("\n\n")
        : null;

    // Write ZIP to disk, then load into memory for the response.
    // Streaming via Readable.toWeb(createReadStream) races with client abort in
    // Next.js and throws "Controller is already closed" / ResponseAborted.
    const zipPath = join(tempDir, `bulk_${requestId}.zip`);
    console.log(`[BULK-${requestId}] Building ZIP with ${zippedFiles.length} file(s)`);
    await buildZipFile(zipPath, zippedFiles, failedReport);

    const zipBuffer = await readFile(zipPath);
    await cleanup();

    console.log(
      `[BULK-${requestId}] Returning ZIP (${zipBuffer.byteLength} bytes) after ${Date.now() - startTime}ms`,
    );

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="bulk_download_${requestId}.zip"`,
        "Content-Length": String(zipBuffer.byteLength),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error(`[BULK-${requestId}] Fatal bulk downloader error:`, error);
    await cleanup();
    return NextResponse.json({ error: error.message || "Failed to initiate bulk download" }, { status: 500 });
  }
}
