/**
 * Process Instagram/YouTube bulk video download jobs from Redis.
 * Triggered by QStash after enqueue, Vercel cron recovery, or a local CRON_SECRET POST.
 */

import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  authorizeProcessVideoDownloadQueue,
  getQStashPublishBaseUrl,
  isLoopbackUrl,
  isQStashEnabled,
  resolveLocalAwareBaseUrl,
  triggerProcessVideoDownloadQueue,
} from "@/lib/qstash";
import {
  getVideoDownloadJobStatus,
  isVideoDownloadQueueEnabled,
  popVideoDownloadJob,
  recoverVideoDownloadProcessingToQueue,
  removeVideoDownloadFromProcessing,
  retryOrDeadLetterVideoDownload,
  setVideoDownloadJobStatus,
  VIDEO_DOWNLOAD_STORAGE_BUCKET,
  type VideoDownloadJobStatus,
} from "@/lib/queue/video-download-queue";
import { executeQueuedVideoDownloads } from "@/lib/video-download-execute";
import { isRetryableDownloadError } from "@/lib/video-download-queue";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function kickNext(baseUrl: string, localUrl: string, delaySeconds = 2) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.CRON_SECRET) {
    headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;
  }
  const fallback = () =>
    fetch(`${localUrl}/api/cron/process-video-download-queue`, {
      method: "POST",
      headers,
      body: "{}",
    }).catch((e) =>
      console.error("[process-video-download-queue] Self-trigger fallback failed:", e),
    );

  if (isQStashEnabled() && !isLoopbackUrl(baseUrl)) {
    triggerProcessVideoDownloadQueue(baseUrl, { delaySeconds })
      .then((res) => {
        if (res?.error) void fallback();
      })
      .catch(() => fallback());
    return;
  }
  void fallback();
}

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
  return handleRequest(request);
}

async function handleRequest(request: Request): Promise<NextResponse> {
  const baseUrl = getQStashPublishBaseUrl(request);
  const localUrl = resolveLocalAwareBaseUrl(request);

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
    return NextResponse.json({ processed: 0, message: "Queue empty" });
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

  try {
    const result = await executeQueuedVideoDownloads({
      items: job.items,
      requestId: job.jobId.slice(0, 8),
      onProgress: async ({ completed, failed }) => {
        await patchStatus({ status: "processing", completed, failed });
      },
    });

    if (result.downloaded === 0) {
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
      kickNext(baseUrl, localUrl, 2);
      return NextResponse.json({
        processed: 1,
        jobId: job.jobId,
        downloaded: 0,
        failed: result.failures.length || job.items.length,
      });
    }

    // Store ZIP locally to avoid Supabase Storage object size limits.
    // Fall back to Supabase upload only for small files if local write fails.
    const localDir = join(tmpdir(), "bulk_zip_ready");
    await mkdir(localDir, { recursive: true });
    const localZipPath = join(localDir, `${job.jobId}.zip`);
    let storagePath: string | undefined;

    try {
      await writeFile(localZipPath, result.zipBuffer);
    } catch (localErr) {
      console.error("[process-video-download-queue] Local write failed, trying Supabase:", localErr);
      const supabase = createAdminClient();
      const remotePath = `video-downloads/${job.userId}/${job.jobId}.zip`;
      const upload = await supabase.storage
        .from(VIDEO_DOWNLOAD_STORAGE_BUCKET)
        .upload(remotePath, result.zipBuffer, {
          contentType: "application/zip",
          upsert: true,
        });
      if (upload.error) {
        throw new Error(upload.error.message || "Failed to store ZIP archive");
      }
      storagePath = remotePath;
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
      localZipPath: storagePath ? undefined : localZipPath,
      zipBytes: result.zipBuffer.byteLength,
      zipFilename: existing?.zipFilename || job.zipFilename,
      createdAt: existing?.createdAt || now(),
      updatedAt: now(),
    });

    await removeVideoDownloadFromProcessing(rawJobString);
    kickNext(baseUrl, localUrl, 2);

    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      downloaded: result.downloaded,
      failed: result.failures.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Video download failed";
    console.error(`[process-video-download-queue] Job ${job.jobId} failed:`, message);
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
      kickNext(baseUrl, localUrl, 2);
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
      kickNext(baseUrl, localUrl, 5);
    } else if (!retry.deadLettered) {
      await removeVideoDownloadFromProcessing(rawJobString);
      await patchStatus({
        status: "failed",
        errors: [message],
        failed: job.items.length,
      });
    }
    return NextResponse.json({ processed: 1, error: message, retry }, { status: 200 });
  }
}
