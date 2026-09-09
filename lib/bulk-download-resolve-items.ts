import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAdminDownloadUser,
  MAX_BULK_VIDEO_DOWNLOADS,
  submissionOwnedByDownloadUser,
  type DownloadAccessUser,
} from "@/lib/video-download-auth";
import {
  joinedRecordAdvertiserId,
  joinedRecordUsername,
  uniqueVideoDownloadFilename,
  toBulkZipDownloadFilename,
  type VideoFilenamePattern,
} from "@/lib/video-download-filename";
import { fetchByIdsInChunks } from "@/lib/supabase-in-id-chunks";

export type ResolvedBulkDownloadItem = {
  submissionId?: string;
  url: string;
  filename: string;
  isInstagram: boolean;
};

export type RejectedBulkDownloadReason =
  | "not_found"
  | "not_owned"
  | "missing_url"
  | "unsupported_url"
  | "invalid_url";

export type RejectedBulkDownloadItem = {
  submissionId?: string;
  url?: string;
  reason: RejectedBulkDownloadReason;
  detail?: string;
};

export type ResolveBulkDownloadItemsResult = {
  items: ResolvedBulkDownloadItem[];
  /** @deprecated prefer `items` — alias for accepted items */
  accepted: ResolvedBulkDownloadItem[];
  rejected: RejectedBulkDownloadItem[];
  contestTitle: string | null;
  contestId: string | null;
};

export type ResolveBulkDownloadItemsOk = {
  ok: true;
  result: ResolveBulkDownloadItemsResult;
};

export type ResolveBulkDownloadItemsErr = {
  ok: false;
  error: string;
  status: number;
};

export function isSupportedVideoUrl(
  url: string,
): { ok: true; isInstagram: boolean } | { ok: false } {
  const isInstagram = url.includes("instagram.com");
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
  if (!isInstagram && !isYouTube) return { ok: false };
  return { ok: true, isInstagram };
}

export function zipPartFilename(
  base: string,
  partIndex: number,
  partTotal: number,
): string {
  const cleaned = toBulkZipDownloadFilename(base).replace(/\.zip$/i, "");
  if (partTotal <= 1) return `${cleaned}.zip`;
  return `${cleaned}_part_${partIndex}_of_${partTotal}.zip`;
}

export async function resolveBulkDownloadItems(params: {
  supabase: SupabaseClient;
  user: DownloadAccessUser;
  submissionIds?: string[];
  urls?: string[];
  namingPattern: VideoFilenamePattern;
  format?: string;
}): Promise<ResolveBulkDownloadItemsOk | ResolveBulkDownloadItemsErr> {
  const format = params.format || "mp4";
  const submissionIdList = (params.submissionIds || []).filter(
    (id) => typeof id === "string" && id.length > 0,
  );
  const urlList = (params.urls || []).filter(
    (url) => typeof url === "string" && url.length > 0,
  );

  const accepted: ResolvedBulkDownloadItem[] = [];
  const rejected: RejectedBulkDownloadItem[] = [];
  let contestTitle: string | null = null;
  let contestId: string | null = null;

  try {
    if (submissionIdList.length > 0) {
      const { data: submissions, error: submissionsError } =
        await fetchByIdsInChunks<{
          id: string;
          content_link: string | null;
          platform: string | null;
          views: number | null;
          status: string | null;
          quality_score: number | null;
          contests: unknown;
          users: unknown;
        }>({
          ids: submissionIdList,
          fetchChunk: (chunkIds) =>
            params.supabase
              .from("submissions")
              .select(`
                id,
                content_link,
                platform,
                views,
                status,
                quality_score,
                contests!inner(id, title, advertiser_id),
                users!creator_id(username)
              `)
              .in("id", chunkIds),
        });

      if (submissionsError) {
        return {
          ok: false,
          error: "Failed to fetch submissions information",
          status: 500,
        };
      }

      const byId = new Map(
        (submissions || []).map((sub) => [String(sub.id), sub]),
      );
      const usedFilenames = new Set<string>();
      const sortTotal = submissionIdList.length;

      for (let index = 0; index < submissionIdList.length; index++) {
        const submissionId = submissionIdList[index];
        const sub = byId.get(submissionId);
        if (!sub) {
          rejected.push({ submissionId, reason: "not_found" });
          continue;
        }
        const advertiserId = joinedRecordAdvertiserId(sub.contests);
        if (!submissionOwnedByDownloadUser(params.user, advertiserId)) {
          rejected.push({ submissionId, reason: "not_owned" });
          continue;
        }

        if (!contestTitle) {
          const contest = Array.isArray(sub.contests)
            ? sub.contests[0]
            : sub.contests;
          const title = (contest as { title?: string; id?: string } | null)
            ?.title;
          const id = (contest as { title?: string; id?: string } | null)?.id;
          if (typeof title === "string" && title.trim()) {
            contestTitle = title.trim();
          }
          if (typeof id === "string" && id.trim()) {
            contestId = id.trim();
          }
        }
        if (!sub.content_link) {
          rejected.push({ submissionId, reason: "missing_url" });
          continue;
        }
        const supported = isSupportedVideoUrl(sub.content_link);
        if (!supported.ok) {
          rejected.push({
            submissionId,
            url: sub.content_link,
            reason: "unsupported_url",
          });
          continue;
        }

        const filename = uniqueVideoDownloadFilename(
          usedFilenames,
          params.namingPattern,
          {
            views: sub.views,
            username: joinedRecordUsername(sub.users),
            status: typeof sub.status === "string" ? sub.status : null,
            qualityScore:
              sub.quality_score == null ? null : Number(sub.quality_score),
            uniqueSuffix: String(sub.id).slice(0, 8),
            sortRank: index + 1,
            sortTotal,
          },
          format,
        );

        accepted.push({
          submissionId: String(sub.id),
          url: sub.content_link,
          filename,
          isInstagram: supported.isInstagram,
        });
      }
    } else if (urlList.length > 0) {
      if (!isAdminDownloadUser(params.user)) {
        return {
          ok: false,
          error: "Custom URL bulk download is restricted to admins.",
          status: 403,
        };
      }
      if (urlList.length > MAX_BULK_VIDEO_DOWNLOADS) {
        return {
          ok: false,
          error: `Too many URLs. Provide at most ${MAX_BULK_VIDEO_DOWNLOADS} URLs per ZIP download.`,
          status: 400,
        };
      }
      for (let i = 0; i < urlList.length; i++) {
        const url = urlList[i];
        const supported = isSupportedVideoUrl(url);
        if (!supported.ok) {
          rejected.push({ url, reason: "unsupported_url" });
          continue;
        }
        accepted.push({
          url,
          filename: `video_${i + 1}.${format}`,
          isInstagram: supported.isInstagram,
        });
      }
    }

    return {
      ok: true,
      result: {
        items: accepted,
        accepted,
        rejected,
        contestTitle,
        contestId,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to resolve download items";
    return { ok: false, error: message, status: 500 };
  }
}
