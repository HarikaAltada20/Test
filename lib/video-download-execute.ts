import { createWriteStream, existsSync } from "fs";
import { mkdir, rm, stat } from "fs/promises";
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
import { MAX_BULK_DOWNLOAD_BYTES } from "@/lib/video-download-auth";
import {
  processSequentialDownloadQueue,
  withDownloadRetries,
} from "@/lib/video-download-queue";
import type { VideoDownloadItem } from "@/lib/queue/video-download-queue";

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

export type ExecuteVideoDownloadResult = {
  zipPath: string | null;
  zipBytes: number;
  downloaded: number;
  failures: { url: string; error: string }[];
  cleanup: () => Promise<void>;
};

export async function executeQueuedVideoDownloads(options: {
  items: VideoDownloadItem[];
  requestId?: string;
  onProgress?: (info: { completed: number; failed: number }) => Promise<void> | void;
}): Promise<ExecuteVideoDownloadResult> {
  const requestId = options.requestId || randomUUID().substring(0, 8);
  const tempDir = join(tmpdir(), `bulk_${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  };

  const emptyResult = (
    failures: { url: string; error: string }[],
  ): ExecuteVideoDownloadResult => ({
    zipPath: null,
    zipBytes: 0,
    downloaded: 0,
    failures,
    cleanup,
  });

  const zippedFiles: { path: string; name: string }[] = [];
  const failedQueue: { url: string; error: string }[] = [];
  let totalBytes = 0;

  try {
    await processSequentialDownloadQueue(options.items, async (item, index) => {
      if (totalBytes >= MAX_BULK_DOWNLOAD_BYTES) {
        failedQueue.push({
          url: item.url,
          error: `Skipped: bulk download size limit (${MAX_BULK_DOWNLOAD_BYTES} bytes) reached.`,
        });
        await options.onProgress?.({
          completed: zippedFiles.length,
          failed: failedQueue.length,
        });
        return;
      }

      const targetPath = join(tempDir, item.filename);
      try {
        console.log(
          `[BULK-${requestId}] Queue ${index + 1}/${options.items.length}: ${item.url}`,
        );
        await withDownloadRetries(() =>
          downloadVideoFile(item.url, targetPath, item.isInstagram),
        );

        if (existsSync(targetPath)) {
          const fileStat = await stat(targetPath);
          if (fileStat.size > 0) {
            if (totalBytes + fileStat.size > MAX_BULK_DOWNLOAD_BYTES) {
              await rm(targetPath, { force: true }).catch(() => {});
              failedQueue.push({
                url: item.url,
                error: "Skipped: file would exceed bulk download size limit.",
              });
            } else {
              totalBytes += fileStat.size;
              zippedFiles.push({ path: targetPath, name: item.filename });
            }
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

      await options.onProgress?.({
        completed: zippedFiles.length,
        failed: failedQueue.length,
      });
    });

    if (zippedFiles.length === 0) {
      return emptyResult(failedQueue);
    }

    const failedReport =
      failedQueue.length > 0
        ? failedQueue
            .map((f, idx) => `${idx + 1}. URL: ${f.url}\n   Error: ${f.error}`)
            .join("\n\n")
        : null;

    const zipPath = join(tempDir, `bulk_${requestId}.zip`);
    await buildZipFile(zipPath, zippedFiles, failedReport);
    // Drop source videos so peak disk is the ZIP, not ZIP + every MP4.
    await Promise.all(
      zippedFiles.map((file) => rm(file.path, { force: true }).catch(() => {})),
    );
    const zipStat = await stat(zipPath);

    return {
      zipPath,
      zipBytes: zipStat.size,
      downloaded: zippedFiles.length,
      failures: failedQueue,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
