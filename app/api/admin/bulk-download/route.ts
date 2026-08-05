import { NextResponse } from "next/server";
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
import {
  isAdminDownloadUser,
  MAX_BULK_DOWNLOAD_BYTES,
  MAX_BULK_VIDEO_DOWNLOADS,
  submissionOwnedByDownloadUser,
  verifyAdminOrBrandDownloadAccess,
} from "@/lib/video-download-auth";
import { buildViewsBasedVideoFilename } from "@/lib/utils";

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

function isSupportedVideoUrl(url: string): { ok: true; isInstagram: boolean } | { ok: false } {
  const isInstagram = url.includes("instagram.com");
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
  if (!isInstagram && !isYouTube) return { ok: false };
  return { ok: true, isInstagram };
}

async function downloadVideoFile(
  url: string,
  outputPath: string,
  isInstagram: boolean,
): Promise<void> {
  if (isInstagram) {
    await downloadInstagramVideoToFile(url, outputPath);
  } else {
    await downloadYouTubeVideoToFile(url, outputPath);
  }
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
    const access = await verifyAdminOrBrandDownloadAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error || "Admin or brand access required" },
        { status: 403 },
      );
    }

    const { user, supabase } = access;
    const body = await request.json().catch(() => ({}));
    const { urls = [], submissionIds = [], options = {} } = body as {
      urls?: unknown;
      submissionIds?: unknown;
      options?: { format?: string };
    };

    if (options?.format === "audio" || options?.format === "mp3") {
      return NextResponse.json(
        {
          error:
            "Audio-only downloads are not supported. Use format mp4 (default).",
        },
        { status: 400 },
      );
    }
    const format = "mp4";

    const submissionIdList = Array.isArray(submissionIds)
      ? submissionIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const urlList = Array.isArray(urls)
      ? urls.filter((url): url is string => typeof url === "string" && url.length > 0)
      : [];

    if (submissionIdList.length > MAX_BULK_VIDEO_DOWNLOADS) {
      return NextResponse.json(
        {
          error: `Too many submissions. Select at most ${MAX_BULK_VIDEO_DOWNLOADS} videos per bulk download.`,
          max: MAX_BULK_VIDEO_DOWNLOADS,
        },
        { status: 400 },
      );
    }

    // Raw URL proxy is admin-only (prevents advertiser RapidAPI / bandwidth abuse).
    if (urlList.length > 0 && !isAdminDownloadUser(user)) {
      return NextResponse.json(
        { error: "Custom URL bulk download is restricted to admins." },
        { status: 403 },
      );
    }

    if (urlList.length > MAX_BULK_VIDEO_DOWNLOADS) {
      return NextResponse.json(
        {
          error: `Too many URLs. Provide at most ${MAX_BULK_VIDEO_DOWNLOADS} URLs per bulk download.`,
          max: MAX_BULK_VIDEO_DOWNLOADS,
        },
        { status: 400 },
      );
    }

    const downloadQueue: { url: string; filename: string; isInstagram: boolean }[] = [];

    if (submissionIdList.length > 0) {
      console.log(`[BULK-${requestId}] Resolving ${submissionIdList.length} submission IDs`);
      const { data: submissions, error: submissionsError } = await supabase
        .from("submissions")
        .select(`
          id,
          content_link,
          platform,
          views,
          contests!inner(id, title, advertiser_id),
          users!creator_id(username)
        `)
        .in("id", submissionIdList);

      if (submissionsError) {
        console.error(`[BULK-${requestId}] Database fetch error:`, submissionsError);
        return NextResponse.json(
          { error: "Failed to fetch submissions information" },
          { status: 500 },
        );
      }

      const owned = (submissions || []).filter((sub) => {
        const advertiserId = (sub.contests as { advertiser_id?: string } | null)?.advertiser_id;
        return submissionOwnedByDownloadUser(user, advertiserId);
      });

      if (owned.length === 0) {
        return NextResponse.json(
          { error: "No accessible submissions found for download" },
          { status: 403 },
        );
      }

      if (owned.length < submissionIdList.length && !isAdminDownloadUser(user)) {
        console.warn(
          `[BULK-${requestId}] Dropped ${submissionIdList.length - owned.length} unauthorized submission(s)`,
        );
      }

      // Highest views first; filenames are view-based so Explorer sort stays useful.
      const ownedSorted = [...owned].sort(
        (a, b) => (Number(b.views) || 0) - (Number(a.views) || 0),
      );
      const usedFilenames = new Set<string>();

      for (const sub of ownedSorted) {
        if (!sub.content_link) continue;
        const supported = isSupportedVideoUrl(sub.content_link);
        if (!supported.ok) continue;

        let baseName = buildViewsBasedVideoFilename(sub.views);
        if (usedFilenames.has(`${baseName}.${format}`)) {
          baseName = buildViewsBasedVideoFilename(sub.views, String(sub.id).slice(0, 8));
        }
        usedFilenames.add(`${baseName}.${format}`);

        downloadQueue.push({
          url: sub.content_link,
          filename: `${baseName}.${format}`,
          isInstagram: supported.isInstagram,
        });
      }
    } else if (urlList.length > 0) {
      console.log(`[BULK-${requestId}] Resolving ${urlList.length} admin custom URLs`);
      for (let i = 0; i < urlList.length; i++) {
        const url = urlList[i];
        const supported = isSupportedVideoUrl(url);
        if (!supported.ok) continue;
        downloadQueue.push({
          url,
          filename: `video_${i + 1}.${format}`,
          isInstagram: supported.isInstagram,
        });
      }
    }

    if (downloadQueue.length === 0) {
      return NextResponse.json(
        { error: "No valid Instagram/YouTube submissions to download" },
        { status: 400 },
      );
    }

    await mkdir(tempDir, { recursive: true });

    const zippedFiles: { path: string; name: string }[] = [];
    const failedQueue: { url: string; error: string }[] = [];
    let totalBytes = 0;

    for (const item of downloadQueue) {
      if (totalBytes >= MAX_BULK_DOWNLOAD_BYTES) {
        failedQueue.push({
          url: item.url,
          error: `Skipped: bulk download size limit (${MAX_BULK_DOWNLOAD_BYTES} bytes) reached.`,
        });
        continue;
      }

      const targetPath = join(tempDir, item.filename);
      try {
        console.log(`[BULK-${requestId}] Downloading: ${item.url} -> ${targetPath}`);
        await downloadVideoFile(item.url, targetPath, item.isInstagram);

        if (existsSync(targetPath)) {
          const fileStat = await stat(targetPath);
          if (fileStat.size > 0) {
            if (totalBytes + fileStat.size > MAX_BULK_DOWNLOAD_BYTES) {
              await rm(targetPath, { force: true }).catch(() => {});
              failedQueue.push({
                url: item.url,
                error: `Skipped: file would exceed bulk download size limit.`,
              });
              continue;
            }
            totalBytes += fileStat.size;
            zippedFiles.push({ path: targetPath, name: item.filename });
          } else {
            failedQueue.push({
              url: item.url,
              error: "Download completed but file was empty.",
            });
          }
        } else {
          failedQueue.push({
            url: item.url,
            error: "Download completed but file was not generated.",
          });
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

    if (zippedFiles.length === 0) {
      await cleanup();
      return NextResponse.json(
        {
          error: "No files could be downloaded",
          failures: failedQueue,
        },
        { status: 400 },
      );
    }

    const failedReport =
      failedQueue.length > 0
        ? failedQueue
            .map((f, idx) => `${idx + 1}. URL: ${f.url}\n   Error: ${f.error}`)
            .join("\n\n")
        : null;

    // Bounded batches keep an in-memory ZIP response acceptable for Next.js.
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
        "X-Bulk-Downloaded": String(zippedFiles.length),
        "X-Bulk-Failed": String(failedQueue.length),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initiate bulk download";
    console.error(`[BULK-${requestId}] Fatal bulk downloader error:`, error);
    await cleanup();
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
