/**
 * Process Instagram/YouTube bulk video download jobs from Redis.
 *
 * Triggers:
 * - QStash one-shot after enqueue / after each job (primary)
 * - QStash schedule every 5 minutes (stuck-job recovery + ZIP cleanup)
 * - Vercel Cron once daily (backup if QStash is down) — see vercel.json
 * - Local CRON_SECRET POST
 */

import { mkdir, rm, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { NextResponse } from "next/server";
import {
  authorizeProcessVideoDownloadQueue,
  ensureProcessVideoDownloadQueueSchedule,
} from "@/lib/qstash";
import {
  getVideoDownloadJobStatus,
  isVideoDownloadQueueEnabled,
  popVideoDownloadJob,
  recoverVideoDownloadProcessingToQueue,
  removeVideoDownloadFromProcessing,
  requireVideoDownloadRemainderRequeued,
  retryOrDeadLetterVideoDownload,
  requeueVideoDownloadRemainder,
  resolveVideoDownloadTerminalStatus,
  setVideoDownloadJobStatus,
  videoDownloadStoragePath,
  type VideoDownloadJob,
  type VideoDownloadJobStatus,
} from "@/lib/queue/video-download-queue";
import { executeQueuedVideoDownloads } from "@/lib/video-download-execute";
import { kickProcessVideoDownloadQueue } from "@/lib/video-download-kick";
import {
  cleanupExpiredVideoDownloadZips,
  downloadVideoDownloadZip,
  ensureVideoDownloadBucket,
  uploadVideoDownloadZip,
} from "@/lib/video-download-storage";
import { mergeVideoDownloadZips } from "@/lib/video-download-zip";
import {
  isRetryableDownloadError,
  shouldRetryZeroDownload,
} from "@/lib/video-download-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authorized = await authorizeProcessVideoDownloadQueue(request, "");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRequest(request);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorized = await authorizeProcessVideoDownloadQueue(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viaQStash = !!request.headers.get("Upstash-Signature");
  console.log(
    `[process-video-download-queue] Invoked by ${viaQStash ? "QStash" : "CRON/direct"}`,
  );

  const ensured = await ensureProcessVideoDownloadQueueSchedule();
  if (ensured.error) {
    console.warn(
      "[process-video-download-queue] schedule ensure:",
      ensured.error,
    );
  }

  return handleRequest(request);
}

async function handleRequest(request: Request): Promise<NextResponse> {
  if (!isVideoDownloadQueueEnabled()) {
    return NextResponse.json(
      { processed: 0, message: "Video download queue not configured" },
      { status: 200 },
    );
  }

  if (Math.random() < 0.15) {
    await recoverVideoDownloadProcessingToQueue({ maxToMove: 25 });
  }

  let popped = await popVideoDownloadJob();
  if (!popped) {
    const recovered = await recoverVideoDownloadProcessingToQueue({ maxToMove: 25 });
    if (recovered.moved > 0) {
      popped = await popVideoDownloadJob();
    }
  }
  if (!popped) {
    const cleaned = await cleanupExpiredVideoDownloadZips({ maxDeletes: 100 });
    return NextResponse.json({
      processed: 0,
      message: "Queue empty",
      cleaned: cleaned.deleted,
    });
  }

  const { job, raw: rawJobString } = popped;
  const existing = await getVideoDownloadJobStatus(job.jobId);
  const completedBase = job.completedSoFar ?? existing?.completed ?? 0;
  const failedBase = job.failedSoFar ?? existing?.failed ?? 0;
  const usedBytes = job.zipBytesSoFar ?? existing?.zipBytes ?? 0;
  const originalTotal =
    existing?.total || job.originalTotal || job.items.length;
  const now = () => new Date().toISOString();
  const patchStatus = async (
    partial: Partial<VideoDownloadJobStatus>,
  ): Promise<void> => {
    const current = (await getVideoDownloadJobStatus(job.jobId)) || existing;
    await setVideoDownloadJobStatus({
      jobId: job.jobId,
      userId: job.userId,
      status: "processing",
      total: current?.total || originalTotal,
      completed: current?.completed ?? 0,
      failed: current?.failed ?? 0,
      errors: current?.errors ?? [],
      storagePath: current?.storagePath,
      zipBytes: current?.zipBytes,
      zipFilename: current?.zipFilename || job.zipFilename,
      createdAt: current?.createdAt || now(),
      ...partial,
      updatedAt: now(),
    });
  };
  const finishTerminal = async (options: {
    completed: number;
    failed: number;
    errors: string[];
  }): Promise<"ready" | "failed"> => {
    const terminal = resolveVideoDownloadTerminalStatus({
      completed: options.completed,
      failed: options.failed,
      total: originalTotal,
      errors: options.errors,
      partialStoragePath: job.partialStoragePath || existing?.storagePath,
      zipBytes: job.zipBytesSoFar ?? existing?.zipBytes,
    });
    await setVideoDownloadJobStatus({
      jobId: job.jobId,
      userId: job.userId,
      total: originalTotal,
      zipFilename: existing?.zipFilename || job.zipFilename,
      createdAt: existing?.createdAt || now(),
      updatedAt: now(),
      ...terminal,
    });
    await removeVideoDownloadFromProcessing(rawJobString);
    return terminal.status;
  };

  await patchStatus({ status: "processing", total: originalTotal });

  let cleanupTemp = async () => {};

  try {
    const result = await executeQueuedVideoDownloads({
      items: job.items,
      requestId: job.jobId.slice(0, 8),
      usedBytes,
      onProgress: async ({ completed, failed }) => {
        await patchStatus({
          status: "processing",
          completed: completedBase + completed,
          failed: failedBase + failed,
          total: originalTotal,
        });
      },
    });
    cleanupTemp = result.cleanup;

    const accumulatedFailed = failedBase + result.failures.length;
    const accumulatedErrors = [
      ...(job.errorsSoFar ?? existing?.errors ?? []),
      ...result.failures.map((failure) => failure.error),
    ].slice(0, 20);

    if (result.downloaded === 0 || !result.zipPath) {
      await cleanupTemp();
      if (result.deferredItems.length > 0 && job.partialStoragePath) {
        const remainder = await requeueVideoDownloadRemainder({
          rawJobString,
          job: buildRemainderJob({
            job,
            items: result.deferredItems,
            partialStoragePath: job.partialStoragePath,
            originalTotal,
            completedSoFar: completedBase,
            failedSoFar: accumulatedFailed,
            errorsSoFar: accumulatedErrors,
            zipBytesSoFar: usedBytes,
          }),
        });
        requireVideoDownloadRemainderRequeued(
          result.deferredItems.length,
          !remainder.error,
        );
        await kickProcessVideoDownloadQueue(request, { delaySeconds: 2 });
        return NextResponse.json({
          processed: 1,
          jobId: job.jobId,
          downloaded: 0,
          remainder: true,
        });
      }
      const retryable = shouldRetryZeroDownload(
        result.failures,
        result.deferredItems.length,
      );
      if (retryable) {
        const retry = await retryOrDeadLetterVideoDownload({
          rawJobString,
          reason:
            result.failures[0]?.error ||
            "No files could be downloaded; retrying",
        });
        if (retry.requeued) {
          await kickProcessVideoDownloadQueue(request, { delaySeconds: 5 });
        } else {
          if (!retry.deadLettered) {
            await finishTerminal({
              completed: completedBase,
              failed: accumulatedFailed || originalTotal,
              errors: result.failures.map((f) => f.error).slice(0, 5),
            });
          }
          await kickProcessVideoDownloadQueue(request, { delaySeconds: 2 });
        }
        return NextResponse.json({
          processed: 1,
          jobId: job.jobId,
          downloaded: 0,
          retry,
        });
      }

      const terminalStatus = await finishTerminal({
        completed: completedBase,
        failed: accumulatedFailed || originalTotal,
        errors: result.failures.map((f) => f.error).slice(0, 5),
      });
      console.log(
        `[process-video-download-queue] Job ${job.jobId} finished with 0 new downloads; status=${terminalStatus}`,
      );
      await kickProcessVideoDownloadQueue(request, { delaySeconds: 2 });
      return NextResponse.json({
        processed: 1,
        jobId: job.jobId,
        downloaded: completedBase,
        failed: accumulatedFailed || originalTotal,
        status: terminalStatus,
      });
    }

    // Always persist to shared private storage. /tmp is per-instance on Vercel,
    // so a later /file request on a different lambda would 410 a local ZIP.
    await ensureVideoDownloadBucket();
    const storagePath = videoDownloadStoragePath(job.userId, job.jobId);
    let zipPath = result.zipPath;
    let zipBytes = result.zipBytes;
    const mergeRoot = join(tmpdir(), `merge_${job.jobId}`);

    if (job.partialStoragePath) {
      const existingLocal = join(mergeRoot, "existing.zip");
      const mergedLocal = join(mergeRoot, "merged.zip");
      await rm(mergeRoot, { recursive: true, force: true }).catch(() => {});
      await mkdir(mergeRoot, { recursive: true });
      const downloadedExisting = await downloadVideoDownloadZip({
        storagePath: job.partialStoragePath,
        destPath: existingLocal,
      });
      if (downloadedExisting.error) {
        throw new Error(downloadedExisting.error || "Failed to load existing ZIP archive");
      }
      await mergeVideoDownloadZips({
        existingZipPath: existingLocal,
        newZipPath: zipPath,
        outputZipPath: mergedLocal,
        tempDir: mergeRoot,
      });
      zipPath = mergedLocal;
      zipBytes = (await stat(mergedLocal)).size;
    }

    console.log(
      `[process-video-download-queue] Uploading ZIP job=${job.jobId} bytes=${zipBytes}`,
    );
    const upload = await uploadVideoDownloadZip({
      storagePath,
      zipPath,
    });
    await rm(mergeRoot, { recursive: true, force: true }).catch(() => {});
    if (upload.error) {
      throw new Error(upload.error || "Failed to store ZIP archive");
    }

    const completed = completedBase + result.downloaded;
    if (result.deferredItems.length > 0) {
      const remainder = await requeueVideoDownloadRemainder({
        rawJobString,
        job: buildRemainderJob({
          job,
          items: result.deferredItems,
          partialStoragePath: storagePath,
          originalTotal,
          completedSoFar: completed,
          failedSoFar: accumulatedFailed,
          errorsSoFar: accumulatedErrors,
          zipBytesSoFar: zipBytes,
        }),
      });
      requireVideoDownloadRemainderRequeued(
        result.deferredItems.length,
        !remainder.error,
      );
      await cleanupTemp();
      await kickProcessVideoDownloadQueue(request, { delaySeconds: 2 });
      return NextResponse.json({
        processed: 1,
        jobId: job.jobId,
        downloaded: result.downloaded,
        remainder: true,
      });
    }

    await setVideoDownloadJobStatus({
      jobId: job.jobId,
      userId: job.userId,
      status: "ready",
      total: originalTotal,
      completed,
      failed: accumulatedFailed,
      errors: accumulatedErrors,
      storagePath,
      zipBytes,
      zipFilename: existing?.zipFilename || job.zipFilename,
      createdAt: existing?.createdAt || now(),
      updatedAt: now(),
    });

    await removeVideoDownloadFromProcessing(rawJobString);
    await cleanupTemp();
    await cleanupExpiredVideoDownloadZips({ maxDeletes: 25 });
    await kickProcessVideoDownloadQueue(request, { delaySeconds: 2 });

    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      downloaded: completed,
      failed: accumulatedFailed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Video download failed";
    console.error(`[process-video-download-queue] Job ${job.jobId} failed:`, message);
    await cleanupTemp();
    const messageLower = message.toLowerCase();
    const retryable =
      isRetryableDownloadError(message) ||
      messageLower.includes("failed to store") ||
      messageLower.includes("zip archive") ||
      messageLower.includes("leftover");
    if (!retryable) {
      await finishTerminal({
        completed: completedBase,
        failed: Math.max(failedBase, job.items.length),
        errors: [message],
      });
      await kickProcessVideoDownloadQueue(request, { delaySeconds: 2 });
      return NextResponse.json({
        processed: 1,
        jobId: job.jobId,
        error: message,
        retried: false,
      });
    }
    const retry = await retryOrDeadLetterVideoDownload({
      rawJobString,
      reason: message,
    });
    if (retry.requeued) {
      await kickProcessVideoDownloadQueue(request, { delaySeconds: 5 });
    } else {
      if (!retry.deadLettered) {
        await finishTerminal({
          completed: completedBase,
          failed: Math.max(failedBase, job.items.length),
          errors: [message],
        });
      }
      await kickProcessVideoDownloadQueue(request, { delaySeconds: 2 });
    }
    return NextResponse.json({ processed: 1, error: message, retry }, { status: 200 });
  }
}

function buildRemainderJob(options: {
  job: VideoDownloadJob;
  items: VideoDownloadJob["items"];
  partialStoragePath: string;
  originalTotal: number;
  completedSoFar: number;
  failedSoFar: number;
  errorsSoFar: string[];
  zipBytesSoFar: number;
}): VideoDownloadJob {
  return {
    jobId: options.job.jobId,
    userId: options.job.userId,
    items: options.items,
    zipFilename: options.job.zipFilename,
    partialStoragePath: options.partialStoragePath,
    originalTotal: options.originalTotal,
    completedSoFar: options.completedSoFar,
    failedSoFar: options.failedSoFar,
    errorsSoFar: options.errorsSoFar,
    zipBytesSoFar: options.zipBytesSoFar,
  };
}
