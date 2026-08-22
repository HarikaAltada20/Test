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
} from "@/lib/queue/bulk-submission-moderation-queue";
import {
  authorizeProcessBulkVerifyQueue,
  ensureProcessBulkVerifyQueueScheduleOnce,
  isQStashEnabled,
  triggerProcessBulkVerifyQueue,
} from "@/lib/qstash";
import {
  parseBulkModerationJobPayload,
  readQueueOffset,
} from "@/lib/queue/bulk-job-payload";
import { reconcileCreatorTotalViews } from "@/lib/creator-total-views";
import { persistContestBudgetSpent } from "@/lib/persist-contest-budget-spent";
import { refreshContestStats } from "@/lib/contest-stats";
import { applyBulkDualRewardsWalletReversals } from "@/lib/dual-rewards-bulk-reversal";
import { fetchByIdsInChunks } from "@/lib/supabase-in-id-chunks";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CHUNK_PAUSE_MS = 250;
const WALLET_FINALIZE_MAX_ATTEMPTS = 3;
const ENQUEUE_NEXT_MAX_ATTEMPTS = 3;

const MODERATION_ACTIONS = new Set(["verified", "pending", "rejected"]);

/**
 * Redis queue refs are slim (jobId/contestId/batchIndex only) and pop()
 * defaults a missing action to "pending". Wallet finalize must use the
 * Postgres job row, or verified/rejected refunds never match status.
 */
function resolveModerationJobAction(
  jobRowAction: unknown,
  redisAction?: string,
): string {
  const fromDb = String(jobRowAction || "").trim();
  if (MODERATION_ACTIONS.has(fromDb)) return fromDb;
  const fromRedis = String(redisAction || "").trim();
  if (MODERATION_ACTIONS.has(fromRedis)) return fromRedis;
  return fromDb || fromRedis;
}

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

/** Keep job resumable when Redis enqueue fails after a successful chunk. */
async function markJobEnqueueStalled(
  jobId: string,
  errorMessage: string,
): Promise<void> {
  const supabaseAdmin = createAdminClient();
  await supabaseAdmin
    .from("bulk_submission_moderation_jobs")
    .update({
      status: "running",
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .in("status", ["queued", "running"]);
}

async function enqueueNextModerationBatchWithRetry(options: {
  contestId: string;
  jobId: string;
  batchIndex: number;
}): Promise<{ error?: string }> {
  let lastError = "Failed to enqueue next batch";
  for (let attempt = 0; attempt < ENQUEUE_NEXT_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(300 * attempt);
    const result = await enqueueBulkSubmissionModerationJob({
      contestId: options.contestId,
      jobId: options.jobId,
      batchIndex: options.batchIndex,
      attempt: 0,
    });
    if (!result.error) return {};
    lastError = result.error;
  }
  return { error: lastError };
}

/**
 * After all status updates finish: one money_transactions refund (+ wallet debit)
 * per creator for successfully moderated submissions.
 */
async function finalizeBulkModerationWalletReversals(options: {
  jobId: string;
  contestId: string;
  action: string;
  submissionIds: string[];
}): Promise<{
  ok: boolean;
  error?: string;
  walletRefundSummary?: Record<string, unknown> | null;
}> {
  const { jobId, contestId, action, submissionIds } = options;
  if (
    action !== "verified" &&
    action !== "pending" &&
    action !== "rejected"
  ) {
    return { ok: true, walletRefundSummary: null };
  }
  if (submissionIds.length === 0) {
    return { ok: true, walletRefundSummary: null };
  }

  const supabaseAdmin = createAdminClient();

  // Only reverse rows that actually reached the target status (skip failed chunk items).
  const { data: statusRows, error: statusErr } = await fetchByIdsInChunks({
    ids: submissionIds,
    fetchChunk: async (chunkIds) => {
      const result = await supabaseAdmin
        .from("submissions")
        .select("id, status")
        .in("id", chunkIds);
      return { data: result.data, error: result.error };
    },
  });
  if (statusErr) {
    return { ok: false, error: statusErr.message };
  }

  const toReverse = (statusRows || [])
    .filter((row) => String(row.status || "") === action)
    .map((row) => String(row.id));

  if (toReverse.length === 0) {
    await supabaseAdmin
      .from("bulk_submission_moderation_jobs")
      .update({
        wallet_refund_summary: {
          reward_refunded_cents: 0,
          bonus_refunded_cents: 0,
          total_refunded_cents: 0,
          cpm_refunded_cents: 0,
          milestone_refunded_cents: 0,
          is_dual_rewards: false,
        },
      })
      .eq("id", jobId);
    return {
      ok: true,
      walletRefundSummary: {
        reward_refunded_cents: 0,
        bonus_refunded_cents: 0,
        total_refunded_cents: 0,
        cpm_refunded_cents: 0,
        milestone_refunded_cents: 0,
        is_dual_rewards: false,
      },
    };
  }

  const walletResult = await applyBulkDualRewardsWalletReversals({
    supabaseAdmin,
    submissionIds: toReverse,
    // Status already left `paid`; still compute dues from earnings + reward ledger.
    forceWasPaidBeforeReversal: true,
  });

  if (!walletResult.ok) {
    return { ok: false, error: walletResult.error };
  }

  let rewardCents = 0;
  let bonusCents = 0;
  let totalCents = 0;
  let cpmCents = 0;
  let milestoneCents = 0;
  for (const rs of walletResult.refundSummaryBySubmissionId.values()) {
    const rowTotal = Math.max(0, Number(rs.total_refunded_cents) || 0);
    if (rowTotal <= 0) continue;
    totalCents += rowTotal;
    rewardCents += Math.max(0, Number(rs.reward_refunded_cents) || 0);
    bonusCents += Math.max(0, Number(rs.bonus_refunded_cents) || 0);
    cpmCents += Math.max(
      0,
      Number(rs.cpm_refunded_cents ?? rs.reward_refunded_cents) || 0,
    );
    milestoneCents += Math.max(
      0,
      Number(rs.milestone_refunded_cents ?? rs.bonus_refunded_cents) || 0,
    );
  }

  const { data: contestRow } = await supabaseAdmin
    .from("contests")
    .select("contest_type")
    .eq("id", contestId)
    .maybeSingle();

  const walletRefundSummary = {
    reward_refunded_cents: rewardCents,
    bonus_refunded_cents: bonusCents,
    total_refunded_cents: totalCents,
    cpm_refunded_cents: cpmCents,
    milestone_refunded_cents: milestoneCents,
    is_dual_rewards: String(contestRow?.contest_type || "") === "dual_rewards",
  };

  await supabaseAdmin
    .from("bulk_submission_moderation_jobs")
    .update({ wallet_refund_summary: walletRefundSummary })
    .eq("id", jobId);

  return { ok: true, walletRefundSummary };
}

async function finalizeBulkModerationWalletReversalsWithRetry(options: {
  jobId: string;
  contestId: string;
  action: string;
  submissionIds: string[];
}): Promise<{
  ok: boolean;
  error?: string;
  walletRefundSummary?: Record<string, unknown> | null;
}> {
  let lastError: string | undefined;
  for (let attempt = 0; attempt < WALLET_FINALIZE_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(500 * attempt);
    const result = await finalizeBulkModerationWalletReversals(options);
    if (result.ok) return result;
    lastError = result.error;
  }
  return { ok: false, error: lastError || "Wallet reversal finalize failed" };
}

/**
 * Reconcile wallet debits for submissions already moderated, then mark the job failed.
 * Ensures paid submissions are not left in a new status without ledger reversal.
 */
async function failModerationJobWithWalletReconciliation(options: {
  jobId: string;
  contestId: string;
  action: string;
  submissionIds: string[];
  errorMessage: string;
  runSideEffects?: boolean;
}): Promise<void> {
  const walletFinalize = await finalizeBulkModerationWalletReversalsWithRetry({
    jobId: options.jobId,
    contestId: options.contestId,
    action: options.action,
    submissionIds: options.submissionIds,
  });

  const finalMessage = walletFinalize.ok
    ? options.errorMessage
    : `${options.errorMessage}; wallet reconciliation failed: ${walletFinalize.error}`;

  await markJobFailed(options.jobId, finalMessage);

  if (walletFinalize.ok && options.runSideEffects) {
    await finalizeBulkModerationSideEffects({
      contestId: options.contestId,
      submissionIds: options.submissionIds,
    });
  }
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
  ensureProcessBulkVerifyQueueScheduleOnce(getBaseUrlFromRequest(request));
  return handleRequest(getBaseUrlFromRequest(request));
}

async function handleRequest(baseUrl: string): Promise<NextResponse> {
  if (!isBulkSubmissionModerationQueueEnabled()) {
    return NextResponse.json(
      { processed: 0, message: "Bulk moderation queue not configured" },
      { status: 200 },
    );
  }

  if (Math.random() < 0.15) {
    await recoverBulkSubmissionModerationProcessingToQueue({ maxToMove: 25 });
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

  const submissionIdsFromPayload = parseBulkModerationJobPayload(
    jobRow.payload,
  )?.submissionIds;
  const legacyIds = Array.isArray(job.submissionIds)
    ? job.submissionIds.map(String).filter(Boolean)
    : [];
  const submissionIds = submissionIdsFromPayload ?? legacyIds;
  const offset =
    typeof job.offset === "number" && Number.isFinite(job.offset)
      ? Math.max(0, Math.floor(job.offset))
      : readQueueOffset(jobRow, 0);

  if (submissionIds.length === 0) {
    await markJobFailed(
      job.jobId,
      "Queue job missing submissionIds in DB payload",
    );
    await removeBulkSubmissionModerationFromProcessing(rawJobString);
    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      error: "Queue job missing submissionIds",
    }, { status: 500 });
  }

  if (offset >= submissionIds.length) {
    const contestId = job.contestId || String(jobRow.contest_id);
    const action = resolveModerationJobAction(jobRow.action, job.action);
    const walletFinalize = await finalizeBulkModerationWalletReversalsWithRetry({
      jobId: job.jobId,
      contestId,
      action,
      submissionIds,
    });
    if (!walletFinalize.ok) {
      await markJobFailed(
        job.jobId,
        walletFinalize.error || "Wallet reversal finalize failed",
      );
      await removeBulkSubmissionModerationFromProcessing(rawJobString);
      return NextResponse.json(
        {
          processed: 1,
          jobId: job.jobId,
          error: walletFinalize.error || "Wallet reversal finalize failed",
        },
        { status: 500 },
      );
    }
    await supabaseAdmin
      .from("bulk_submission_moderation_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.jobId);
    await removeBulkSubmissionModerationFromProcessing(rawJobString);
    await finalizeBulkModerationSideEffects({
      contestId,
      submissionIds,
    });
    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      message: "Job already exhausted",
    });
  }

  await supabaseAdmin.rpc("touch_bulk_submission_moderation_job_running", {
    p_job_id: job.jobId,
  });

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
      await failModerationJobWithWalletReconciliation({
        jobId: job.jobId,
        contestId: job.contestId || String(jobRow.contest_id),
        action: resolveModerationJobAction(jobRow.action, job.action),
        submissionIds,
        errorMessage:
          "Job dead-lettered after repeated batch fetch failures",
        runSideEffects: true,
      });
    } else if (retryResult.requeued) {
      await triggerNextProcessor(baseUrl);
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
      await failModerationJobWithWalletReconciliation({
        jobId: job.jobId,
        contestId: job.contestId || String(jobRow.contest_id),
        action: resolveModerationJobAction(jobRow.action, job.action),
        submissionIds,
        errorMessage: `Job dead-lettered after repeated batch failures: ${errorMessage}`,
        runSideEffects: true,
      });
    } else if (retryResult.requeued) {
      await triggerNextProcessor(baseUrl);
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
      await failModerationJobWithWalletReconciliation({
        jobId: job.jobId,
        contestId: job.contestId || String(jobRow.contest_id),
        action: resolveModerationJobAction(jobRow.action, job.action),
        submissionIds,
        errorMessage: `Job dead-lettered after repeated transient batch failures: ${batchErrors[0]?.error || "timeout"}`,
        runSideEffects: true,
      });
    } else if (retryResult.requeued) {
      await sleep(CHUNK_PAUSE_MS * 2);
      await triggerNextProcessor(baseUrl);
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
      await failModerationJobWithWalletReconciliation({
        jobId: job.jobId,
        contestId: job.contestId || String(jobRow.contest_id),
        action: resolveModerationJobAction(jobRow.action, job.action),
        submissionIds,
        errorMessage:
          "Queue stall: chunk completed without progress (dead-lettered)",
        runSideEffects: true,
      });
    } else if (retryResult.requeued) {
      await triggerNextProcessor(baseUrl);
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
  const nextProcessed =
    (Number(jobRow.processed_count) || 0) + attemptedDelta;
  const hasMore =
    (responseData as any)?.hasMore === true ||
    nextOffset < submissionIds.length;
  const done = !hasMore;
  const firstError =
    Array.isArray((responseData as any)?.errors) &&
    (responseData as any).errors.length > 0
      ? String((responseData as any).errors[0]?.error || "")
      : null;

  const contestId = job.contestId || String(jobRow.contest_id);
  const action = resolveModerationJobAction(jobRow.action, job.action);

  if (done) {
    const walletFinalize = await finalizeBulkModerationWalletReversalsWithRetry({
      jobId: job.jobId,
      contestId,
      action,
      submissionIds,
    });
    if (!walletFinalize.ok) {
      await supabaseAdmin.rpc(
        "apply_bulk_submission_moderation_job_batch_progress",
        {
          p_job_id: job.jobId,
          p_processed_delta: Math.max(
            0,
            nextProcessed - (Number(jobRow.processed_count) || 0),
          ),
          p_success_delta: processedDelta,
          p_failed_delta: failedDelta,
          p_mark_completed: false,
          p_error_message:
            walletFinalize.error ||
            firstError ||
            jobRow.error_message ||
            "Wallet reversal finalize failed",
          p_queue_offset: nextOffset,
        },
      );
      await markJobFailed(
        job.jobId,
        walletFinalize.error ||
          firstError ||
          jobRow.error_message ||
          "Wallet reversal finalize failed",
      );
      await finalizeBulkModerationSideEffects({
        contestId,
        submissionIds,
      });
      await removeBulkSubmissionModerationFromProcessing(rawJobString);
      return NextResponse.json(
        {
          processed: 1,
          jobId: job.jobId,
          error: walletFinalize.error || "Wallet reversal finalize failed",
        },
        { status: 500 },
      );
    }
  }

  const processedCountDelta = Math.max(
    0,
    nextProcessed - (Number(jobRow.processed_count) || 0),
  );

  await supabaseAdmin.rpc("apply_bulk_submission_moderation_job_batch_progress", {
    p_job_id: job.jobId,
    p_processed_delta: processedCountDelta,
    p_success_delta: processedDelta,
    p_failed_delta: failedDelta,
    p_mark_completed: done,
    p_error_message: firstError || jobRow.error_message || null,
    p_queue_offset: nextOffset,
  });

  if (hasMore) {
    await sleep(CHUNK_PAUSE_MS);
    const enqueueNext = await enqueueNextModerationBatchWithRetry({
      contestId,
      jobId: job.jobId,
      batchIndex: (job.batchIndex || 0) + 1,
    });
    if (enqueueNext.error) {
      console.error(
        "[process-bulk-verify-queue] Failed to enqueue next batch",
        { jobId: job.jobId, error: enqueueNext.error },
      );
      await markJobEnqueueStalled(
        job.jobId,
        `Failed to enqueue next batch (will retry via recovery): ${enqueueNext.error}`,
      );
      triggerNextProcessor(baseUrl);
      return NextResponse.json(
        {
          processed: 1,
          jobId: job.jobId,
          error: "Failed to enqueue next batch; job kept running for recovery",
          details: enqueueNext.error,
          stalled: true,
        },
        { status: 503 },
      );
    }
  }

  await removeBulkSubmissionModerationFromProcessing(rawJobString);

  if (hasMore) {
    await triggerNextProcessor(baseUrl);
    return NextResponse.json({
      processed: 1,
      jobId: job.jobId,
      batchIndex: job.batchIndex,
      hasMore: true,
      processedCount: nextProcessed,
      totalCount: submissionIds.length,
    });
  }

  await finalizeBulkModerationSideEffects({
    contestId,
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
