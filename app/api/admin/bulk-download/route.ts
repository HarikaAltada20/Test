import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import {
  isAdminDownloadUser,
  MAX_BULK_VIDEO_DOWNLOADS,
  submissionOwnedByDownloadUser,
  verifyAdminOrBrandDownloadAccess,
} from "@/lib/video-download-auth";
import {
  joinedRecordUsername,
  parseVideoFilenamePattern,
  uniqueVideoDownloadFilename,
  bulkZipFilenameFromContestTitle,
  toBulkZipDownloadFilename,
} from "@/lib/video-download-filename";
import {
  enqueueVideoDownloadJob,
  isVideoDownloadQueueEnabled,
  type VideoDownloadItem,
} from "@/lib/queue/video-download-queue";
import { executeQueuedVideoDownloads } from "@/lib/video-download-execute";
import { kickProcessVideoDownloadQueue } from "@/lib/video-download-kick";

export const maxDuration = 300;

function isSupportedVideoUrl(
  url: string,
): { ok: true; isInstagram: boolean } | { ok: false } {
  const isInstagram = url.includes("instagram.com");
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
  if (!isInstagram && !isYouTube) return { ok: false };
  return { ok: true, isInstagram };
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
      options = {},
    } = body as {
      urls?: unknown;
      submissionIds?: unknown;
      namingPattern?: unknown;
      zipFilename?: unknown;
      options?: { format?: string; namingPattern?: unknown; zipFilename?: unknown };
    };
    const namingPattern = parseVideoFilenamePattern(
      rawNamingPattern ?? options?.namingPattern,
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

    if (submissionIdList.length > MAX_BULK_VIDEO_DOWNLOADS) {
      return NextResponse.json(
        {
          error: `Too many submissions. Select at most ${MAX_BULK_VIDEO_DOWNLOADS} videos per ZIP download.`,
          max: MAX_BULK_VIDEO_DOWNLOADS,
        },
        { status: 400 },
      );
    }

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

    const downloadQueue: VideoDownloadItem[] = [];
    let contestTitle: string | null = null;

    if (submissionIdList.length > 0) {
      console.log(`[BULK-${requestId}] Resolving ${submissionIdList.length} submission IDs`);
      const { data: submissions, error: submissionsError } = await supabase
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
        .in("id", submissionIdList);

      if (submissionsError) {
        console.error(`[BULK-${requestId}] Database fetch error:`, submissionsError);
        return NextResponse.json(
          { error: "Failed to fetch submissions information" },
          { status: 500 },
        );
      }

      const owned = (submissions || []).filter((sub) => {
        const advertiserId = (sub.contests as { advertiser_id?: string } | null)?.advertiser_id;
        return submissionOwnedByDownloadUser(user, advertiserId);
      });

      if (owned.length === 0) {
        return NextResponse.json(
          { error: "No accessible submissions found for download" },
          { status: 403 },
        );
      }

      if (owned.length < submissionIdList.length && !isAdminDownloadUser(user)) {
        console.warn(
          `[BULK-${requestId}] Dropped ${submissionIdList.length - owned.length} unauthorized submission(s)`,
        );
      }

      const ownedSorted = [...owned].sort(
        (a, b) => (Number(b.views) || 0) - (Number(a.views) || 0),
      );
      const usedFilenames = new Set<string>();

      for (const sub of ownedSorted) {
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
          },
          format,
        );

        downloadQueue.push({
          url: sub.content_link,
          filename,
          isInstagram: supported.isInstagram,
        });
      }
    } else if (urlList.length > 0) {
      console.log(`[BULK-${requestId}] Resolving ${urlList.length} admin custom URLs`);
      for (let i = 0; i < urlList.length; i++) {
        const url = urlList[i];
        const supported = isSupportedVideoUrl(url);
        if (!supported.ok) continue;
        downloadQueue.push({
          url,
          filename: `video_${i + 1}.${format}`,
          isInstagram: supported.isInstagram,
        });
      }
    }

    if (downloadQueue.length === 0) {
      return NextResponse.json(
        { error: "No valid Instagram/YouTube submissions to download" },
        { status: 400 },
      );
    }

    const zipFilename = toBulkZipDownloadFilename(
      rawZipFilename ??
        options?.zipFilename ??
        bulkZipFilenameFromContestTitle(contestTitle),
    );

    if (isVideoDownloadQueueEnabled()) {
      const jobId = randomUUID();
      const enqueued = await enqueueVideoDownloadJob({
        jobId,
        userId: user.id,
        items: downloadQueue,
        zipFilename,
      });
      if (enqueued.error) {
        return NextResponse.json(
          { error: enqueued.error || "Failed to enqueue download job" },
          { status: enqueued.status || 500 },
        );
      }
      await kickProcessVideoDownloadQueue(request);
      return NextResponse.json({
        queued: true,
        jobId,
        total: downloadQueue.length,
      });
    }

    const result = await executeQueuedVideoDownloads({
      items: downloadQueue,
      requestId,
    });

    try {
      if (result.downloaded === 0 || !result.zipPath) {
        return NextResponse.json(
          {
            error: result.failures[0]?.error || "No files could be downloaded",
            completed: 0,
            failed: result.failures.length,
          },
          { status: 422 },
        );
      }

      const zipBuffer = await readFile(result.zipPath);
      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipFilename}"`,
          "Content-Length": String(zipBuffer.byteLength),
          "Cache-Control": "no-cache",
          "X-Bulk-Downloaded": String(result.downloaded),
          "X-Bulk-Failed": String(result.failures.length),
        },
      });
    } finally {
      await result.cleanup();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initiate bulk download";
    console.error(`[BULK-${requestId}] Fatal bulk downloader error:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
