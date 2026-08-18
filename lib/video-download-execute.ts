import { existsSync } from "fs";
import { mkdir, rm, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
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
  isWorkerTimeBudgetExhausted,
  processSequentialDownloadQueue,
  VIDEO_DOWNLOAD_WORKER_BUDGET_MS,
  WORKER_TIME_BUDGET_SKIP_MESSAGE,
  withDownloadRetries,
} from "@/lib/video-download-queue";
import type { VideoDownloadItem } from "@/lib/queue/video-download-queue";
import { buildZipFile } from "@/lib/video-download-zip";

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

export type ExecuteVideoDownloadResult = {
  zipPath: string | null;
  zipBytes: number;
  downloaded: number;
  failures: { url: string; error: string }[];
  /** Items skipped so this worker could zip; the processor requeues these on the same job. */
  deferredItems: VideoDownloadItem[];
  cleanup: () => Promise<void>;
};

export async function executeQueuedVideoDownloads(options: {
  items: VideoDownloadItem[];
  requestId?: string;
  startedAtMs?: number;
  budgetMs?: number;
  onProgress?: (info: { completed: number; failed: number }) => Promise<void> | void;
}): Promise<ExecuteVideoDownloadResult> {
  const requestId = options.requestId || randomUUID().substring(0, 8);
  const startedAtMs = options.startedAtMs ?? Date.now();
  const budgetMs = options.budgetMs ?? VIDEO_DOWNLOAD_WORKER_BUDGET_MS;
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
    deferredItems: VideoDownloadItem[] = [],
  ): ExecuteVideoDownloadResult => ({
    zipPath: null,
    zipBytes: 0,
    downloaded: 0,
    failures,
    deferredItems,
    cleanup,
  });

  const zippedFiles: { path: string; name: string }[] = [];
  const failedQueue: { url: string; error: string }[] = [];
  const deferredItems: VideoDownloadItem[] = [];
  let totalBytes = 0;
  let budgetExhausted = false;

  try {
    await processSequentialDownloadQueue(
      options.items,
      async (item, index) => {
        if (
          budgetExhausted ||
          isWorkerTimeBudgetExhausted(startedAtMs, Date.now(), budgetMs)
        ) {
          budgetExhausted = true;
          deferredItems.push(item);
          await options.onProgress?.({
            completed: zippedFiles.length,
            failed: failedQueue.length,
          });
          return;
        }

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
          await withDownloadRetries(
            () => downloadVideoFile(item.url, targetPath, item.isInstagram),
            {
              shouldAbort: () =>
                isWorkerTimeBudgetExhausted(startedAtMs, Date.now(), budgetMs),
            },
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
          if (
            message === WORKER_TIME_BUDGET_SKIP_MESSAGE ||
            isWorkerTimeBudgetExhausted(startedAtMs, Date.now(), budgetMs)
          ) {
            budgetExhausted = true;
            deferredItems.push(item);
          } else {
            console.error(`[BULK-${requestId}] Failed downloading ${item.url}:`, message);
            failedQueue.push({
              url: item.url,
              error: parseDownloadError(err, item.isInstagram),
            });
          }
        }

        await options.onProgress?.({
          completed: zippedFiles.length,
          failed: failedQueue.length,
        });
      },
      { shouldSkipGap: () => budgetExhausted },
    );

    if (zippedFiles.length === 0) {
      return emptyResult(failedQueue, deferredItems);
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
      deferredItems,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
