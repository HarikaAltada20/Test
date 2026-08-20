/**
 * Process bulk submission moderation queue (verified / pending / rejected):
 * pop one Redis batch job, call batch worker, update progress;
 * if more remain enqueue next batch + trigger self (QStash + CRON fallback).
 * On batch failure: retry up to 3 attempts, then dead-letter (YouTube-style).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  BULK_MODERATION_BATCH_SIZE,
  enqueueBulkSubmissionModerationJob,
  popBulkSubmissionModerationJob,
  recoverBulkSubmissionModerationProcessingToQueue,
  removeBulkSubmissionModerationFromProcessing,
  retryOrDeadLetterBulkSubmissionModeration,
  isBulkSubmissionModerationQueueEnabled,
  type BulkSubmissionModerationQueueJob,
} from "@/lib/queue/bulk-submission-moderation-queue";
import {
  authorizeProcessBulkVerifyQueue,
  isQStashEnabled,
  triggerProcessBulkVerifyQueue,
} from "@/lib/qstash";
import { reconcileCreatorTotalViews } from "@/lib/creator-total-views";
import { persistContestBudgetSpent } from "@/lib/persist-contest-budget-spent";
import { refreshContestStats } from "@/lib/contest-stats";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CHUNK_PAUSE_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBaseUrlFromRequest(request: Request): string {
  try {
    const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (xfHost && xfProto) return `${xfProto}://${xfHost}`;
    return new URL(request.url).origin;
  } catch {
    const url = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
    return url.replace(/\/$/, "");
  }
}

function triggerNextProcessor(baseUrl: string) {
  const cronSecret = process.env.CRON_SECRET;
  const doFetch = () =>
    fetch(`${baseUrl}/api/cron/process-bulk-verify-queue`, {
      method: "POST",
      headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
    }).catch((error) => {
      console.warn("[process-bulk-verify-queue] Trigger next failed:", error);
    });

  if (isQStashEnabled()) {
    triggerProcessBulkVerifyQueue(baseUrl)
      .then((res) => {
        if (res?.error) doFetch();
      })
      .catch(() => doFetch());
  } else {
    doFetch();
  }
}

async function markJobFailed(
  jobId: string,
  errorMessage: string,
): Promise<void> {
  const supabaseAdmin = createAdminClient();
  await supabaseAdmin
    .from("bulk_submission_moderation_jobs")
    .update({
      status: "failed",
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .in("status", ["queued", "running"]);
}

/**
 * YouTube-style once-at-end side effects: creator total_views + contest budget/stats.
 * Never throws — job completion must not fail because of deferred reconcile.
 */
async function finalizeBulkModerationSideEffects(options: {
  contestId: string;
  submissionIds: string[];
}): Promise<void> {
  const { contestId, submissionIds } = options;
  if (!contestId || submissionIds.length === 0) return;

  const supabaseAdmin = createAdminClient();
  try {
    const creatorIds = new Set<string>();
    const ID_CHUNK = 200;
    for (let i = 0; i < submissionIds.length; i += ID_CHUNK) {
      const chunk = submissionIds.slice(i, i + ID_CHUNK);
      const { data, error } = await supabaseAdmin
        .from("submissions")
        .select("creator_id")
        .in("id", chunk);
      if (error) {
        console.warn(
          "[process-bulk-verify-queue] finalize: failed loading creator ids:",
          error.message,
        );
        continue;
      }
      for (const row of data || []) {
        if (row.creator_id) creatorIds.add(String(row.creator_id));
      }
    }

    for (const creatorId of creatorIds) {
      try {
        await reconcileCreatorTotalViews(creatorId);
      } catch (err) {
        console.warn(
          "[process-bulk-verify-queue] finalize: total_views reconcile failed:",
          creatorId,
          err instanceof Error ? err.message : err,
        );
      }
    }

    try {
      await persistContestBudgetSpent(contestId, supabaseAdmin);
    } catch (err) {
      console.warn(
        "[process-bulk-verify-queue] finalize: persistContestBudgetSpent failed:",
        err instanceof Error ? err.message : err,
      );
    }

    try {
      await refreshContestStats(contestId);
    } catch (err) {
      console.warn(
        "[process-bulk-verify-queue] finalize: refreshContestStats failed:",
        err instanceof Error ? err.message : err,
      );
    }
  } catch (err) {
    console.warn(
      "[process-bulk-verify-queue] finalize side effects error:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function GET(request: Request) {
  const rawBody = "";
  const authorized = await authorizeProcessBulkVerifyQueue(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRequest(getBaseUrlFromRequest(request));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorized = await authorizeProcessBulkVerifyQueue(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viaQStash = !!request.headers.get("Upstash-Signature");
  console.log(
    `[process-bulk-verify-queue] Invoked by ${viaQStash ? "QStash" : "CRON/direct"}`,
  );
  return handleRequest(getBaseUrlFromRequest(request));
}

async function handleRequest(baseUrl: string): Promise<NextResponse> {
  if (!isBulkSubmissionModerationQueueEnabled()) {
    return NextResponse.json(
      { processed: 0, message: "Bulk moderation queue not configured" },
      { status: 200 },
    );
  }

  let popped = await popBulkSubmissionModerationJob();
  if (!popped) {
    const recovered = await recoverBulkSubmissionModerationProcessingToQueue({
      maxToMove: 25,
    });
    if (recovered.moved > 0) {
      popped = await popBulkSubmissionModerationJob();
    }
  }

  if (!popped) {
    return NextResponse.json({ processed: 0, message: "Queue empty" });
  }

  const { job, raw: rawJobString } = popped;
  const supabaseAdmin = createAdminClient();
  const batchSize = job.batchSize || BULK_MODERATION_BATCH_SIZE;

  const { data: jobRow, error: jobError } = await supabaseAdmin
    .from("bulk_submission_moderation_jobs")
    .select("*")
    .eq("id", job.jobId)
    .single();

  if (jobError || !jobRow) {
    await removeBulkSubmissionModerationFromProcessing(rawJobString);
    return NextResponse.json({ processed: 1, message: "Job not found" });
  }

  if (jobRow.status === "completed" || jobRow.status === "failed") {
    await removeBulkSubmissionModerationFromProcessing(rawJobString);
    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      runStatus: jobRow.status,
      message: `Job already ${jobRow.status}`,
    });
  }

  const submissionIds = Array.isArray(job.submissionIds)
    ? job.submissionIds.map(String).filter(Boolean)
    : [];
  // Prefer Redis offset (YouTube-style); fall back to DB processed_count for legacy jobs.
  const offset =
    typeof job.offset === "number" && Number.isFinite(job.offset)
      ? Math.max(0, Math.floor(job.offset))
      : Math.max(0, Number(jobRow.processed_count) || 0);

  if (submissionIds.length === 0) {
    await markJobFailed(
      job.jobId,
      "Queue job missing submissionIds (required after removing DB column)",
    );
    await removeBulkSubmissionModerationFromProcessing(rawJobString);
    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      error: "Queue job missing submissionIds",
    }, { status: 500 });
  }

  if (offset >= submissionIds.length) {
    await supabaseAdmin
      .from("bulk_submission_moderation_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.jobId);
    await removeBulkSubmissionModerationFromProcessing(rawJobString);
    await finalizeBulkModerationSideEffects({
      contestId: job.contestId || String(jobRow.contest_id),
      submissionIds,
    });
    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      message: "Job already exhausted",
    });
  }

  await supabaseAdmin
    .from("bulk_submission_moderation_jobs")
    .update({
      status: "running",
      started_at: jobRow.started_at ?? new Date().toISOString(),
    })
    .eq("id", job.jobId);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/admin/bulk-verify/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-From-Queue": "1",
        ...(process.env.CRON_SECRET
          ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
          : {}),
      },
      body: JSON.stringify({
        jobId: job.jobId,
        offset,
        batchSize,
        batchIndex: job.batchIndex,
        totalBatches: job.totalBatches,
        submissionIds,
      }),
    });
  } catch (err) {
    const reason = `batch fetch failed: ${err instanceof Error ? err.message : "unknown error"}`;
    console.error("[process-bulk-verify-queue] Batch fetch error:", err);
    const retryResult = await retryOrDeadLetterBulkSubmissionModeration({
      rawJobString,
      reason,
    });
    if (retryResult.deadLettered) {
      await markJobFailed(
        job.jobId,
        "Job dead-lettered after repeated batch fetch failures",
      );
    } else if (retryResult.requeued) {
      triggerNextProcessor(baseUrl);
    }
    return NextResponse.json(
      {
        processed: 1,
        jobId: job.jobId,
        error: err instanceof Error ? err.message : "Batch request failed",
        retry: retryResult,
      },
      { status: 500 },
    );
  }

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      (responseData as { error?: string })?.error ||
      `Bulk moderation chunk failed with HTTP ${response.status}`;
    console.error(
      "[process-bulk-verify-queue] Batch failed:",
      response.status,
      responseData,
    );
    const retryResult = await retryOrDeadLetterBulkSubmissionModeration({
      rawJobString,
      reason: `batch status ${response.status}: ${errorMessage}`,
    });
    if (retryResult.deadLettered) {
      await markJobFailed(
        job.jobId,
        `Job dead-lettered after repeated batch failures: ${errorMessage}`,
      );
    } else if (retryResult.requeued) {
      triggerNextProcessor(baseUrl);
    }
    return NextResponse.json(
      {
        processed: 1,
        jobId: job.jobId,
        error: errorMessage,
        retry: retryResult,
      },
      { status: 500 },
    );
  }

  if ((responseData as any)?.cancelled || (responseData as any)?.runStatus === "failed") {
    await removeBulkSubmissionModerationFromProcessing(rawJobString);
    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      cancelled: true,
      runStatus: (responseData as any)?.runStatus,
    });
  }

  const processedDelta = Number((responseData as any)?.processed) || 0;
  const failedDelta = Number((responseData as any)?.failed) || 0;
  const chunkIdsFromBatch = Array.isArray((responseData as any)?.chunkIds)
    ? ((responseData as any).chunkIds as unknown[]).map(String)
    : submissionIds.slice(offset, offset + batchSize);
  const attemptedDelta = Math.min(
    chunkIdsFromBatch.length,
    processedDelta + failedDelta,
  );

  const batchErrors = Array.isArray((responseData as any)?.errors)
    ? ((responseData as any).errors as { error?: string }[])
    : [];
  const allFailuresLookTransient =
    processedDelta === 0 &&
    failedDelta > 0 &&
    batchErrors.length > 0 &&
    batchErrors.every((e) => {
      const msg = String(e?.error || "").toLowerCase();
      return (
        msg.includes("timeout") ||
        msg.includes("canceling statement") ||
        msg.includes("57014") ||
        msg.includes("fetch failed") ||
        msg.includes("econnreset")
      );
    });

  // Don't burn the chunk on DB timeouts — retry same offset (YouTube-style).
  if (allFailuresLookTransient) {
    const retryResult = await retryOrDeadLetterBulkSubmissionModeration({
      rawJobString,
      reason: `transient batch failures: ${batchErrors[0]?.error || "timeout"}`,
    });
    if (retryResult.deadLettered) {
      await markJobFailed(
        job.jobId,
        `Job dead-lettered after repeated transient batch failures: ${batchErrors[0]?.error || "timeout"}`,
      );
    } else if (retryResult.requeued) {
      await sleep(CHUNK_PAUSE_MS * 2);
      triggerNextProcessor(baseUrl);
    }
    return NextResponse.json(
      {
        processed: 1,
        jobId: job.jobId,
        error: "Transient batch failure; requeued",
        retry: retryResult,
      },
      { status: 503 },
    );
  }

  if (attemptedDelta <= 0) {
    const retryResult = await retryOrDeadLetterBulkSubmissionModeration({
      rawJobString,
      reason: "Queue stall: chunk completed without progress",
    });
    if (retryResult.deadLettered) {
      await markJobFailed(
        job.jobId,
        "Queue stall: chunk completed without progress (dead-lettered)",
      );
    } else if (retryResult.requeued) {
      triggerNextProcessor(baseUrl);
    }
    return NextResponse.json(
      {
        processed: 1,
        jobId: job.jobId,
        error: "Queue stall: chunk completed without progress",
        retry: retryResult,
      },
      { status: 500 },
    );
  }

  const nextOffset =
    typeof (responseData as any)?.nextOffset === "number"
      ? Math.max(0, Math.floor((responseData as any).nextOffset))
      : offset + attemptedDelta;
  const nextProcessed = Math.max(
    Number(jobRow.processed_count) || 0,
    nextOffset,
  );
  const nextSuccess = (Number(jobRow.success_count) || 0) + processedDelta;
  const nextFailed = (Number(jobRow.failed_count) || 0) + failedDelta;
  const hasMore =
    (responseData as any)?.hasMore === true ||
    nextOffset < submissionIds.length;
  const done = !hasMore;
  const firstError =
    Array.isArray((responseData as any)?.errors) &&
    (responseData as any).errors.length > 0
      ? String((responseData as any).errors[0]?.error || "")
      : null;

  await supabaseAdmin
    .from("bulk_submission_moderation_jobs")
    .update({
      processed_count: nextProcessed,
      success_count: nextSuccess,
      failed_count: nextFailed,
      status: done ? "completed" : "running",
      error_message: firstError || jobRow.error_message || null,
      finished_at: done ? new Date().toISOString() : null,
    })
    .eq("id", job.jobId);

  if (hasMore) {
    await sleep(CHUNK_PAUSE_MS);
    const nextJob: BulkSubmissionModerationQueueJob = {
      contestId: job.contestId || String(jobRow.contest_id),
      jobId: job.jobId,
      action:
        (job.action as BulkSubmissionModerationQueueJob["action"]) ||
        (String(jobRow.action) as BulkSubmissionModerationQueueJob["action"]),
      batchIndex: (job.batchIndex || 0) + 1,
      batchSize,
      totalBatches:
        job.totalBatches ||
        Math.ceil(submissionIds.length / batchSize),
      submissionIds,
      offset: nextOffset,
      attempt: 0,
    };
    const enqueueNext = await enqueueBulkSubmissionModerationJob(nextJob);
    if (enqueueNext.error) {
      console.error(
        "[process-bulk-verify-queue] Failed to enqueue next batch",
        { jobId: job.jobId, error: enqueueNext.error },
      );
      await markJobFailed(
        job.jobId,
        `Failed to enqueue next batch: ${enqueueNext.error}`,
      );
      await removeBulkSubmissionModerationFromProcessing(rawJobString);
      return NextResponse.json(
        {
          processed: 1,
          jobId: job.jobId,
          error: "Failed to enqueue next batch",
          details: enqueueNext.error,
        },
        { status: 500 },
      );
    }
    // Remove only after the continuation job is safely queued (YouTube pattern).
    await removeBulkSubmissionModerationFromProcessing(rawJobString);
    triggerNextProcessor(baseUrl);
    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      batchIndex: job.batchIndex,
      hasMore: true,
      processedCount: nextProcessed,
      totalCount: submissionIds.length,
    });
  }

  await removeBulkSubmissionModerationFromProcessing(rawJobString);

  // Once-at-end: reconcile creator views + contest budget/stats (deferred from per-row).
  await finalizeBulkModerationSideEffects({
    contestId: job.contestId || String(jobRow.contest_id),
    submissionIds,
  });

  return NextResponse.json({
    processed: 1,
    jobId: job.jobId,
    batchIndex: job.batchIndex,
    done: true,
    hasMore: false,
    processedCount: nextProcessed,
    totalCount: submissionIds.length,
  });
}
