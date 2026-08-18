import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { refreshAccessToken, extractYoutubeId } from "@/lib/youtube-api";
import { isYouTubeRefreshTarget } from "@/lib/youtube-url";
import { youtubeDetailedCooldownTimestamp } from "@/lib/youtube-detailed-cooldown";
import { youtubeMetricsWriteTarget } from "@/lib/youtube-metrics-write-target";
import {
  updateYouTubeSubmissionForScope,
  isYouTubeAllLikeScope,
  mergePostCampaignYouTubeTimestamps,
} from "@/lib/youtube-submission-refresh-by-scope";
import type { YouTubeRefreshScope } from "@/lib/queue/youtube-metrics-queue";
import { METRICS_REFRESH_COOLDOWN_MS_ADMIN } from "@/lib/constants";

/**
 * POST /api/youtube/refresh-detailed-analytics
 *
 * On-demand fetch of Traffic Sources (Call 2) and/or Demographics (Call 3).
 * Admin-only. Accepts one of three targeting modes:
 *   - { type, submissionId }              → single submission
 *   - { type, creatorId, contestId }      → all submissions by creator in contest
 *   - { type, contestId }                 → all YouTube submissions in contest
 *
 * type: "traffic" | "demographics"
 */
export async function POST(request: Request) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const {
    type,
    submissionId,
    creatorId,
    contestId,
    postCampaign,
  }: {
    type: YouTubeRefreshScope;
    submissionId?: string;
    creatorId?: string;
    contestId?: string;
    postCampaign?: boolean;
  } = body;
  const isPostCampaign = postCampaign === true;

  const ANALYTICS_TYPES: YouTubeRefreshScope[] = [
    "core",
    "traffic",
    "demographics",
    "all",
    "all_standard",
  ];

  if (!type || !ANALYTICS_TYPES.includes(type)) {
    return NextResponse.json(
      {
        error:
          "type must be 'core', 'traffic', 'demographics', 'all', or 'all_standard'",
      },
      { status: 400 },
    );
  }

  if (!submissionId && !contestId) {
    return NextResponse.json(
      { error: "Provide submissionId, contestId, or creatorId + contestId" },
      { status: 400 },
    );
  }

  const supabaseAdmin = createAdminSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // --- Fetch target submissions ---
  // Per-row refresh (normal view) must include rejected videos; contest/creator
  // refresh still skips them.
  let submissionsQuery = supabaseAdmin
    .from("submissions")
    .select(
      "id, contest_id, creator_id, content_link, views, other_stats, created_at, platform",
    )
    .not("content_link", "is", null);

  if (submissionId) {
    submissionsQuery = submissionsQuery.eq("id", submissionId);
  } else {
    submissionsQuery = submissionsQuery.neq("status", "rejected");
    if (creatorId && contestId) {
      submissionsQuery = submissionsQuery
        .eq("creator_id", creatorId)
        .eq("contest_id", contestId);
    } else if (contestId) {
      submissionsQuery = submissionsQuery.eq("contest_id", contestId);
    }
  }

  const { data: submissions, error: subError } = await submissionsQuery;

  if (subError) {
    return NextResponse.json(
      { error: `Failed to fetch submissions: ${subError.message}` },
      { status: 500 },
    );
  }

  const youtubeSubmissions = (submissions || []).filter((s) =>
    isYouTubeRefreshTarget(s.platform, s.content_link),
  );

  const writeTarget = youtubeMetricsWriteTarget(isPostCampaign);

  type RefreshRow = {
    id: string;
    contest_id: string;
    creator_id: string;
    content_link: string;
    views: number | null;
    other_stats: Record<string, unknown> | null;
    created_at?: string;
    platform?: string | null;
  };

  let refreshRows: RefreshRow[] = youtubeSubmissions as RefreshRow[];

  if (isPostCampaign && refreshRows.length > 0) {
    const { data: overlayRows, error: overlayError } = await supabaseAdmin
      .from("post_campaign_submission_metrics")
      .select("submission_id, views, other_stats")
      .in(
        "submission_id",
        refreshRows.map((row) => row.id),
      );
    if (overlayError) {
      return NextResponse.json(
        { error: `Failed to fetch post-campaign metrics: ${overlayError.message}` },
        { status: 500 },
      );
    }
    const overlayById = new Map(
      (overlayRows || []).map((row) => [row.submission_id as string, row]),
    );
    refreshRows = refreshRows
      .map((row) => {
        const overlay = overlayById.get(row.id);
        if (!overlay) return null;
        return {
          ...row,
          views: (overlay.views as number | null) ?? row.views,
          other_stats:
            (overlay.other_stats as Record<string, unknown> | null) ??
            row.other_stats,
        };
      })
      .filter((row): row is RefreshRow => row != null);
  }

  if (refreshRows.length === 0) {
    if (submissionId) {
      return NextResponse.json(
        { error: "YouTube submission not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      message: "No YouTube submissions found",
      updated: 0,
    });
  }

  const targetContestIds = [
    ...new Set(
      (contestId
        ? [contestId]
        : refreshRows.map((submission) => submission.contest_id)
      ).filter(Boolean),
    ),
  ];

  if (targetContestIds.length > 0) {
    const { data: contests, error: contestError } = await supabaseAdmin
      .from("contests")
      .select("id, last_metrics_updated, contest_based_details")
      .in("id", targetContestIds);

    if (contestError) {
      return NextResponse.json(
        { error: `Failed to check refresh cooldown: ${contestError.message}` },
        { status: 500 },
      );
    }

    const getDetailedCooldownTimestamp = (
      contest: {
        last_metrics_updated?: string | null;
        contest_based_details?: Record<string, unknown> | null;
      },
    ) => {
      const details =
        (contest.contest_based_details as
          | {
              youtube_metrics_last_updated?: {
                core?: string;
                traffic?: string;
                demographics?: string;
              };
              post_campaign_youtube_metrics_last_updated?: {
                core?: string;
                traffic?: string;
                demographics?: string;
              };
            }
          | undefined) ?? undefined;
      const ytLast = isPostCampaign
        ? details?.post_campaign_youtube_metrics_last_updated ?? {}
        : details?.youtube_metrics_last_updated ?? {};
      return youtubeDetailedCooldownTimestamp(type, ytLast);
    };

    const nowMs = Date.now();
    const coolingContest = (contests || []).find((contest) => {
      const cooldownTimestamp = getDetailedCooldownTimestamp(contest);
      if (!cooldownTimestamp) return false;
      const lastUpdateMs = new Date(cooldownTimestamp).getTime();
      return (
        !Number.isNaN(lastUpdateMs) &&
        nowMs - lastUpdateMs < METRICS_REFRESH_COOLDOWN_MS_ADMIN
      );
    });

    const coolingTimestamp =
      coolingContest && getDetailedCooldownTimestamp(coolingContest);

    if (coolingTimestamp) {
      const lastUpdateMs = new Date(coolingTimestamp).getTime();
      const remainingMs =
        METRICS_REFRESH_COOLDOWN_MS_ADMIN - (nowMs - lastUpdateMs);
      const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);
      return NextResponse.json(
        {
          error: `Metrics were updated ${Math.floor(
            (nowMs - lastUpdateMs) / 1000 / 60,
          )} minutes ago. Please wait ${remainingMinutes} more minutes before refreshing again.`,
          nextRefreshAvailable: new Date(
            lastUpdateMs + METRICS_REFRESH_COOLDOWN_MS_ADMIN,
          ).toISOString(),
          userType: "admins",
        },
        { status: 429 },
      );
    }
  }

  // --- Group by creator to reuse tokens ---
  const creatorIds = [...new Set(refreshRows.map((s) => s.creator_id))];

  const { data: creators, error: creatorsError } = await supabaseAdmin
    .from("creator_profiles")
    .select("id, youtube_account")
    .in("id", creatorIds)
    .not("youtube_account", "is", null);

  if (creatorsError || !creators?.length) {
    return NextResponse.json(
      { error: "No connected YouTube accounts found for these submissions" },
      { status: 400 },
    );
  }

  const tokenMap = new Map<string, string>();
  const needsReauthCreators: string[] = [];

  // Refresh tokens where needed
  for (const creator of creators) {
    const account = creator.youtube_account as any;
    if (!account?.access_token) continue;

    let token = account.access_token;
    const isExpired =
      account.expires_at && new Date(account.expires_at) <= new Date();

    if (isExpired && account.refresh_token) {
      try {
        const newTokens = await refreshAccessToken(account.refresh_token);
        token = newTokens.access_token;
        await supabaseAdmin
          .from("creator_profiles")
          .update({
            youtube_account: {
              ...account,
              access_token: newTokens.access_token,
              expires_at: newTokens.expires_at,
              refresh_token: newTokens.refresh_token || account.refresh_token,
              needs_reconnect: false,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", creator.id);
      } catch {
        await supabaseAdmin
          .from("creator_profiles")
          .update({
            youtube_account: {
              ...account,
              needs_reconnect: true,
              updated_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", creator.id);
        needsReauthCreators.push(creator.id);
        continue;
      }
    }

    tokenMap.set(creator.id, token);
  }

  let successCount = 0;
  let temporaryFailureCount = 0;
  let permanentFailureCount = 0;
  let skippedCount = 0;
  const reauthNeeded: string[] = [];
  const now = new Date().toISOString();
  const patchInsightsStatus = async (
    submissionIdToPatch: string,
    status: "permanent_failure" | "temporary_failure",
  ) => {
    const payload = {
      insights_status: status,
      last_insights_update: now,
      updated_at: now,
    };
    if (writeTarget === "post_campaign_submission_metrics") {
      await supabaseAdmin
        .from("post_campaign_submission_metrics")
        .update(payload)
        .eq("submission_id", submissionIdToPatch);
      return;
    }
    await supabaseAdmin.from("submissions").update(payload).eq("id", submissionIdToPatch);
  };

  // --- Process each submission ---
  for (const sub of refreshRows) {
    const accessToken = tokenMap.get(sub.creator_id);
    if (!accessToken) {
      if (needsReauthCreators.includes(sub.creator_id)) {
        reauthNeeded.push(sub.id);
        await patchInsightsStatus(sub.id, "permanent_failure");
      }
      skippedCount++;
      continue;
    }

    const videoId = extractYoutubeId(sub.content_link);
    if (!videoId) {
      await patchInsightsStatus(sub.id, "permanent_failure");
      permanentFailureCount++;
      continue;
    }

    try {
      const result = await updateYouTubeSubmissionForScope(
        supabaseAdmin,
        {
          id: sub.id,
          creator_id: sub.creator_id,
          content_link: sub.content_link,
          views: sub.views,
          other_stats:
            (sub.other_stats as Record<string, unknown> | null) ?? null,
        },
        accessToken,
        type,
        now,
        { metricsTarget: writeTarget },
      );

      if (result.ok) {
        successCount++;
      } else if (
        result.authError ||
        result.failureType === "permanent_failure"
      ) {
        if (result.authError) {
          reauthNeeded.push(sub.id);
        }
        permanentFailureCount++;
      } else {
        temporaryFailureCount++;
      }
    } catch (err: unknown) {
      console.error(
        `Failed for submission ${sub.id}:`,
        (err as Error)?.message,
      );
      await patchInsightsStatus(sub.id, "temporary_failure");
      temporaryFailureCount++;
    }
  }

  // Stamp contest-level timestamps only after at least one successful update.
  if (successCount > 0 && targetContestIds.length > 0) {
    const { data: contestRow } = await supabaseAdmin
      .from("contests")
      .select("contest_based_details")
      .eq("id", targetContestIds[0])
      .maybeSingle();

    const existing =
      (contestRow?.contest_based_details as Record<string, unknown>) || {};
    const stampNow = new Date().toISOString();

    if (isPostCampaign) {
      const merged = mergePostCampaignYouTubeTimestamps(existing, type, stampNow);
      await supabaseAdmin
        .from("contests")
        .update({
          post_campaign_last_metrics_updated:
            merged.post_campaign_last_metrics_updated,
          ...(merged.contest_based_details
            ? { contest_based_details: merged.contest_based_details }
            : {}),
        })
        .in("id", targetContestIds);
    } else {
      const existingYt =
        (existing.youtube_metrics_last_updated as Record<string, string>) || {};
      const nextYt = { ...existingYt };
      if (type === "core" || isYouTubeAllLikeScope(type)) nextYt.core = stampNow;
      if (type === "traffic" || isYouTubeAllLikeScope(type)) nextYt.traffic = stampNow;
      if (type === "demographics" || isYouTubeAllLikeScope(type)) {
        nextYt.demographics = stampNow;
      }
      await supabaseAdmin
        .from("contests")
        .update({
          last_metrics_updated: stampNow,
          contest_based_details: {
            ...existing,
            youtube_metrics_last_updated: nextYt,
          },
        })
        .in("id", targetContestIds);
    }
  }

  const failed = temporaryFailureCount + permanentFailureCount;
  return NextResponse.json({
    success: true,
    updated: successCount,
    failed,
    success_count: successCount,
    temporary_failure_count: temporaryFailureCount,
    permanent_failure_count: permanentFailureCount,
    skipped_recent_count: skippedCount,
    scope: type,
    reauth_needed: reauthNeeded.length > 0 ? reauthNeeded : undefined,
    message: `Updated ${successCount} submission(s)${reauthNeeded.length ? `. ${reauthNeeded.length} creator(s) need to reconnect their YouTube account.` : ""}`,
  });
}
