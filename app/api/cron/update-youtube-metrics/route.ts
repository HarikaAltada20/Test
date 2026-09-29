import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { updateYouTubeCpmContestBudgets } from "@/lib/youtube-cpm-contest-budgets";
import {
  isContestEligibleForScheduledMetricsCron,
  isContestEligibleForScheduledMetricsRefresh,
  isContestLiveOrEnded,
  isContestPublished,
  isPostContestMetricsLocked,
  SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER,
} from "@/lib/contest-metrics-refresh-eligibility";
import {
  bumpContestLastMetricsUpdated,
  contestIdsForUpdatedSubmissions,
} from "@/lib/contest-last-metrics-updated";
import {
  fetchYouTubeCronSubmissions,
  runYouTubeCronBasicRefresh,
} from "@/lib/youtube-cron-basic-refresh";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const nowIso = new Date().toISOString();
    const url = new URL(request.url);
    const contestId = url.searchParams.get("contestId");
    const isContestSpecific = !!contestId;

    let activeIds: string[] | undefined = undefined;

    if (isContestSpecific) {
      const { data: c } = await supabaseAdmin
        .from("contests")
        .select(
          "id, views_locked_at, post_contest_status, platform, start_date, end_date, moderation_status",
        )
        .eq("id", contestId)
        .single();
      if (!c || c.platform?.toLowerCase() !== "youtube") {
        return NextResponse.json({
          message: `Contest ${contestId} is not a YouTube contest; nothing to update`,
        });
      }
      if (!isContestPublished(c.moderation_status)) {
        return NextResponse.json({
          message: `Contest ${contestId} is not published; nothing to update`,
        });
      }
      if (!isContestLiveOrEnded(c)) {
        return NextResponse.json({
          message: `Contest ${contestId} is not live or ended yet; nothing to update`,
        });
      }
      if (!isContestEligibleForScheduledMetricsRefresh(c)) {
        const locked = c && isPostContestMetricsLocked(c.post_contest_status);
        return NextResponse.json({
          message: locked
            ? `Contest ${contestId} is locked for review; nothing to update`
            : `Contest ${contestId} is finalized or not found; nothing to update`,
        });
      }
    } else {
      const { data: activeContests } = await supabaseAdmin
        .from("contests")
        .select(
          "id, post_contest_status, views_locked_at, start_date, end_date, moderation_status",
        )
        .eq("platform", "youtube")
        .eq("moderation_status", "published")
        .is("views_locked_at", null)
        .not("start_date", "is", null)
        .not("end_date", "is", null)
        .lte("start_date", nowIso)
        .or(SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER);
      const eligibleContests = (activeContests || []).filter(
        isContestEligibleForScheduledMetricsCron,
      );
      activeIds = eligibleContests.map((c: { id: string }) => c.id);
      if (!activeIds.length) {
        return NextResponse.json({
          message: "No active YouTube contests to update",
        });
      }
    }

    const dryRun = url.searchParams.get("dryRun") === "1";

    const submissions = await fetchYouTubeCronSubmissions(supabaseAdmin, {
      contestId: isContestSpecific ? contestId! : undefined,
      contestIds: !isContestSpecific ? activeIds : undefined,
    });

    if (!submissions.length) {
      return NextResponse.json({
        message: `No submissions to update${
          isContestSpecific ? ` for contest ${contestId}` : ""
        }`,
        dryRun,
        activeContestCount: activeIds?.length ?? (isContestSpecific ? 1 : 0),
      });
    }

    if (dryRun) {
      const contestIdsInSubmissions = [
        ...new Set(submissions.map((s) => s.contest_id)),
      ];
      return NextResponse.json({
        message: "Dry run — no YouTube API calls or DB writes",
        dryRun: true,
        activeContestCount: activeIds?.length ?? 1,
        activeContestIds: activeIds ?? [contestId],
        submissionCount: submissions.length,
        contestIdsWithSubmissions: contestIdsInSubmissions,
        targetContestIncluded: contestId
          ? contestIdsInSubmissions.includes(contestId)
          : undefined,
      });
    }

    if (isContestSpecific) {
      console.log(
        `Contest-specific YouTube metrics update for contest: ${contestId}`,
      );
    }

    const refreshResult = await runYouTubeCronBasicRefresh(
      supabaseAdmin,
      submissions,
    );

    if (refreshResult.updatedSubmissionIds.length > 0) {
      await bumpContestLastMetricsUpdated(
        supabaseAdmin,
        contestIdsForUpdatedSubmissions(
          submissions,
          refreshResult.updatedSubmissionIds,
        ),
      );
    }

    await updateYouTubeCpmContestBudgets(
      supabaseAdmin,
      isContestSpecific ? contestId : undefined,
    );

    return NextResponse.json({
      message: `Updated ${refreshResult.successCount} submissions${
        isContestSpecific ? ` for contest ${contestId}` : ""
      } and CPM contest budgets`,
      successCount: refreshResult.successCount,
      temporaryFailureCount: refreshResult.temporaryFailureCount,
      permanentFailureCount: refreshResult.permanentFailureCount,
      skippedCount: refreshResult.skippedCount,
      submissionCount: refreshResult.submissionCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("CRON job failed:", error);
    return NextResponse.json(
      { error: `Cron job failed: ${message}` },
      { status: 500 },
    );
  }
}
