import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
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
} from "@/lib/video-download-filename";
import {
  enqueueVideoDownloadJob,
  isVideoDownloadQueueEnabled,
  type VideoDownloadItem,
} from "@/lib/queue/video-download-queue";
import { executeQueuedVideoDownloads } from "@/lib/video-download-execute";
import {
  getQStashPublishBaseUrl,
  isLoopbackUrl,
  isQStashEnabled,
  resolveLocalAwareBaseUrl,
  triggerProcessVideoDownloadQueue,
} from "@/lib/qstash";

export const maxDuration = 300;

function isSupportedVideoUrl(
  url: string,
): { ok: true; isInstagram: boolean } | { ok: false } {
  const isInstagram = url.includes("instagram.com");
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
  if (!isInstagram && !isYouTube) return { ok: false };
  return { ok: true, isInstagram };
}

function kickProcessor(request: Request) {
  const qstashUrl = getQStashPublishBaseUrl(request);
  const localUrl = resolveLocalAwareBaseUrl(request);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.CRON_SECRET) {
    headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;
  }
  const fallback = () =>
    fetch(`${localUrl}/api/cron/process-video-download-queue`, {
      method: "POST",
      headers,
      body: "{}",
    }).catch((e) =>
      console.error("[bulk-download] Direct processor trigger failed:", e),
    );

  if (isQStashEnabled() && !isLoopbackUrl(qstashUrl)) {
    triggerProcessVideoDownloadQueue(qstashUrl)
      .then((res) => {
        if (res?.error) void fallback();
      })
      .catch(() => fallback());
    return;
  }
  void fallback();
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
      options = {},
    } = body as {
      urls?: unknown;
      submissionIds?: unknown;
      namingPattern?: unknown;
      options?: { format?: string; namingPattern?: unknown };
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
          error: `Too many submissions. Select at most ${MAX_BULK_VIDEO_DOWNLOADS} videos for one ZIP download.`,
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
          error: `Too many URLs. Provide at most ${MAX_BULK_VIDEO_DOWNLOADS} URLs for one ZIP download.`,
          max: MAX_BULK_VIDEO_DOWNLOADS,
        },
        { status: 400 },
      );
    }

    const downloadQueue: VideoDownloadItem[] = [];

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

    if (isVideoDownloadQueueEnabled()) {
      const jobId = randomUUID();
      const enqueued = await enqueueVideoDownloadJob({
        jobId,
        userId: user.id,
        items: downloadQueue,
      });
      if (enqueued.error) {
        return NextResponse.json(
          { error: enqueued.error || "Failed to enqueue download job" },
          { status: 500 },
        );
      }
      kickProcessor(request);
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

    if (result.downloaded === 0) {
      return NextResponse.json(
        {
          error: result.failures[0]?.error || "No files could be downloaded",
          completed: 0,
          failed: result.failures.length,
        },
        { status: 422 },
      );
    }

    return new NextResponse(new Uint8Array(result.zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="bulk_download_${requestId}.zip"`,
        "Content-Length": String(result.zipBuffer.byteLength),
        "Cache-Control": "no-cache",
        "X-Bulk-Downloaded": String(result.downloaded),
        "X-Bulk-Failed": String(result.failures.length),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initiate bulk download";
    console.error(`[BULK-${requestId}] Fatal bulk downloader error:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
