import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  isAdminDownloadUser,
  MAX_BULK_VIDEO_DOWNLOADS,
  verifyAdminOrBrandDownloadAccess,
} from "@/lib/video-download-auth";
import {
  bulkZipFilenameFromContestTitle,
  parseVideoFilenamePattern,
} from "@/lib/video-download-filename";
import { parseVideosPerZip } from "@/lib/video-download-ui";
import { resolveBulkDownloadItems } from "@/lib/bulk-download-resolve-items";
import { buildDesktopManifestPayload } from "@/lib/goc-download/build-manifest";
import { buildSignedManifest } from "@/lib/goc-download/sign";
import { issueDesktopStatusToken } from "@/lib/goc-download/status-token";
import { getManifestTtlSeconds } from "@/lib/goc-download/config";
import { createBulkVideoDownloadJob } from "@/lib/bulk-video-download-jobs";
import {
  assertSessionSubmissionsOnContest,
  verifyDownloadContestAccess,
} from "@/lib/bulk-video-download-session-access";

export const dynamic = "force-dynamic";

function absoluteStatusUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/api/admin/bulk-download/desktop-status`;
}

export async function POST(request: Request) {
  const access = await verifyAdminOrBrandDownloadAccess();
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error || "Admin or brand access required" },
      { status: 403 },
    );
  }

  const { user, supabase } = access;
  const body = await request.json().catch(() => ({}));
  const submissionIds = Array.isArray(body.submissionIds)
    ? body.submissionIds.filter(
        (id: unknown): id is string =>
          typeof id === "string" && id.length > 0,
      )
    : [];
  const urls = Array.isArray(body.urls)
    ? body.urls.filter(
        (url: unknown): url is string =>
          typeof url === "string" && url.length > 0,
      )
    : [];
  const contestId =
    typeof body.contestId === "string" ? body.contestId.trim() : "";
  const namingPattern = parseVideoFilenamePattern(body.namingPattern);
  const videosPerZip = parseVideosPerZip(
    body.videosPerZip ?? MAX_BULK_VIDEO_DOWNLOADS,
  );
  const zipFilenameBase =
    typeof body.zipFilename === "string" && body.zipFilename.trim()
      ? body.zipFilename.trim()
      : null;

  if (urls.length > 0 && !isAdminDownloadUser(user)) {
    return NextResponse.json(
      { error: "Custom URL bulk download is restricted to admins." },
      { status: 403 },
    );
  }

  if (submissionIds.length === 0 && urls.length === 0) {
    return NextResponse.json(
      { error: "submissionIds or urls are required" },
      { status: 400 },
    );
  }

  if (contestId) {
    const contestAccess = await verifyDownloadContestAccess({
      supabase,
      viewer: user,
      contestId,
    });
    if (!contestAccess.ok) {
      return NextResponse.json(
        { error: contestAccess.error },
        { status: contestAccess.status },
      );
    }
    if (submissionIds.length > 0) {
      const submissionsAccess = await assertSessionSubmissionsOnContest({
        contestId: contestAccess.contestId,
        submissionIds,
      });
      if (!submissionsAccess.ok) {
        return NextResponse.json(
          { error: submissionsAccess.error },
          { status: submissionsAccess.status },
        );
      }
    }
  }

  const resolved = await resolveBulkDownloadItems({
    supabase,
    user,
    submissionIds,
    urls,
    namingPattern,
    format: "mp4",
  });

  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  // STRICT: any rejected ownership/validation items fail the whole request.
  if (submissionIds.length > 0 && resolved.result.rejected.length > 0) {
    return NextResponse.json(
      {
        error:
          "One or more selected submissions could not be included in the desktop download (missing, not owned, or unsupported).",
        rejected: resolved.result.rejected,
      },
      { status: 400 },
    );
  }

  const items = resolved.result.items;
  if (items.length === 0) {
    return NextResponse.json(
      { error: "No valid YouTube submissions to download" },
      { status: 400 },
    );
  }

  if (items.some((item) => item.isInstagram)) {
    return NextResponse.json(
      {
        error:
          "Desktop downloads support YouTube only. Instagram selections must use the cloud download path.",
      },
      { status: 400 },
    );
  }

  const jobId = randomUUID();
  const ttlSeconds = getManifestTtlSeconds();
  const statusToken = issueDesktopStatusToken({
    jobId,
    userId: user.id,
    ttlSeconds: Math.max(ttlSeconds, 60 * 60),
  });
  const statusUrl = absoluteStatusUrl(request);

  const prefix =
    zipFilenameBase ||
    bulkZipFilenameFromContestTitle(resolved.result.contestTitle);

  const built = buildDesktopManifestPayload({
    jobId,
    userId: user.id,
    contestId: contestId || undefined,
    namingPattern,
    zipFilenameBase: prefix,
    videosPerZip,
    items,
    statusUrl,
    statusToken,
    ttlSeconds,
  });

  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  // Create desktop job when we have a contest context (same tables as cloud sessions).
  if (contestId) {
    const submissionIdList = items
      .map((item) => item.submissionId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const zipParts = built.payload.archives.map((archive, index) => ({
      jobId: archive.archiveId,
      zipPartIndex: index + 1,
      zipPartTotal: built.payload.archives.length,
      zipFilename: archive.zipFilename,
      submissionIds: archive.itemIds
        .map((itemId) => {
          const item = built.payload.items.find((row) => row.itemId === itemId);
          return item?.submissionId;
        })
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    }));

    const created = await createBulkVideoDownloadJob({
      id: jobId,
      contestId,
      userId: user.id,
      userType: user.user_type,
      totalCount: items.length,
      zipPartTotal: zipParts.length,
      videosPerZip,
      namingPattern,
      fileNamePrefix: prefix.replace(/\.zip$/i, ""),
      submissionIds: submissionIdList,
      zipParts,
      itemStatuses: submissionIdList.map((submissionId) => ({
        submissionId,
        status: "pending" as const,
      })),
      source: "desktop",
      deliveryMode: "gocdownload",
      status: "queued",
    });

    if (created.error || !created.data) {
      return NextResponse.json(
        { error: created.error || "Failed to create desktop download job" },
        { status: 500 },
      );
    }
  }

  let signed;
  try {
    signed = buildSignedManifest(built.payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sign desktop manifest";
    console.error("[desktop-manifest] sign failed:", error);
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const filename = `goc-download-${jobId.slice(0, 8)}.gocdownload`;
  const bodyText = `${JSON.stringify(signed, null, 2)}\n`;

  return new NextResponse(bodyText, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.goc.download+json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Goc-Download-Job-Id": jobId,
    },
  });
}
