/**
 * Process Instagram/YouTube bulk video download jobs from Redis.
 *
 * Triggers:
 * - QStash one-shot after enqueue / after each job (primary)
 * - QStash schedule every 5 minutes (stuck-job recovery + ZIP cleanup)
 * - Vercel Cron once daily (backup if QStash is down) — see vercel.json
 * - Local CRON_SECRET POST
 */

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  authorizeProcessVideoDownloadQueue,
  ensureProcessVideoDownloadQueueSchedule,
} from "@/lib/qstash";
import {
  enqueueVideoDownloadJob,
  getVideoDownloadJobStatus,
  isVideoDownloadQueueEnabled,
  popVideoDownloadJob,
  recoverVideoDownloadProcessingToQueue,
  removeVideoDownloadFromProcessing,
  retryOrDeadLetterVideoDownload,
  setVideoDownloadJobStatus,
  videoDownloadStoragePath,
  type VideoDownloadJobStatus,
} from "@/lib/queue/video-download-queue";
import { executeQueuedVideoDownloads } from "@/lib/video-download-execute";
import { kickProcessVideoDownloadQueue } from "@/lib/video-download-kick";
import {
  cleanupExpiredVideoDownloadZips,
  ensureVideoDownloadBucket,
  uploadVideoDownloadZip,
} from "@/lib/video-download-storage";
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
  const now = () => new Date().toISOString();
  const patchStatus = async (
    partial: Partial<VideoDownloadJobStatus>,
  ): Promise<void> => {
    const current = (await getVideoDownloadJobStatus(job.jobId)) || existing;
    await setVideoDownloadJobStatus({
      jobId: job.jobId,
      userId: job.userId,
      status: "processing",
      total: current?.total || job.items.length,
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

  await patchStatus({ status: "processing" });

  let cleanupTemp = async () => {};

  try {
    const result = await executeQueuedVideoDownloads({
      items: job.items,
      requestId: job.jobId.slice(0, 8),
      onProgress: async ({ completed, failed }) => {
        await patchStatus({ status: "processing", completed, failed });
      },
    });
    cleanupTemp = result.cleanup;

    if (result.downloaded === 0 || !result.zipPath) {
      await cleanupTemp();
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
            await removeVideoDownloadFromProcessing(rawJobString);
            await patchStatus({
              status: "failed",
              errors: result.failures.map((f) => f.error).slice(0, 5),
              completed: 0,
              failed: result.failures.length || job.items.length,
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

      await setVideoDownloadJobStatus({
        jobId: job.jobId,
        userId: job.userId,
        status: "failed",
        total: existing?.total || job.items.length,
        completed: 0,
        failed: result.failures.length || job.items.length,
        errors: result.failures.map((f) => f.error).slice(0, 5),
        zipFilename: existing?.zipFilename || job.zipFilename,
        createdAt: existing?.createdAt || now(),
        updatedAt: now(),
      });
      await removeVideoDownloadFromProcessing(rawJobString);
      console.log(
        `[process-video-download-queue] Job ${job.jobId} finished with 0 downloads; not retrying`,
      );
      await kickProcessVideoDownloadQueue(request, { delaySeconds: 2 });
      return NextResponse.json({
        processed: 1,
        jobId: job.jobId,
        downloaded: 0,
        failed: result.failures.length || job.items.length,
      });
    }

    // Always persist to shared private storage. /tmp is per-instance on Vercel,
    // so a later /file request on a different lambda would 410 a local ZIP.
    await ensureVideoDownloadBucket();
    const storagePath = videoDownloadStoragePath(job.userId, job.jobId);
    const upload = await uploadVideoDownloadZip({
      storagePath,
      zipPath: result.zipPath,
    });
    if (upload.error) {
      throw new Error(upload.error || "Failed to store ZIP archive");
    }

    let continuationJobId: string | undefined;
    if (result.deferredItems.length > 0) {
      const nextJobId = randomUUID();
      const enqueued = await enqueueVideoDownloadJob(
        {
          jobId: nextJobId,
          userId: job.userId,
          items: result.deferredItems,
          zipFilename: job.zipFilename,
          attempt: 0,
        },
        { bypassActiveJobLimit: true },
      );
      if (enqueued.error) {
        console.warn(
          `[process-video-download-queue] Could not enqueue leftover videos for ${job.jobId}:`,
          enqueued.error,
        );
      } else {
        continuationJobId = nextJobId;
      }
    }

    await setVideoDownloadJobStatus({
      jobId: job.jobId,
      userId: job.userId,
      status: "ready",
      total: existing?.total || job.items.length,
      completed: result.downloaded,
      failed: result.failures.length,
      errors: result.failures.map((f) => f.error),
      storagePath,
      zipBytes: result.zipBytes,
      zipFilename: existing?.zipFilename || job.zipFilename,
      continuationJobId,
      createdAt: existing?.createdAt || now(),
      updatedAt: now(),
    });

    await removeVideoDownloadFromProcessing(rawJobString);
    await cleanupTemp();
    await kickProcessVideoDownloadQueue(request, { delaySeconds: 2 });

    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      downloaded: result.downloaded,
      failed: result.failures.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Video download failed";
    console.error(`[process-video-download-queue] Job ${job.jobId} failed:`, message);
    await cleanupTemp();
    const messageLower = message.toLowerCase();
    const retryable =
      isRetryableDownloadError(message) ||
      messageLower.includes("failed to store") ||
      messageLower.includes("zip archive");
    if (!retryable) {
      await removeVideoDownloadFromProcessing(rawJobString);
      await patchStatus({
        status: "failed",
        errors: [message],
        completed: 0,
        failed: job.items.length,
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
        await removeVideoDownloadFromProcessing(rawJobString);
        await patchStatus({
          status: "failed",
          errors: [message],
          failed: job.items.length,
        });
      }
      await kickProcessVideoDownloadQueue(request, { delaySeconds: 2 });
    }
    return NextResponse.json({ processed: 1, error: message, retry }, { status: 200 });
  }
}
