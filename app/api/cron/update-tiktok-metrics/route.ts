import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { syncCreatorTikTokDisplayMetrics } from "@/lib/tiktok/sync-tiktok-display-metrics";
import { isTikTokMetricsQueueEnabled } from "@/lib/queue/tiktok-metrics-queue";

// Extract TikTok video ID from a content link
function extractTikTokVideoId(contentLink: string): string | null {
  if (!contentLink) return null;

  // Match standard TikTok video URL: https://www.tiktok.com/@username/video/1234567890
  const match = contentLink.match(/video\/(\d+)/);
  if (match) return match[1];

  return null;
}

function getBaseUrlFromRequest(request: Request): string {
  try {
    const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (xfHost && xfProto) return `${xfProto}://${xfHost}`;
    const u = new URL(request.url);
    return u.origin;
  } catch {
    const url = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
    return url.replace(/\/$/, "");
  }
}


// Function to update budget spent for CPM contests
async function updateCpmContestBudgets(
  supabaseAdmin: any,
  contestId?: string,
): Promise<void> {
  try {
    let contestsQuery = supabaseAdmin
      .from("contests")
      .select("id, contest_based_details, views_locked_at")
      .eq("contest_type", "cpm")
      .not("contest_based_details", "is", null)
      .is("views_locked_at", null);

    if (contestId) {
      contestsQuery = contestsQuery.eq("id", contestId);
    }

    const { data: contests, error } = await contestsQuery;

    if (error || !contests?.length) {
      return;
    }

    for (const contest of contests) {
      const cpmConfig = contest.contest_based_details?.cpm_contest;
      if (!cpmConfig?.cpm_rate_usd) continue;

      // Only process TikTok platform contests
      // Fetch contest platform to filter
      const { data: contestDetail } = await supabaseAdmin
        .from("contests")
        .select("platform, max_earnings_per_creator")
        .eq("id", contest.id)
        .single();

      if (contestDetail?.platform !== "tiktok") continue;

      const maxEarningsPerCreator =
        contestDetail?.max_earnings_per_creator || null;

      const { data: submissions } = await supabaseAdmin
        .from("submissions")
        .select(
          "views, creator_id, created_at, paid, bonus_paid, earnings, bonus_amount",
        )
        .eq("contest_id", contest.id)
        .in("status", ["verified", "paid"])
        .order("created_at", { ascending: true });

      if (!submissions?.length) continue;

      const creatorEarnings = new Map<
        string,
        { cpmTotal: number; bonusTotal: number }
      >();
      const flatFeeBonus = cpmConfig.flat_fee_bonus || 0;
      const flatFeeBonusCap = cpmConfig.flat_fee_bonus_cap || null;
      let totalBonusSpentSoFar = 0;
      const capInDollars = flatFeeBonusCap ? flatFeeBonusCap / 100 : null;

      for (const sub of submissions) {
        const creatorId = sub.creator_id;
        if (!creatorEarnings.has(creatorId)) {
          creatorEarnings.set(creatorId, { cpmTotal: 0, bonusTotal: 0 });
        }

        const creatorData = creatorEarnings.get(creatorId)!;

        if (sub.paid && sub.earnings != null) {
          creatorData.cpmTotal += sub.earnings / 100;
        } else {
          let views = sub.views || 0;
          if (cpmConfig.min_views && views < cpmConfig.min_views) views = 0;
          if (cpmConfig.max_views && views > cpmConfig.max_views)
            views = cpmConfig.max_views;

          const submissionEarnings = (views * cpmConfig.cpm_rate_usd) / 1000;

          if (maxEarningsPerCreator) {
            const maxEarningsInDollars = maxEarningsPerCreator / 100;
            const remainingCap = maxEarningsInDollars - creatorData.cpmTotal;
            if (remainingCap > 0) {
              creatorData.cpmTotal += Math.min(
                submissionEarnings,
                remainingCap,
              );
            }
          } else {
            creatorData.cpmTotal += submissionEarnings;
          }
        }

        if (sub.bonus_paid && sub.bonus_amount != null) {
          const actualBonus = sub.bonus_amount / 100;
          creatorData.bonusTotal += actualBonus;
          totalBonusSpentSoFar += actualBonus;
        } else if (flatFeeBonus > 0) {
          const bonusAmount = flatFeeBonus / 100;
          if (
            capInDollars === null ||
            totalBonusSpentSoFar + bonusAmount <= capInDollars
          ) {
            creatorData.bonusTotal += bonusAmount;
            totalBonusSpentSoFar += bonusAmount;
          }
        }
      }

      let totalCPM = 0;
      let totalBonus = 0;
      for (const [_, earnings] of creatorEarnings) {
        totalCPM += earnings.cpmTotal;
        totalBonus += earnings.bonusTotal;
      }

      const totalSpent = totalCPM + totalBonus;
      const now = new Date().toISOString();

      await supabaseAdmin
        .from("contests")
        .update({
          contest_based_details: {
            ...contest.contest_based_details,
            cpm_contest: {
              ...cpmConfig,
              budget_spent: Math.round(totalSpent * 100),
            },
          },
          last_metrics_updated: now,
          updated_at: now,
        })
        .eq("id", contest.id);
    }
  } catch (error) {
    console.error("[TikTok Cron] CPM budget update failed:", error);
  }
}

export async function GET(request: Request) {
  // Verify CRON secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  console.log("[TikTok Cron] Job triggered. Checking authorization...");

  try {
    // Check if this is a contest-specific refresh
    const url = new URL(request.url);
    const contestId = url.searchParams.get("contestId");
    const isContestSpecific = !!contestId;

    // Determine active contests
    let activeIds: string[] | undefined = undefined;
    if (isContestSpecific) {
      const { data: c } = await supabaseAdmin
        .from("contests")
        .select("id, views_locked_at")
        .eq("id", contestId)
        .single();
      if (!c || c.views_locked_at) {
        return NextResponse.json({
          message: `Contest ${contestId} is finalized or not found; nothing to update`,
        });
      }
    } else {
      // For non-contest-specific, get all active TikTok contests
      const { data: activeContests } = await supabaseAdmin
        .from("contests")
        .select("id")
        .eq("platform", "tiktok")
        .is("views_locked_at", null);
      activeIds = (activeContests || []).map((c: any) => c.id);
      console.log(`[TikTok Cron] Found ${activeIds.length} active TikTok contests.`);
      if (!activeIds.length) {
        return NextResponse.json({
          message: "No active TikTok contests to update",
        });
      }
    }

    // NEW: If queue is enabled, enqueue for each contest instead of monolithic update (Same as Instagram)
    if (isTikTokMetricsQueueEnabled()) {
      const baseUrl = getBaseUrlFromRequest(request);
      const contestIdsToEnqueue = contestId ? [contestId] : (activeIds ?? []);
      
      console.log(`[TikTok Cron] Queue enabled. Enqueueing ${contestIdsToEnqueue.length} contest(s).`);
      
      const results: Array<{ id: string; runId?: string; alreadyActive?: boolean }> = [];
      for (const cid of contestIdsToEnqueue) {
        try {
          const res = await fetch(
            `${baseUrl.replace(/\/$/, "")}/api/contests/${cid}/tiktok-metrics-refresh/enqueue`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
              },
            }
          );
          const data = await res.json().catch(() => ({}));
          results.push({ id: cid, runId: data.runId, alreadyActive: data.alreadyActive });
        } catch (e) {
          console.warn(`[TikTok Cron] Enqueue for ${cid} failed:`, e);
        }
      }
      
      return NextResponse.json({
        message: "TikTok metrics refresh enqueued for contest(s)",
        queueEnabled: true,
        results,
      });
    }

    console.log("[TikTok Cron] Fetching TikTok submissions to update...");

    // Fetch TikTok submissions to update
    let submissionsQuery = supabaseAdmin
      .from("submissions")
      .select(
        "id, creator_id, content_link, views, contest_id, created_at, other_stats, video_id",
      )
      .in("status", ["verified", "pending"])
      .eq("platform", "tiktok")
      .not("content_link", "is", null);

    if (isContestSpecific) {
      submissionsQuery = submissionsQuery.eq("contest_id", contestId);
      console.log(
        `[TikTok Cron] Contest-specific metrics update for contest: ${contestId}`,
      );
    } else if (activeIds && activeIds.length) {
      submissionsQuery = submissionsQuery.in("contest_id", activeIds);
    }

    const { data: submissions, error: submissionError } =
      await submissionsQuery;

    if (submissionError) {
      console.error(`[TikTok Cron] Submission fetch failed: ${submissionError.message}`);
      throw new Error(`Submission fetch failed: ${submissionError.message}`);
    }

    console.log(`[TikTok Cron] Found ${submissions?.length || 0} submissions for this query.`);

    if (!submissions?.length) {
      console.log("[TikTok Cron] Returning early: No submissions found.");
      return NextResponse.json({
        message: `No TikTok submissions to update${
          isContestSpecific ? ` for contest ${contestId}` : ""
        }`,
      });
    }

    // Group submissions by creator
    const submissionsByCreator = submissions.reduce(
      (acc, sub) => {
        // Use video_id column if available, otherwise extract from content_link
        const videoId = sub.video_id || extractTikTokVideoId(sub.content_link);
        if (videoId) {
          if (!acc[sub.creator_id]) acc[sub.creator_id] = [];
          acc[sub.creator_id].push({ ...sub, video_id: videoId });
        }
        return acc;
      },
      {} as Record<string, any[]>,
    );

    const creatorIds = Object.keys(submissionsByCreator);
    console.log(`[TikTok Cron] Unique creator IDs with valid video links: ${creatorIds.length}`);

    if (!creatorIds.length) {
      console.log("[TikTok Cron] Returning early: No valid video IDs found in submissions.");
      await updateCpmContestBudgets(supabaseAdmin, contestId || undefined);
      return NextResponse.json({
        message: "No valid TikTok video IDs found",
      });
    }

    // Fetch creators with TikTok accounts
    const { data: creators, error: creatorsError } = await supabaseAdmin
      .from("creator_profiles")
      .select("id, tiktok_account")
      .in("id", creatorIds)
      .not("tiktok_account", "is", null);

    if (creatorsError)
      throw new Error(`Creator fetch failed: ${creatorsError.message}`);
    if (!creators?.length) {
      console.log("[TikTok Cron] No connected TikTok accounts found to process.");
      await updateCpmContestBudgets(supabaseAdmin, contestId || undefined);
      return NextResponse.json({
        message: "No connected TikTok accounts found",
      });
    }

    console.log(`[TikTok Cron] Processing ${creators.length} creators with connected TikTok accounts.`);

    let totalSyncedSubmissions = 0;

    for (const creator of creators) {
      const subs = submissionsByCreator[creator.id] || [];
      console.log(
        `[TikTok Refresh] Display API sync for creator: ${creator.id} (${subs.length} submissions)`,
      );
      const result = await syncCreatorTikTokDisplayMetrics(
        supabaseAdmin,
        creator.id,
        subs,
      );

      if (result.success) {
        totalSyncedSubmissions += result.videosSynced || 0;
        console.log(
          `[TikTok Refresh] Synced ${result.videosSynced} submission(s) for ${creator.id}`,
        );
      } else {
        console.error(`[TikTok Refresh] Sync failed for ${creator.id}:`, result.error);
      }
    }

    // Update CPM contest budgets for TikTok contests
    await updateCpmContestBudgets(
      supabaseAdmin,
      isContestSpecific ? contestId! : undefined,
    );

    return NextResponse.json({
      message: `Updated ${totalSyncedSubmissions} TikTok submission(s) via Display API (Login Kit)`,
      details: isContestSpecific
        ? `Targeted contest ${contestId}`
        : `Global TikTok refresh`,
    });
  } catch (error: any) {
    console.error("[TikTok Cron] Job failed:", error);
    return NextResponse.json(
      { error: `TikTok cron job failed: ${error.message}` },
      { status: 500 },
    );
  }
}
