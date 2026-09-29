import { NextResponse } from "next/server";
import {
  getBulkVideoDownloadJobById,
  isTerminalBulkVideoDownloadJobStatus,
  updateBulkVideoDownloadJob,
  type BulkVideoDownloadItemStatus,
  type BulkVideoDownloadJobRow,
  type BulkVideoDownloadJobStatus,
} from "@/lib/bulk-video-download-jobs";
import {
  desktopStatusEventSchema,
  type DesktopStatusEvent,
  type DesktopStatusEventType,
} from "@/lib/goc-download/schemas";
import {
  extractBearerToken,
  verifyDesktopStatusToken,
} from "@/lib/goc-download/status-token";
import { acquireDesktopStatusRateLimit } from "@/lib/goc-download/status-rate-limit";
import { recordDesktopStatusEvent } from "@/lib/goc-download/desktop-event-store";

export const dynamic = "force-dynamic";

function nextJobStatus(
  current: BulkVideoDownloadJobStatus,
  eventType: DesktopStatusEventType,
): BulkVideoDownloadJobStatus | undefined {
  if (isTerminalBulkVideoDownloadJobStatus(current)) return undefined;
  switch (eventType) {
    case "accepted":
      return current === "queued" ? "queued" : undefined;
    case "started":
      return "running";
    case "job_completed":
      return "completed";
    case "job_failed":
      return "failed";
    default:
      return undefined;
  }
}

function buildPatch(
  job: BulkVideoDownloadJobRow,
  event: DesktopStatusEvent,
): {
  id: string;
  userId: string;
  status?: BulkVideoDownloadJobStatus;
  successCount?: number;
  failedCount?: number;
  zipPartIndex?: number;
  itemStatuses?: BulkVideoDownloadItemStatus[];
  errorMessage?: string | null;
  startedAt?: string | null;
  expectedUpdatedAt: string;
} {
  const itemStatuses: BulkVideoDownloadItemStatus[] = [];
  if (
    (event.eventType === "item_completed" ||
      event.eventType === "item_failed") &&
    event.submissionId
  ) {
    if (job.submission_ids.includes(event.submissionId)) {
      itemStatuses.push({
        submissionId: event.submissionId,
        status: event.eventType === "item_completed" ? "success" : "failed",
        error: event.error || event.errorMessage,
      });
    }
  }

  const statusPatch = nextJobStatus(job.status, event.eventType);
  const patch: ReturnType<typeof buildPatch> = {
    id: job.id,
    userId: job.user_id,
    expectedUpdatedAt: job.updated_at,
  };

  // Do not regress terminal job states; late item events may still update rows.
  if (statusPatch && !isTerminalBulkVideoDownloadJobStatus(job.status)) {
    patch.status = statusPatch;
  } else if (
    !isTerminalBulkVideoDownloadJobStatus(job.status) &&
    (event.eventType === "item_completed" ||
      event.eventType === "item_failed" ||
      event.eventType === "archive_completed")
  ) {
    patch.status = "running";
  }

  if (typeof event.successCount === "number") {
    patch.successCount = Math.max(
      job.success_count,
      Math.min(event.successCount, job.total_count),
    );
  }
  if (typeof event.failedCount === "number") {
    patch.failedCount = Math.max(
      job.failed_count,
      Math.min(event.failedCount, job.total_count),
    );
  }
  if (typeof event.zipPartIndex === "number") {
    patch.zipPartIndex = Math.max(
      job.zip_part_index,
      Math.min(event.zipPartIndex, job.zip_part_total),
    );
  }
  if (itemStatuses.length > 0) {
    patch.itemStatuses = itemStatuses;
  }
  if (event.eventType === "job_failed" && (event.error || event.errorMessage)) {
    patch.errorMessage = event.error || event.errorMessage || null;
  }
  if (event.eventType === "started" && !job.started_at) {
    patch.startedAt = new Date().toISOString();
  }

  return patch;
}

export async function POST(request: Request) {
  const bearer = extractBearerToken(request.headers.get("authorization"));
  if (!bearer) {
    return NextResponse.json(
      { error: "Authorization Bearer status token required" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = desktopStatusEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid status event payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const event = parsed.data;

  // Never accept media bytes — reject oversized / unexpected binary fields.
  if (
    body &&
    typeof body === "object" &&
    ("media" in body ||
      "bytes" in body ||
      "file" in body ||
      "contentBase64" in body)
  ) {
    return NextResponse.json(
      { error: "Media payloads are not accepted on the status endpoint" },
      { status: 400 },
    );
  }

  const tokenCheck = verifyDesktopStatusToken(bearer, {
    expectedJobId: event.jobId,
  });
  if (!tokenCheck.ok) {
    return NextResponse.json(
      { error: `Invalid status token: ${tokenCheck.reason}` },
      { status: 401 },
    );
  }

  const { data: job, error: jobError } = await getBulkVideoDownloadJobById({
    id: event.jobId,
  });
  if (jobError) {
    return NextResponse.json({ error: jobError }, { status: 500 });
  }
  if (!job || job.user_id !== tokenCheck.claims.userId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Late item / archive results are accepted after terminal so counts can converge.
  // Only reject non-item mutations that would try to reopen the job.
  const lateItemAllowed =
    event.eventType === "item_completed" ||
    event.eventType === "item_failed" ||
    event.eventType === "archive_completed" ||
    event.eventType === "job_completed" ||
    event.eventType === "job_failed";
  if (isTerminalBulkVideoDownloadJobStatus(job.status) && !lateItemAllowed) {
    return NextResponse.json(
      { error: "Job is already terminal; further status events are rejected" },
      { status: 409 },
    );
  }

  const rate = await acquireDesktopStatusRateLimit({
    jobId: job.id,
    userId: job.user_id,
    itemCount: job.total_count,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: rate.reason, retryAfterMs: rate.retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
      },
    );
  }

  if (
    event.submissionId &&
    job.submission_ids.length > 0 &&
    !job.submission_ids.includes(event.submissionId)
  ) {
    return NextResponse.json(
      { error: "submissionId is not part of this job" },
      { status: 400 },
    );
  }

  const recorded = await recordDesktopStatusEvent({
    eventId: event.eventId,
    jobId: event.jobId,
    eventType: event.eventType,
    payload: event,
  });
  if (recorded.error) {
    return NextResponse.json({ error: recorded.error }, { status: 500 });
  }
  if (recorded.outcome === "duplicate_mismatch") {
    return NextResponse.json(
      {
        error:
          "eventId was already used with a different payload; refuse to reuse",
      },
      { status: 409 },
    );
  }

  // Re-apply idempotent merge on duplicate_ok so insert-ok / update-fail recovers.
  const patch = buildPatch(job, event);
  const updated = await updateBulkVideoDownloadJob(patch, { maxAttempts: 5 });
  if (updated.conflict) {
    return NextResponse.json(
      { error: updated.error || "Job update conflict; retry event" },
      { status: 409 },
    );
  }
  if (updated.error) {
    return NextResponse.json({ error: updated.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    duplicate:
      recorded.outcome === "duplicate_ok" ||
      recorded.outcome === "store_unavailable"
        ? recorded.outcome === "duplicate_ok"
        : false,
    status: updated.data?.status ?? job.status,
  });
}
