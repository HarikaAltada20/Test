import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";
import { fetchByIdsInChunks } from "@/lib/supabase-in-id-chunks";
import { MAX_BULK_VIDEO_DOWNLOAD_SESSION_SUBMISSIONS } from "@/lib/queue/bulk-job-limits";
import {
  submissionOwnedByDownloadUser,
  type DownloadAccessUser,
} from "@/lib/video-download-auth";
import type {
  BulkVideoDownloadItemStatus,
  BulkVideoDownloadZipPart,
} from "@/lib/bulk-video-download-jobs";

export { MAX_BULK_VIDEO_DOWNLOAD_SESSION_SUBMISSIONS };

export type SessionAccessFailure = {
  ok: false;
  status: number;
  error: string;
};

export type SessionContestAccessOk = {
  ok: true;
  contestId: string;
};

export type SessionSubmissionsAccessOk = {
  ok: true;
  submissionIds: string[];
};

/** Unique IDs from the top-level list and any ZIP-part lists, preserving first-seen order. */
export function collectSessionSubmissionIds(
  submissionIds: string[],
  zipParts: Array<{ submissionIds?: string[] }>,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const push = (id: unknown) => {
    if (typeof id !== "string") return;
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    ordered.push(trimmed);
  };
  for (const id of submissionIds) push(id);
  for (const part of zipParts) {
    for (const id of part.submissionIds || []) push(id);
  }
  return ordered;
}

export function tooManySessionSubmissions(
  count: number,
  max = MAX_BULK_VIDEO_DOWNLOAD_SESSION_SUBMISSIONS,
): boolean {
  return count > max;
}

/**
 * Every requested ID must already belong to the contest.
 * Reject (do not silently drop) so a mixed owned+stolen list cannot create a session.
 */
export function allSubmissionsBelongToContest(
  requestedIds: string[],
  contestSubmissionIds: Iterable<string>,
): boolean {
  if (requestedIds.length === 0) return false;
  const allowed = new Set(
    [...contestSubmissionIds].map((id) => String(id).trim()).filter(Boolean),
  );
  return requestedIds.every((id) => allowed.has(id));
}

export function scopeItemStatusesToJob(
  itemStatuses: BulkVideoDownloadItemStatus[],
  allowedIds: Iterable<string>,
): BulkVideoDownloadItemStatus[] {
  const allowed = new Set(
    [...allowedIds].map((id) => String(id).trim()).filter(Boolean),
  );
  return itemStatuses.filter((row) => allowed.has(row.submissionId));
}

export function scopeZipPartsToJob(
  zipParts: BulkVideoDownloadZipPart[],
  allowedIds: Iterable<string>,
): BulkVideoDownloadZipPart[] {
  const allowed = new Set(
    [...allowedIds].map((id) => String(id).trim()).filter(Boolean),
  );
  return zipParts.map((part) => ({
    ...part,
    submissionIds: part.submissionIds.filter((id) => allowed.has(id)),
  }));
}

export async function verifyDownloadContestAccess(options: {
  supabase: SupabaseClient;
  viewer: DownloadAccessUser;
  contestId: string;
}): Promise<SessionContestAccessOk | SessionAccessFailure> {
  const contestId = options.contestId.trim();
  if (!contestId) {
    return { ok: false, status: 400, error: "contestId is required" };
  }

  const { data: contest, error } = await options.supabase
    .from("contests")
    .select("id, advertiser_id")
    .eq("id", contestId)
    .maybeSingle();

  if (error) {
    console.error("[bulk-download-session] contest lookup failed:", error);
    return { ok: false, status: 500, error: "Failed to verify contest access" };
  }

  if (!contest) {
    return { ok: false, status: 404, error: "Contest not found" };
  }

  if (
    !submissionOwnedByDownloadUser(
      options.viewer,
      typeof contest.advertiser_id === "string" ? contest.advertiser_id : null,
    )
  ) {
    return { ok: false, status: 404, error: "Contest not found" };
  }

  return { ok: true, contestId: String(contest.id) };
}

/**
 * Confirm every submission ID belongs to this contest.
 * Uses the service role only after contest ownership is already proven.
 */
export async function assertSessionSubmissionsOnContest(options: {
  contestId: string;
  submissionIds: string[];
}): Promise<SessionSubmissionsAccessOk | SessionAccessFailure> {
  const uniqueIds = collectSessionSubmissionIds(options.submissionIds, []);
  if (uniqueIds.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "At least 2 submissionIds are required",
    };
  }
  if (tooManySessionSubmissions(uniqueIds.length)) {
    return {
      ok: false,
      status: 400,
      error: `Too many submissions. Bulk download sessions support at most ${MAX_BULK_VIDEO_DOWNLOAD_SESSION_SUBMISSIONS} videos.`,
    };
  }

  const admin = createAdminClient();
  const { data, error } = await fetchByIdsInChunks<{ id: string }>({
    ids: uniqueIds,
    fetchChunk: async (chunkIds) => {
      const result = await admin
        .from("submissions")
        .select("id")
        .eq("contest_id", options.contestId)
        .in("id", chunkIds);
      return { data: result.data, error: result.error };
    },
  });

  if (error) {
    console.error("[bulk-download-session] submission lookup failed:", error);
    return {
      ok: false,
      status: 500,
      error: "Failed to validate submissions",
    };
  }

  const found = new Set((data || []).map((row) => String(row.id)));
  if (!allSubmissionsBelongToContest(uniqueIds, found)) {
    return {
      ok: false,
      status: 404,
      error: "One or more submissions were not found for this contest",
    };
  }

  return { ok: true, submissionIds: uniqueIds };
}
