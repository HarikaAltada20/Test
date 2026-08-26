import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import {
  isAdminDownloadUser,
  MAX_BULK_VIDEO_DOWNLOADS,
  submissionOwnedByDownloadUser,
  verifyAdminOrBrandDownloadAccess,
} from "@/lib/video-download-auth";
import {
  joinedRecordAdvertiserId,
  joinedRecordUsername,
  parseVideoFilenamePattern,
  uniqueVideoDownloadFilename,
  bulkZipFilenameFromContestTitle,
  toBulkZipDownloadFilename,
} from "@/lib/video-download-filename";
import {
  createVideoDownloadBatchAndEnqueueFirst,
  isVideoDownloadQueueEnabled,
  type VideoDownloadBatchPart,
  type VideoDownloadItem,
} from "@/lib/queue/video-download-queue";
import { executeQueuedVideoDownloads } from "@/lib/video-download-execute";
import { kickProcessVideoDownloadQueue } from "@/lib/video-download-kick";
import {
  chunkArray,
  parseVideosPerZip,
} from "@/lib/video-download-ui";
import { fetchByIdsInChunks } from "@/lib/supabase-in-id-chunks";

export const maxDuration = 300;

type ResolvedDownloadItem = VideoDownloadItem & { submissionId?: string };

function isSupportedVideoUrl(
  url: string,
): { ok: true; isInstagram: boolean } | { ok: false } {
  const isInstagram = url.includes("instagram.com");
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
  if (!isInstagram && !isYouTube) return { ok: false };
  return { ok: true, isInstagram };
}

function zipPartFilename(base: string, partIndex: number, partTotal: number): string {
  const cleaned = toBulkZipDownloadFilename(base).replace(/\.zip$/i, "");
  if (partTotal <= 1) return `${cleaned}.zip`;
  return `${cleaned}_part_${partIndex}_of_${partTotal}.zip`;
}

export async function POST(request: Request) {
  const requestId = randomUUID().substring(0, 8);

  try {
    const access = await verifyAdminOrBrandDownloadAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error || "Admin or brand access required" },
        { status: 403 },
      );
    }

    const { user, supabase } = access;
    const body = await request.json().catch(() => ({}));
    const {
      urls = [],
      submissionIds = [],
      namingPattern: rawNamingPattern,
      zipFilename: rawZipFilename,
      videosPerZip: rawVideosPerZip,
      options = {},
    } = body as {
      urls?: unknown;
      submissionIds?: unknown;
      namingPattern?: unknown;
      zipFilename?: unknown;
      videosPerZip?: unknown;
      options?: {
        format?: string;
        namingPattern?: unknown;
        zipFilename?: unknown;
        videosPerZip?: unknown;
      };
    };
    const namingPattern = parseVideoFilenamePattern(
      rawNamingPattern ?? options?.namingPattern,
    );
    const videosPerZip = parseVideosPerZip(
      rawVideosPerZip ?? options?.videosPerZip ?? MAX_BULK_VIDEO_DOWNLOADS,
    );
    console.log(`[BULK-${requestId}] Naming pattern: ${namingPattern}`);

    if (options?.format === "audio" || options?.format === "mp3") {
      return NextResponse.json(
        {
          error:
            "Audio-only downloads are not supported. Use format mp4 (default).",
        },
        { status: 400 },
      );
    }
    const format = "mp4";

    const submissionIdList = Array.isArray(submissionIds)
      ? submissionIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const urlList = Array.isArray(urls)
      ? urls.filter((url): url is string => typeof url === "string" && url.length > 0)
      : [];

    if (urlList.length > 0 && !isAdminDownloadUser(user)) {
      return NextResponse.json(
        { error: "Custom URL bulk download is restricted to admins." },
        { status: 403 },
      );
    }

    if (urlList.length > MAX_BULK_VIDEO_DOWNLOADS) {
      return NextResponse.json(
        {
          error: `Too many URLs. Provide at most ${MAX_BULK_VIDEO_DOWNLOADS} URLs per ZIP download.`,
          max: MAX_BULK_VIDEO_DOWNLOADS,
        },
        { status: 400 },
      );
    }

    const resolvedItems: ResolvedDownloadItem[] = [];
    let contestTitle: string | null = null;

    if (submissionIdList.length > 0) {
      console.log(`[BULK-${requestId}] Resolving ${submissionIdList.length} submission IDs`);
      // PostgREST rejects huge `.in(id, …)` filters (Bad Request). Chunk the lookup.
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
            supabase
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
        console.error(`[BULK-${requestId}] Database fetch error:`, submissionsError);
        return NextResponse.json(
          { error: "Failed to fetch submissions information" },
          { status: 500 },
        );
      }

      const byId = new Map((submissions || []).map((sub) => [String(sub.id), sub]));
      const usedFilenames = new Set<string>();
      const sortTotal = submissionIdList.length;

      // Preserve client selection order so ZIP parts match the UI batches.
      // Prefix filenames with sort rank so Explorer name order matches the
      // selected leaderboard sort (e.g. views high → low).
      for (let index = 0; index < submissionIdList.length; index++) {
        const submissionId = submissionIdList[index];
        const sub = byId.get(submissionId);
        if (!sub) continue;
        const advertiserId = joinedRecordAdvertiserId(sub.contests);
        if (!submissionOwnedByDownloadUser(user, advertiserId)) continue;

        if (!contestTitle) {
          const contest = Array.isArray(sub.contests) ? sub.contests[0] : sub.contests;
          const title = (contest as { title?: string } | null)?.title;
          if (typeof title === "string" && title.trim()) contestTitle = title.trim();
        }
        if (!sub.content_link) continue;
        const supported = isSupportedVideoUrl(sub.content_link);
        if (!supported.ok) continue;

        const filename = uniqueVideoDownloadFilename(
          usedFilenames,
          namingPattern,
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

        resolvedItems.push({
          submissionId: String(sub.id),
          url: sub.content_link,
          filename,
          isInstagram: supported.isInstagram,
        });
      }

      if (resolvedItems.length === 0) {
        return NextResponse.json(
          { error: "No accessible submissions found for download" },
          { status: 403 },
        );
      }
    } else if (urlList.length > 0) {
      console.log(`[BULK-${requestId}] Resolving ${urlList.length} admin custom URLs`);
      for (let i = 0; i < urlList.length; i++) {
        const url = urlList[i];
        const supported = isSupportedVideoUrl(url);
        if (!supported.ok) continue;
        resolvedItems.push({
          url,
          filename: `video_${i + 1}.${format}`,
          isInstagram: supported.isInstagram,
        });
      }
    }

    if (resolvedItems.length === 0) {
      return NextResponse.json(
        { error: "No valid Instagram/YouTube submissions to download" },
        { status: 400 },
      );
    }

    const zipFilenameBase =
      rawZipFilename ??
      options?.zipFilename ??
      bulkZipFilenameFromContestTitle(contestTitle);

    const itemChunks =
      submissionIdList.length > 0
        ? chunkArray(resolvedItems, videosPerZip)
        : [resolvedItems];

    for (const chunk of itemChunks) {
      if (chunk.length > MAX_BULK_VIDEO_DOWNLOADS) {
        return NextResponse.json(
          {
            error: `Too many videos in one ZIP. Use at most ${MAX_BULK_VIDEO_DOWNLOADS} videos per ZIP.`,
            max: MAX_BULK_VIDEO_DOWNLOADS,
          },
          { status: 400 },
        );
      }
    }

    if (isVideoDownloadQueueEnabled()) {
      const batchId = randomUUID();
      const partTotal = itemChunks.length;
      const parts: VideoDownloadBatchPart[] = itemChunks.map((chunk, index) => {
        const jobId = randomUUID();
        const zipFilename = zipPartFilename(String(zipFilenameBase), index + 1, partTotal);
        return {
          jobId,
          zipFilename,
          submissionIds: chunk
            .map((item) => item.submissionId)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
          items: chunk.map(({ url, filename, isInstagram }) => ({
            url,
            filename,
            isInstagram,
          })),
        };
      });

      const created = await createVideoDownloadBatchAndEnqueueFirst({
        batchId,
        userId: user.id,
        parts,
      });
      if (created.error) {
        return NextResponse.json(
          { error: created.error || "Failed to enqueue download job" },
          { status: created.status || 500 },
        );
      }

      await kickProcessVideoDownloadQueue(request);
      return NextResponse.json({
        queued: true,
        batchId,
        jobId: parts[0]?.jobId,
        total: resolvedItems.length,
        videosPerZip,
        jobs: parts.map((part, index) => ({
          jobId: part.jobId,
          chunkIndex: index + 1,
          totalChunks: partTotal,
          submissionIds: part.submissionIds,
          zipFilename: part.zipFilename,
          itemCount: part.items.length,
        })),
      });
    }

    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error:
            "Video download queue is not configured. Bulk ZIP downloads require Redis in production.",
        },
        { status: 503 },
      );
    }

    if (itemChunks.length > 1) {
      return NextResponse.json(
        {
          error:
            "Multi-ZIP downloads require the Redis video download queue. Configure UPSTASH Redis or reduce videos per ZIP so everything fits in one ZIP.",
        },
        { status: 503 },
      );
    }

    const downloadQueue = itemChunks[0].map(({ url, filename, isInstagram }) => ({
      url,
      filename,
      isInstagram,
    }));
    const zipFilename = zipPartFilename(String(zipFilenameBase), 1, 1);

    const result = await executeQueuedVideoDownloads({
      items: downloadQueue,
      requestId,
    });

    const deferredFailed = result.deferredItems.length;
    if (result.downloaded === 0 || !result.zipPath) {
      await result.cleanup();
      return NextResponse.json(
        {
          error: result.failures[0]?.error || "No files could be downloaded",
          completed: 0,
          failed: result.failures.length + deferredFailed,
        },
        { status: 422 },
      );
    }

    try {
      const zipStat = await stat(result.zipPath);
      const nodeStream = createReadStream(result.zipPath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
      const cleanupOnce = () => {
        void result.cleanup();
      };
      nodeStream.on("close", cleanupOnce);
      nodeStream.on("error", cleanupOnce);
      return new NextResponse(webStream, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipFilename}"`,
          "Content-Length": String(zipStat.size),
          "Cache-Control": "no-cache",
          "X-Bulk-Downloaded": String(result.downloaded),
          "X-Bulk-Failed": String(result.failures.length + deferredFailed),
        },
      });
    } catch (streamError) {
      await result.cleanup();
      throw streamError;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initiate bulk download";
    console.error(`[BULK-${requestId}] Fatal bulk downloader error:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
