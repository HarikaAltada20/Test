/**
 * Process bulk payment queue:
 * pop one Redis batch job, call batch worker, update progress;
 * if more remain enqueue next batch + trigger self (QStash + CRON fallback).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  BULK_PAYMENT_BATCH_SIZE,
  enqueueBulkPaymentJob,
  popBulkPaymentJob,
  recoverBulkPaymentProcessingToQueue,
  removeBulkPaymentFromProcessing,
  retryOrDeadLetterBulkPayment,
  isBulkPaymentQueueEnabled,
  type BulkPaymentQueueJob,
} from "@/lib/queue/bulk-payment-queue";
import {
  authorizeProcessBulkPaymentQueue,
  isQStashEnabled,
  triggerProcessBulkPaymentQueue,
} from "@/lib/qstash";

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
    fetch(`${baseUrl}/api/cron/process-bulk-payment-queue`, {
      method: "POST",
      headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
    }).catch((error) => {
      console.warn("[process-bulk-payment-queue] Trigger next failed:", error);
    });

  if (isQStashEnabled()) {
    triggerProcessBulkPaymentQueue(baseUrl)
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
    .from("bulk_payment_jobs")
    .update({
      status: "failed",
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .in("status", ["queued", "running"]);
}

export async function GET(request: Request) {
  const rawBody = "";
  const authorized = await authorizeProcessBulkPaymentQueue(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRequest(getBaseUrlFromRequest(request));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorized = await authorizeProcessBulkPaymentQueue(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viaQStash = !!request.headers.get("Upstash-Signature");
  console.log(
    `[process-bulk-payment-queue] Invoked by ${viaQStash ? "QStash" : "CRON/direct"}`,
  );
  return handleRequest(getBaseUrlFromRequest(request));
}

async function handleRequest(baseUrl: string): Promise<NextResponse> {
  if (!isBulkPaymentQueueEnabled()) {
    return NextResponse.json(
      { processed: 0, message: "Bulk payment queue not configured" },
      { status: 200 },
    );
  }

  let popped = await popBulkPaymentJob();
  if (!popped) {
    const recovered = await recoverBulkPaymentProcessingToQueue({
      maxToMove: 25,
    });
    if (recovered.moved > 0) {
      popped = await popBulkPaymentJob();
    }
  }

  if (!popped) {
    return NextResponse.json({ processed: 0, message: "Queue empty" });
  }

  const { job, raw: rawJobString } = popped;
  const supabaseAdmin = createAdminClient();
  const batchSize = job.batchSize || BULK_PAYMENT_BATCH_SIZE;

  const { data: jobRow, error: jobError } = await supabaseAdmin
    .from("bulk_payment_jobs")
    .select("*")
    .eq("id", job.jobId)
    .single();

  if (jobError || !jobRow) {
    await removeBulkPaymentFromProcessing(rawJobString);
    return NextResponse.json({ processed: 1, message: "Job not found" });
  }

  if (jobRow.status === "completed" || jobRow.status === "failed") {
    await removeBulkPaymentFromProcessing(rawJobString);
    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      runStatus: jobRow.status,
      message: `Job already ${jobRow.status}`,
    });
  }

  const items = Array.isArray(job.items) ? job.items : [];
  const offset =
    typeof job.offset === "number" && Number.isFinite(job.offset)
      ? Math.max(0, Math.floor(job.offset))
      : Math.max(0, Number(jobRow.processed_count) || 0);

  if (items.length === 0) {
    await markJobFailed(job.jobId, "Queue job missing payment items");
    await removeBulkPaymentFromProcessing(rawJobString);
    return NextResponse.json(
      {
        processed: 1,
        jobId: job.jobId,
        error: "Queue job missing payment items",
      },
      { status: 500 },
    );
  }

  if (offset >= items.length) {
    await supabaseAdmin
      .from("bulk_payment_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.jobId);
    await removeBulkPaymentFromProcessing(rawJobString);
    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      message: "Job already exhausted",
    });
  }

  await supabaseAdmin
    .from("bulk_payment_jobs")
    .update({
      status: "running",
      started_at: jobRow.started_at ?? new Date().toISOString(),
    })
    .eq("id", job.jobId);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/admin/bulk-payment/batch`, {
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
        items,
      }),
    });
  } catch (err) {
    const reason = `batch fetch failed: ${err instanceof Error ? err.message : "unknown error"}`;
    console.error("[process-bulk-payment-queue] Batch fetch error:", err);
    const retryResult = await retryOrDeadLetterBulkPayment({
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
      `Bulk payment chunk failed with HTTP ${response.status}`;
    console.error(
      "[process-bulk-payment-queue] Batch failed:",
      response.status,
      responseData,
    );
    const retryResult = await retryOrDeadLetterBulkPayment({
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

  if (
    (responseData as { cancelled?: boolean })?.cancelled ||
    (responseData as { runStatus?: string })?.runStatus === "failed"
  ) {
    await removeBulkPaymentFromProcessing(rawJobString);
    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      cancelled: true,
      runStatus: (responseData as { runStatus?: string })?.runStatus,
    });
  }

  const paidDelta = Number((responseData as { paid?: number })?.paid) || 0;
  const skippedDelta =
    Number((responseData as { skipped?: number })?.skipped) || 0;
  const failedDelta =
    Number((responseData as { failed?: number })?.failed) || 0;
  const processedDelta = paidDelta + skippedDelta + failedDelta;

  const batchErrors = Array.isArray(
    (responseData as { errors?: unknown })?.errors,
  )
    ? ((responseData as { errors: { error?: string }[] }).errors)
    : [];
  const allFailuresLookTransient =
    processedDelta > 0 &&
    paidDelta === 0 &&
    failedDelta > 0 &&
    skippedDelta === 0 &&
    batchErrors.length > 0 &&
    batchErrors.every((e) => {
      const msg = String(e?.error || "").toLowerCase();
      return (
        msg.includes("timeout") ||
        msg.includes("canceling statement") ||
        msg.includes("57014") ||
        msg.includes("fetch failed") ||
        msg.includes("econnreset") ||
        msg.includes("busy") ||
        msg.includes("lease")
      );
    });

  if (allFailuresLookTransient) {
    const retryResult = await retryOrDeadLetterBulkPayment({
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

  if (processedDelta <= 0) {
    const retryResult = await retryOrDeadLetterBulkPayment({
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
    typeof (responseData as { nextOffset?: number })?.nextOffset === "number"
      ? Math.max(
          0,
          Math.floor((responseData as { nextOffset: number }).nextOffset),
        )
      : offset + processedDelta;
  const nextProcessed = Math.max(
    Number(jobRow.processed_count) || 0,
    nextOffset,
  );
  const nextSuccess = (Number(jobRow.success_count) || 0) + paidDelta;
  const nextFailed = (Number(jobRow.failed_count) || 0) + failedDelta;
  const nextAmount =
    (Number(jobRow.total_amount_cents) || 0) +
    (Number((responseData as { total_amount?: number })?.total_amount) || 0);
  const nextCpm =
    (Number(jobRow.total_cpm_cents) || 0) +
    (Number((responseData as { total_cpm?: number })?.total_cpm) || 0);
  const nextBonus =
    (Number(jobRow.total_bonus_cents) || 0) +
    (Number((responseData as { total_bonus?: number })?.total_bonus) || 0);
  const nextMilestone =
    (Number(jobRow.total_milestone_cents) || 0) +
    (Number((responseData as { total_milestone?: number })?.total_milestone) ||
      0);
  const hasMore =
    (responseData as { hasMore?: boolean })?.hasMore === true ||
    nextOffset < items.length;
  const done = !hasMore;
  const firstError =
    batchErrors.length > 0 ? String(batchErrors[0]?.error || "") : null;

  await supabaseAdmin
    .from("bulk_payment_jobs")
    .update({
      processed_count: nextProcessed,
      success_count: nextSuccess,
      failed_count: nextFailed,
      total_amount_cents: nextAmount,
      total_cpm_cents: nextCpm,
      total_bonus_cents: nextBonus,
      total_milestone_cents: nextMilestone,
      status: done ? "completed" : "running",
      error_message: firstError || jobRow.error_message || null,
      finished_at: done ? new Date().toISOString() : null,
    })
    .eq("id", job.jobId);

  if (hasMore) {
    await sleep(CHUNK_PAUSE_MS);
    const nextJob: BulkPaymentQueueJob = {
      contestId: job.contestId || String(jobRow.contest_id),
      jobId: job.jobId,
      paymentType:
        job.paymentType ||
        (String(jobRow.payment_type) as BulkPaymentQueueJob["paymentType"]),
      payoutChannel:
        job.payoutChannel ||
        (String(
          jobRow.payout_channel,
        ) as BulkPaymentQueueJob["payoutChannel"]),
      batchIndex: (job.batchIndex || 0) + 1,
      batchSize,
      totalBatches: job.totalBatches || Math.ceil(items.length / batchSize),
      items,
      offset: nextOffset,
      attempt: 0,
    };
    const enqueueNext = await enqueueBulkPaymentJob(nextJob);
    if (enqueueNext.error) {
      console.error(
        "[process-bulk-payment-queue] Failed to enqueue next batch",
        { jobId: job.jobId, error: enqueueNext.error },
      );
      await markJobFailed(
        job.jobId,
        `Failed to enqueue next batch: ${enqueueNext.error}`,
      );
      await removeBulkPaymentFromProcessing(rawJobString);
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
    await removeBulkPaymentFromProcessing(rawJobString);
    triggerNextProcessor(baseUrl);
    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      batchIndex: job.batchIndex,
      hasMore: true,
      processedCount: nextProcessed,
      totalCount: items.length,
    });
  }

  await removeBulkPaymentFromProcessing(rawJobString);

  return NextResponse.json({
    processed: 1,
    jobId: job.jobId,
    batchIndex: job.batchIndex,
    done: true,
    hasMore: false,
    processedCount: nextProcessed,
    totalCount: items.length,
  });
}
