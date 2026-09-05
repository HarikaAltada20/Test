import { createAdminClient } from "@/utils/supabase/admin";
import type {
  BulkVideoDownloadResultRow,
  BulkVideoDownloadSubmissionMeta,
} from "@/lib/video-download-ui";
import type { VideoFilenamePattern } from "@/lib/video-download-filename";
import {
  canAccessBulkVideoDownloadJob,
} from "@/lib/bulk-video-download-summary";
import type { DownloadAccessUser } from "@/lib/video-download-auth";
import {
  scopeItemStatusesToJob,
  scopeZipPartsToJob,
} from "@/lib/bulk-video-download-session-access";

export type BulkVideoDownloadJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type BulkVideoDownloadZipPart = {
  jobId: string;
  zipPartIndex: number;
  zipPartTotal: number;
  submissionIds: string[];
  zipFilename: string;
};

/** Minimal per-video outcome (stored as rows in job_items). */
export type BulkVideoDownloadItemStatus = {
  submissionId: string;
  status: "pending" | "success" | "failed";
  error?: string;
  updatedAt?: string | null;
};

export type BulkVideoDownloadJobRow = {
  id: string;
  contest_id: string;
  user_id: string;
  user_type: "admin" | "advertiser";
  status: BulkVideoDownloadJobStatus;
  total_count: number;
  success_count: number;
  failed_count: number;
  zip_part_index: number;
  zip_part_total: number;
  videos_per_zip: number;
  naming_pattern: string | null;
  file_name_prefix: string | null;
  submission_ids: string[];
  zip_parts: BulkVideoDownloadZipPart[] | null;
  error_message: string | null;
  summary_viewed: boolean;
  summary_viewed_at: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

/** API/session shape returned to the client after joining submissions meta. */
export type BulkVideoDownloadSessionDto = BulkVideoDownloadJobRow & {
  metaById: Record<string, BulkVideoDownloadSubmissionMeta>;
  results: BulkVideoDownloadResultRow[];
};

const ITEM_PAGE_SIZE = 500;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((id) => (typeof id === "string" ? id : String(id ?? "")))
    .filter((id) => id.length > 0);
}

export function parseZipParts(value: unknown): BulkVideoDownloadZipPart[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((part) => {
      if (!part || typeof part.jobId !== "string") return null;
      const submissionIds = asStringArray(part.submissionIds);
      return {
        jobId: part.jobId,
        zipPartIndex:
          typeof part.zipPartIndex === "number" && part.zipPartIndex > 0
            ? Math.floor(part.zipPartIndex)
            : typeof part.chunkIndex === "number" && part.chunkIndex > 0
              ? Math.floor(part.chunkIndex)
              : 1,
        zipPartTotal:
          typeof part.zipPartTotal === "number" && part.zipPartTotal > 0
            ? Math.floor(part.zipPartTotal)
            : typeof part.totalChunks === "number" && part.totalChunks > 0
              ? Math.floor(part.totalChunks)
              : 1,
        submissionIds,
        zipFilename:
          typeof part.zipFilename === "string" && part.zipFilename.trim()
            ? part.zipFilename.trim()
            : "bulk.zip",
      } satisfies BulkVideoDownloadZipPart;
    })
    .filter((part): part is BulkVideoDownloadZipPart => part != null);
}

export function parseItemStatuses(
  value: unknown,
): BulkVideoDownloadItemStatus[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === "object" && row.submissionId)
    .map((row) => ({
      submissionId: String(row.submissionId),
      status:
        row.status === "success" || row.status === "failed"
          ? row.status
          : "pending",
      error:
        typeof row.error === "string"
          ? row.error
          : typeof row.error_message === "string"
            ? row.error_message
            : undefined,
      updatedAt:
        typeof row.updatedAt === "string"
          ? row.updatedAt
          : typeof row.updated_at === "string"
            ? row.updated_at
            : undefined,
    }));
}

function normalizeJobRow(raw: Record<string, unknown>): BulkVideoDownloadJobRow {
  return {
    id: String(raw.id),
    contest_id: String(raw.contest_id),
    user_id: String(raw.user_id),
    user_type: raw.user_type === "advertiser" ? "advertiser" : "admin",
    status:
      raw.status === "queued" ||
      raw.status === "completed" ||
      raw.status === "failed"
        ? raw.status
        : "running",
    total_count: Number(raw.total_count) || 0,
    success_count: Number(raw.success_count) || 0,
    failed_count: Number(raw.failed_count) || 0,
    zip_part_index: Math.max(1, Number(raw.zip_part_index) || 1),
    zip_part_total: Math.max(1, Number(raw.zip_part_total) || 1),
    videos_per_zip: Math.max(1, Number(raw.videos_per_zip) || 10),
    naming_pattern:
      typeof raw.naming_pattern === "string" ? raw.naming_pattern : null,
    file_name_prefix:
      typeof raw.file_name_prefix === "string" ? raw.file_name_prefix : null,
    submission_ids: asStringArray(raw.submission_ids),
    zip_parts: parseZipParts(raw.zip_parts),
    error_message:
      typeof raw.error_message === "string" ? raw.error_message : null,
    summary_viewed: raw.summary_viewed === true,
    summary_viewed_at: raw.summary_viewed_at
      ? String(raw.summary_viewed_at)
      : null,
    created_at: String(raw.created_at || ""),
    started_at: raw.started_at ? String(raw.started_at) : null,
    finished_at: raw.finished_at ? String(raw.finished_at) : null,
    updated_at: String(raw.updated_at || ""),
  };
}

function joinedUsername(users: unknown): string | null {
  if (!users) return null;
  const row = Array.isArray(users) ? users[0] : users;
  if (!row || typeof row !== "object") return null;
  const username = (row as { username?: unknown }).username;
  return typeof username === "string" && username.trim() ? username.trim() : null;
}

function joinedFullName(users: unknown): string | null {
  if (!users) return null;
  const row = Array.isArray(users) ? users[0] : users;
  if (!row || typeof row !== "object") return null;
  const fullName = (row as { full_name?: unknown }).full_name;
  return typeof fullName === "string" && fullName.trim()
    ? fullName.trim()
    : null;
}

function joinedAvatar(users: unknown): string | null {
  if (!users) return null;
  const row = Array.isArray(users) ? users[0] : users;
  if (!row || typeof row !== "object") return null;
  const avatar = (row as { profile_picture_url?: unknown }).profile_picture_url;
  return typeof avatar === "string" && avatar.trim() ? avatar.trim() : null;
}

export async function loadSubmissionMetaByIds(
  submissionIds: string[],
): Promise<Record<string, BulkVideoDownloadSubmissionMeta>> {
  const ids = [...new Set(submissionIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const admin = createAdminClient();
  const out: Record<string, BulkVideoDownloadSubmissionMeta> = {};

  for (let i = 0; i < ids.length; i += ITEM_PAGE_SIZE) {
    const slice = ids.slice(i, i + ITEM_PAGE_SIZE);
    const { data, error } = await admin
      .from("submissions")
      .select(
        `
        id,
        content_link,
        video_title,
        views,
        status,
        quality_score,
        creator_id,
        users!creator_id(username, full_name, profile_picture_url)
      `,
      )
      .in("id", slice);

    if (error) {
      console.error("[bulk-video-download-jobs] meta join failed:", error);
      continue;
    }

    for (const row of data || []) {
      const id = String(row.id);
      const submissionStatus = String(row.status || "pending").toLowerCase();
      const quality = Number(row.quality_score);
      out[id] = {
        submissionId: id,
        username: joinedUsername(row.users) || "unknown",
        videoTitle:
          typeof row.video_title === "string" && row.video_title.trim()
            ? row.video_title.trim()
            : "Untitled",
        link: typeof row.content_link === "string" ? row.content_link : "",
        views: Number(row.views) || 0,
        avatarUrl: joinedAvatar(row.users),
        displayName: joinedFullName(row.users),
        creatorId: row.creator_id ? String(row.creator_id) : null,
        submissionStatus,
        qualityScore: Number.isFinite(quality) ? quality : null,
      };
    }
  }

  return out;
}

export async function loadJobItemStatuses(
  jobId: string,
): Promise<BulkVideoDownloadItemStatus[]> {
  const admin = createAdminClient();
  const items: BulkVideoDownloadItemStatus[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await admin
      .from("bulk_video_download_job_items")
      .select("submission_id, status, error_message, updated_at")
      .eq("job_id", jobId)
      .order("submission_id", { ascending: true })
      .range(offset, offset + ITEM_PAGE_SIZE - 1);

    if (error) {
      console.error("[bulk-video-download-jobs] load items failed:", error);
      break;
    }
    const page = data || [];
    for (const row of page) {
      items.push({
        submissionId: String(row.submission_id),
        status:
          row.status === "success" || row.status === "failed"
            ? row.status
            : "pending",
        error:
          typeof row.error_message === "string" && row.error_message
            ? row.error_message
            : undefined,
        updatedAt: row.updated_at ? String(row.updated_at) : null,
      });
    }
    if (page.length < ITEM_PAGE_SIZE) break;
    offset += ITEM_PAGE_SIZE;
  }

  return items;
}

export async function replaceJobItems(
  jobId: string,
  submissionIds: string[],
  itemStatuses?: BulkVideoDownloadItemStatus[],
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const statusById = new Map(
    (itemStatuses || []).map((item) => [item.submissionId, item]),
  );

  // Clear previous rows (idempotent recreate / restart).
  const { error: deleteError } = await admin
    .from("bulk_video_download_job_items")
    .delete()
    .eq("job_id", jobId);
  if (deleteError) {
    console.error("[bulk-video-download-jobs] clear items failed:", deleteError);
    return { error: deleteError.message };
  }

  for (let i = 0; i < submissionIds.length; i += ITEM_PAGE_SIZE) {
    const slice = submissionIds.slice(i, i + ITEM_PAGE_SIZE);
    const rows = slice.map((submissionId) => {
      const status = statusById.get(submissionId);
      return {
        job_id: jobId,
        submission_id: submissionId,
        status: status?.status ?? "pending",
        error_message: status?.error ?? null,
        updated_at: new Date().toISOString(),
      };
    });
    const { error } = await admin
      .from("bulk_video_download_job_items")
      .upsert(rows, { onConflict: "job_id,submission_id" });
    if (error) {
      console.error("[bulk-video-download-jobs] insert items failed:", error);
      return { error: error.message };
    }
  }

  return {};
}

/** Upsert only changed/known statuses (progress updates). */
export async function upsertJobItemStatuses(
  jobId: string,
  itemStatuses: BulkVideoDownloadItemStatus[],
): Promise<{ error?: string }> {
  if (itemStatuses.length === 0) return {};
  const admin = createAdminClient();

  for (let i = 0; i < itemStatuses.length; i += ITEM_PAGE_SIZE) {
    const slice = itemStatuses.slice(i, i + ITEM_PAGE_SIZE);
    const rows = slice.map((item) => ({
      job_id: jobId,
      submission_id: item.submissionId,
      status: item.status,
      error_message: item.error ?? null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await admin
      .from("bulk_video_download_job_items")
      .upsert(rows, { onConflict: "job_id,submission_id" });
    if (error) {
      console.error("[bulk-video-download-jobs] upsert items failed:", error);
      return { error: error.message };
    }
  }

  return {};
}

export function buildEnrichedSession(
  job: BulkVideoDownloadJobRow,
  metaById: Record<string, BulkVideoDownloadSubmissionMeta>,
  itemStatuses: BulkVideoDownloadItemStatus[],
): BulkVideoDownloadSessionDto {
  const statusById = new Map(
    itemStatuses.map((item) => [item.submissionId, item]),
  );
  // Order comes from jobs.submission_ids (not a per-item sort_order column).
  const orderedIds =
    job.submission_ids.length > 0
      ? job.submission_ids
      : itemStatuses.map((item) => item.submissionId);

  const results: BulkVideoDownloadResultRow[] = orderedIds.map(
    (submissionId) => {
      const meta = metaById[submissionId];
      const statusRow = statusById.get(submissionId);
      const downloadedAt =
        statusRow?.status === "success" || statusRow?.status === "failed"
          ? statusRow.updatedAt || null
          : meta?.downloadedAt ?? null;
      return {
        submissionId,
        username: meta?.username ?? "unknown",
        videoTitle: meta?.videoTitle ?? "Untitled",
        link: meta?.link ?? "",
        views: meta?.views ?? 0,
        avatarUrl: meta?.avatarUrl ?? null,
        displayName: meta?.displayName ?? null,
        creatorId: meta?.creatorId ?? null,
        submissionStatus: meta?.submissionStatus ?? null,
        qualityScore: meta?.qualityScore ?? null,
        downloadedAt,
        status: statusRow?.status ?? "pending",
        error: statusRow?.error,
      };
    },
  );

  const successCount = results.filter((row) => row.status === "success").length;
  const failedCount = results.filter((row) => row.status === "failed").length;

  return {
    ...job,
    success_count: successCount,
    failed_count: failedCount,
    metaById,
    results,
  };
}

export async function enrichBulkVideoDownloadJob(
  job: BulkVideoDownloadJobRow,
): Promise<BulkVideoDownloadSessionDto> {
  const [metaById, itemStatuses] = await Promise.all([
    loadSubmissionMetaByIds(job.submission_ids),
    loadJobItemStatuses(job.id),
  ]);
  return buildEnrichedSession(job, metaById, itemStatuses);
}

export type CreateBulkVideoDownloadJobInput = {
  id: string;
  contestId: string;
  userId: string;
  userType: "admin" | "advertiser";
  totalCount: number;
  zipPartTotal: number;
  videosPerZip: number;
  namingPattern?: VideoFilenamePattern | string | null;
  fileNamePrefix?: string | null;
  submissionIds: string[];
  zipParts: BulkVideoDownloadZipPart[];
  itemStatuses?: BulkVideoDownloadItemStatus[];
  /** cloud (default) | desktop — requires 20260905 migration. */
  source?: "cloud" | "desktop";
  deliveryMode?: string | null;
  /** Initial job status; desktop jobs start queued until the app reports started. */
  status?: BulkVideoDownloadJobStatus;
};

export async function createBulkVideoDownloadJob(
  input: CreateBulkVideoDownloadJobInput,
): Promise<{ data: BulkVideoDownloadJobRow | null; error?: string }> {
  const admin = createAdminClient();
  const submissionIds = input.submissionIds.filter(Boolean);

  const status = input.status ?? "running";
  const insertRow: Record<string, unknown> = {
    id: input.id,
    contest_id: input.contestId,
    user_id: input.userId,
    user_type: input.userType,
    status,
    total_count: input.totalCount || submissionIds.length,
    success_count: 0,
    failed_count: 0,
    zip_part_index: 1,
    zip_part_total: Math.max(1, input.zipPartTotal),
    videos_per_zip: input.videosPerZip,
    naming_pattern: input.namingPattern ?? null,
    file_name_prefix: input.fileNamePrefix ?? null,
    submission_ids: submissionIds,
    zip_parts: input.zipParts,
    started_at: status === "queued" ? null : new Date().toISOString(),
  };
  if (input.source) insertRow.source = input.source;
  if (input.deliveryMode !== undefined) {
    insertRow.delivery_mode = input.deliveryMode;
  }

  const { data, error } = await admin
    .from("bulk_video_download_jobs")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) {
    // Retry without desktop-only columns if migration not applied yet.
    const message = error.message || "";
    const missingDesktopCols =
      /source|delivery_mode/i.test(message) &&
      (input.source || input.deliveryMode !== undefined);
    if (missingDesktopCols) {
      delete insertRow.source;
      delete insertRow.delivery_mode;
      const retry = await admin
        .from("bulk_video_download_jobs")
        .insert(insertRow)
        .select("*")
        .single();
      if (retry.error) {
        console.error("[bulk-video-download-jobs] create failed:", retry.error);
        return { data: null, error: retry.error.message };
      }
      const job = normalizeJobRow(retry.data as Record<string, unknown>);
      const itemsResult = await replaceJobItems(
        job.id,
        submissionIds,
        input.itemStatuses,
      );
      if (itemsResult.error) {
        return { data: null, error: itemsResult.error };
      }
      return { data: job };
    }
    console.error("[bulk-video-download-jobs] create failed:", error);
    return { data: null, error: error.message };
  }

  const job = normalizeJobRow(data as Record<string, unknown>);
  const itemsResult = await replaceJobItems(
    job.id,
    submissionIds,
    input.itemStatuses,
  );
  if (itemsResult.error) {
    return { data: null, error: itemsResult.error };
  }
  return { data: job };
}

export type UpdateBulkVideoDownloadJobInput = {
  id: string;
  userId: string;
  status?: BulkVideoDownloadJobStatus;
  successCount?: number;
  failedCount?: number;
  zipPartIndex?: number;
  zipPartTotal?: number;
  zipParts?: BulkVideoDownloadZipPart[];
  itemStatuses?: BulkVideoDownloadItemStatus[];
  errorMessage?: string | null;
  /** Mark floating summary button as seen (sets summary_viewed + summary_viewed_at). */
  summaryViewed?: boolean;
};

export async function updateBulkVideoDownloadJob(
  input: UpdateBulkVideoDownloadJobInput,
): Promise<{ data: BulkVideoDownloadJobRow | null; error?: string }> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.status) patch.status = input.status;
  if (typeof input.successCount === "number") {
    patch.success_count = Math.max(0, input.successCount);
  }
  if (typeof input.failedCount === "number") {
    patch.failed_count = Math.max(0, input.failedCount);
  }
  if (typeof input.zipPartIndex === "number") {
    patch.zip_part_index = Math.max(1, input.zipPartIndex);
  }
  if (typeof input.zipPartTotal === "number") {
    patch.zip_part_total = Math.max(1, input.zipPartTotal);
  }
  if (input.errorMessage !== undefined) {
    patch.error_message = input.errorMessage;
  }
  if (input.summaryViewed === true) {
    patch.summary_viewed = true;
    patch.summary_viewed_at = new Date().toISOString();
  }
  if (input.status === "completed" || input.status === "failed") {
    patch.finished_at = new Date().toISOString();
  }

  const existing = await getBulkVideoDownloadJobById({
    id: input.id,
    userId: input.userId,
  });
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) return { data: null };

  const allowedIds = existing.data.submission_ids;
  const scopedStatuses =
    input.itemStatuses && input.itemStatuses.length > 0
      ? scopeItemStatusesToJob(input.itemStatuses, allowedIds)
      : [];
  if (input.zipParts) {
    patch.zip_parts = scopeZipPartsToJob(input.zipParts, allowedIds);
  }

  if (scopedStatuses.length > 0) {
    const itemsResult = await upsertJobItemStatuses(input.id, scopedStatuses);
    if (itemsResult.error) {
      return { data: null, error: itemsResult.error };
    }
    // Terminal sessions: derive counts from all stored item rows (authoritative).
    if (input.status === "completed" || input.status === "failed") {
      const allItems = await loadJobItemStatuses(input.id);
      patch.success_count = allItems.filter(
        (item) => item.status === "success",
      ).length;
      patch.failed_count = allItems.filter(
        (item) => item.status === "failed",
      ).length;
    }
  }

  const { data, error } = await admin
    .from("bulk_video_download_jobs")
    .update(Object.keys(patch).length > 0 ? patch : { updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[bulk-video-download-jobs] update failed:", error);
    return { data: null, error: error.message };
  }
  if (!data) return { data: null };
  return { data: normalizeJobRow(data as Record<string, unknown>) };
}

export async function listBulkVideoDownloadJobsForContest(options: {
  contestId: string;
  viewer: DownloadAccessUser;
  limit?: number;
}): Promise<{ data: BulkVideoDownloadJobRow[]; error?: string }> {
  const admin = createAdminClient();
  const limit = Math.min(50, Math.max(1, options.limit ?? 30));
  let query = admin
    .from("bulk_video_download_jobs")
    .select(
      "id, contest_id, user_id, user_type, status, total_count, success_count, failed_count, zip_part_total, naming_pattern, file_name_prefix, created_at, finished_at",
    )
    .eq("contest_id", options.contestId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (options.viewer.user_type !== "admin") {
    query = query.eq("user_id", options.viewer.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[bulk-video-download-jobs] list failed:", error);
    return { data: [], error: error.message };
  }
  return {
    data: (data || []).map((row) =>
      normalizeJobRow(row as Record<string, unknown>),
    ),
  };
}

export async function findBulkVideoDownloadJobByZipPartId(options: {
  jobId: string;
}): Promise<{ data: BulkVideoDownloadJobRow | null; error?: string }> {
  const admin = createAdminClient();
  const { data: byId, error: byIdError } = await admin
    .from("bulk_video_download_jobs")
    .select("*")
    .eq("id", options.jobId)
    .maybeSingle();
  if (byIdError) {
    console.error("[bulk-video-download-jobs] find by id failed:", byIdError);
    return { data: null, error: byIdError.message };
  }
  if (byId) {
    return { data: normalizeJobRow(byId as Record<string, unknown>) };
  }

  const { data: byPart, error: byPartError } = await admin
    .from("bulk_video_download_jobs")
    .select("*")
    .contains("zip_parts", [{ jobId: options.jobId }])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byPartError) {
    console.error(
      "[bulk-video-download-jobs] find by zip part failed:",
      byPartError,
    );
    return { data: null, error: byPartError.message };
  }
  if (!byPart) return { data: null };
  return { data: normalizeJobRow(byPart as Record<string, unknown>) };
}

export async function getLatestBulkVideoDownloadJobForContest(options: {
  contestId: string;
  userId: string;
  finishedMaxAgeMs?: number;
}): Promise<{ data: BulkVideoDownloadJobRow | null; error?: string }> {
  const admin = createAdminClient();
  const finishedMaxAgeMs = options.finishedMaxAgeMs ?? 24 * 60 * 60 * 1000;

  const { data, error } = await admin
    .from("bulk_video_download_jobs")
    .select("*")
    .eq("contest_id", options.contestId)
    .eq("user_id", options.userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[bulk-video-download-jobs] get latest failed:", error);
    return { data: null, error: error.message };
  }

  const rows = (data || []).map((row) =>
    normalizeJobRow(row as Record<string, unknown>),
  );
  const now = Date.now();
  const match =
    rows.find((row) => row.status === "queued" || row.status === "running") ||
    rows.find((row) => {
      if (row.status !== "completed" && row.status !== "failed") return false;
      const updated = Date.parse(
        row.updated_at || row.finished_at || row.created_at,
      );
      return Number.isFinite(updated) && now - updated <= finishedMaxAgeMs;
    }) ||
    null;

  return { data: match };
}

export async function getBulkVideoDownloadJobById(options: {
  id: string;
  userId?: string;
}): Promise<{ data: BulkVideoDownloadJobRow | null; error?: string }> {
  const admin = createAdminClient();
  let query = admin
    .from("bulk_video_download_jobs")
    .select("*")
    .eq("id", options.id);
  if (options.userId) {
    query = query.eq("user_id", options.userId);
  }
  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[bulk-video-download-jobs] get by id failed:", error);
    return { data: null, error: error.message };
  }
  if (!data) return { data: null };
  return { data: normalizeJobRow(data as Record<string, unknown>) };
}

export function viewerCanAccessBulkVideoDownloadJob(options: {
  viewer: DownloadAccessUser;
  job: Pick<BulkVideoDownloadJobRow, "user_id">;
}): boolean {
  return canAccessBulkVideoDownloadJob({
    viewerUserType: options.viewer.user_type,
    viewerUserId: options.viewer.id,
    jobUserId: options.job.user_id,
  });
}
