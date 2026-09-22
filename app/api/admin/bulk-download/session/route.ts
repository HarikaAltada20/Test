import { NextResponse } from "next/server";
import { verifyAdminOrBrandDownloadAccess } from "@/lib/video-download-auth";
import {
  createBulkVideoDownloadJob,
  enrichBulkVideoDownloadJob,
  getBulkVideoDownloadJobById,
  getLatestBulkVideoDownloadJobForContest,
  listBulkVideoDownloadJobsForContest,
  parseItemStatuses,
  parseZipParts,
  updateBulkVideoDownloadJob,
  viewerCanAccessBulkVideoDownloadJob,
  type BulkVideoDownloadJobStatus,
  type BulkVideoDownloadItemStatus,
} from "@/lib/bulk-video-download-jobs";
import { isStuckDesktopManifestJob } from "@/lib/bulk-video-download-summary";
import type { DownloadAccessUser } from "@/lib/video-download-auth";
import {
  assertSessionSubmissionsOnContest,
  collectSessionSubmissionIds,
  scopeItemStatusesToJob,
  scopeZipPartsToJob,
  verifyDownloadContestAccess,
} from "@/lib/bulk-video-download-session-access";

export const dynamic = "force-dynamic";

function parseSubmissionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
}

function leanItemStatusesFromResults(
  value: unknown,
): BulkVideoDownloadItemStatus[] {
  if (!Array.isArray(value)) return [];
  // Accept either lean statuses or full result rows from older clients.
  return parseItemStatuses(
    value.map((row) => {
      if (!row || typeof row !== "object") return null;
      return {
        submissionId: row.submissionId,
        status: row.status,
        error: row.error,
      };
    }),
  );
}

async function sessionResponse(jobId: string, viewer: DownloadAccessUser) {
  const { data, error } = await getBulkVideoDownloadJobById({
    id: jobId,
  });
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  if (!data || !viewerCanAccessBulkVideoDownloadJob({ viewer, job: data })) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  let job = data;
  if (isStuckDesktopManifestJob(job)) {
    const closed = await updateBulkVideoDownloadJob({
      id: job.id,
      userId: job.user_id,
      status: "completed",
      errorMessage: null,
    });
    if (closed.data) job = closed.data;
  }
  const session = await enrichBulkVideoDownloadJob(job);
  return NextResponse.json({ session });
}

/** GET ?contestId= | ?jobId= — restore session; meta joined from submissions. */
export async function GET(request: Request) {
  const access = await verifyAdminOrBrandDownloadAccess();
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error || "Admin or brand access required" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const contestId = url.searchParams.get("contestId")?.trim();
  const jobId = url.searchParams.get("jobId")?.trim();
  const listJobs =
    url.searchParams.get("list") === "1" ||
    url.searchParams.get("summaries") === "1";

  if (jobId) {
    return sessionResponse(jobId, access.user);
  }

  if (!contestId) {
    return NextResponse.json(
      { error: "contestId or jobId is required" },
      { status: 400 },
    );
  }

  const contestAccess = await verifyDownloadContestAccess({
    supabase: access.supabase,
    viewer: access.user,
    contestId,
  });
  if (!contestAccess.ok) {
    return NextResponse.json(
      { error: contestAccess.error },
      { status: contestAccess.status },
    );
  }

  if (listJobs) {
    const { data, error } = await listBulkVideoDownloadJobsForContest({
      contestId: contestAccess.contestId,
      viewer: access.user,
    });
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }
    return NextResponse.json({
      jobs: data,
      viewerUserType: access.user.user_type,
    });
  }

  const { data, error } = await getLatestBulkVideoDownloadJobForContest({
    contestId: contestAccess.contestId,
    userId: access.user.id,
  });
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ session: null });
  }
  const session = await enrichBulkVideoDownloadJob(data);
  return NextResponse.json({ session });
}

/** POST — create a lean session (IDs + zip parts only). */
export async function POST(request: Request) {
  const access = await verifyAdminOrBrandDownloadAccess();
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error || "Admin or brand access required" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const contestId =
    typeof body.contestId === "string" ? body.contestId.trim() : "";
  if (!id || !contestId) {
    return NextResponse.json(
      { error: "id and contestId are required" },
      { status: 400 },
    );
  }

  const contestAccess = await verifyDownloadContestAccess({
    supabase: access.supabase,
    viewer: access.user,
    contestId,
  });
  if (!contestAccess.ok) {
    return NextResponse.json(
      { error: contestAccess.error },
      { status: contestAccess.status },
    );
  }

  const zipParts = parseZipParts(body.zipParts ?? body.jobs);
  const submissionIds = parseSubmissionIds(body.submissionIds);
  const resolvedIds = collectSessionSubmissionIds(submissionIds, zipParts);

  if (resolvedIds.length < 2) {
    return NextResponse.json(
      { error: "At least 2 submissionIds are required" },
      { status: 400 },
    );
  }

  const submissionsAccess = await assertSessionSubmissionsOnContest({
    contestId: contestAccess.contestId,
    submissionIds: resolvedIds,
  });
  if (!submissionsAccess.ok) {
    return NextResponse.json(
      { error: submissionsAccess.error },
      { status: submissionsAccess.status },
    );
  }

  const allowedIds = submissionsAccess.submissionIds;
  const scopedZipParts = scopeZipPartsToJob(zipParts, allowedIds);
  const parsedStatuses = leanItemStatusesFromResults(
    body.itemStatuses ?? body.results,
  );
  const itemStatuses =
    parsedStatuses.length > 0
      ? scopeItemStatusesToJob(parsedStatuses, allowedIds)
      : allowedIds.map((submissionId) => ({
          submissionId,
          status: "pending" as const,
        }));

  const { data, error } = await createBulkVideoDownloadJob({
    id,
    contestId: contestAccess.contestId,
    userId: access.user.id,
    userType: access.user.user_type,
    totalCount: allowedIds.length,
    zipPartTotal: Math.max(
      1,
      zipParts.length || Number(body.zipPartTotal ?? body.totalChunks) || 1,
    ),
    videosPerZip: Math.max(1, Number(body.videosPerZip) || 10),
    namingPattern:
      typeof body.namingPattern === "string" ? body.namingPattern : null,
    fileNamePrefix:
      typeof body.fileNamePrefix === "string" ? body.fileNamePrefix : null,
    submissionIds: allowedIds,
    zipParts: scopedZipParts,
    itemStatuses,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error || "Failed to create download session" },
      { status: 500 },
    );
  }

  const session = await enrichBulkVideoDownloadJob(data);
  return NextResponse.json({ session });
}

/** PATCH — update counts / item statuses (no meta blobs). */
export async function PATCH(request: Request) {
  const access = await verifyAdminOrBrandDownloadAccess();
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error || "Admin or brand access required" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const status =
    body.status === "queued" ||
    body.status === "running" ||
    body.status === "completed" ||
    body.status === "failed"
      ? (body.status as BulkVideoDownloadJobStatus)
      : undefined;

  const itemStatuses = leanItemStatusesFromResults(
    body.itemStatuses ?? body.results,
  );
  const zipParts =
    body.zipParts || body.jobs
      ? parseZipParts(body.zipParts ?? body.jobs)
      : undefined;

  const { data, error } = await updateBulkVideoDownloadJob({
    id,
    userId: access.user.id,
    status,
    successCount:
      typeof body.successCount === "number" ? body.successCount : undefined,
    failedCount:
      typeof body.failedCount === "number" ? body.failedCount : undefined,
    zipPartIndex:
      typeof body.zipPartIndex === "number"
        ? body.zipPartIndex
        : typeof body.chunkIndex === "number"
          ? body.chunkIndex
          : undefined,
    zipPartTotal:
      typeof body.zipPartTotal === "number"
        ? body.zipPartTotal
        : typeof body.totalChunks === "number"
          ? body.totalChunks
          : undefined,
    zipParts,
    itemStatuses: itemStatuses.length > 0 ? itemStatuses : undefined,
    errorMessage:
      typeof body.errorMessage === "string" || body.errorMessage === null
        ? body.errorMessage
        : undefined,
    summaryViewed: body.summaryViewed === true,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // PATCH responses stay lean (no join) for frequent progress updates.
  const session =
    data.status === "completed" || data.status === "failed"
      ? await enrichBulkVideoDownloadJob(data)
      : data;
  return NextResponse.json({ session });
}
