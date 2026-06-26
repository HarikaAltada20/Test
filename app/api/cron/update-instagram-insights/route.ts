import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { isInstagramInsightsQueueEnabled } from "@/lib/queue/instagram-insights-queue";
import {
  isContestEligibleForScheduledMetricsRefresh,
  isPostContestMetricsLocked,
  SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER,
} from "@/lib/contest-metrics-refresh-eligibility";
import { bumpContestLastMetricsUpdated } from "@/lib/contest-last-metrics-updated";
import { instagramGraphFetch } from "@/lib/meta-graph/instagram-graph-fetch";
import { insertMetaGraphUsageLogRow } from "@/lib/meta-graph/meta-graph-usage-log";
import type { MetaGraphUsageAccumulator } from "@/lib/meta-graph/usage-accumulator";

// 🎯 Types
interface InstagramAccount {
  access_token: string;
  token_expiry: string;
  app_scoped_user_id: string;
  account_type?: "BUSINESS" | "MEDIA_CREATOR" | "PERSONAL";
}

interface Submission {
  id: string;
  creator_id: string;
  contest_id: string;
  video_id: string;
  views: number | null;
  other_stats: any | null;
}

interface Creator {
  id: string;
  instagram_account: InstagramAccount;
}

interface InsightsData {
  data: Array<{
    name: string;
    values: Array<{ value: number }>;
  }>;
}

interface SubmissionUpdate {
  id: string;
  views: number;
  other_stats: any;
  updated_at: string;
}

interface TokenUpdate {
  userId: string;
  newAccountData: InstagramAccount;
}

// 🔧 Constants
const TOKEN_REFRESH_THRESHOLD_DAYS = 10;
const METRICS =
  "reach,likes,comments,shares,saved,total_interactions,views,ig_reels_avg_watch_time,ig_reels_video_view_total_time";
const DEFAULT_STATS = {
  reach: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saved: 0,
  total_interactions: 0,
  views: 0,
  avg_watch_time_ms: 0,
  total_watch_time_ms: 0,
};

// 🛠️ Utilities
const isTokenExpiring = (tokenExpiry: string): boolean =>
  dayjs(tokenExpiry).isBefore(dayjs().add(TOKEN_REFRESH_THRESHOLD_DAYS, "day"));

const hasStatsChanged = (
  oldViews: number | null,
  newViews: number,
  oldStats: any,
  newStats: Record<string, number>
): boolean => {
  if (oldViews !== newViews) return true;
  if (!oldStats?.instagram) return Object.keys(newStats).length > 0;
  return Object.keys(newStats).some(
    (key) => oldStats.instagram[key] !== newStats[key]
  );
};

// 🔄 Refresh Instagram token
async function refreshToken(
  creatorId: string,
  accessToken: string,
  usageAccumulator?: MetaGraphUsageAccumulator
): Promise<string | null> {
  try {
    const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;
    const response = await instagramGraphFetch(refreshUrl, { usageAccumulator });
    const data = await response.json();

    if (!response.ok || data.error) {
      console.error(
        `Token refresh failed for creator ${creatorId}:`,
        data.error
      );
      return null;
    }

    return data.access_token;
  } catch (error: any) {
    console.error(
      `Token refresh exception for creator ${creatorId}:`,
      error.message
    );
    return null;
  }
}

// 📊 Fetch insights for a submission
async function fetchInsights(
  submission: Submission,
  accessToken: string,
  usageAccumulator?: MetaGraphUsageAccumulator
): Promise<{ views: number; stats: Record<string, number> } | null> {
  try {
    const url = `https://graph.instagram.com/${submission.video_id}/insights?metric=${METRICS}&access_token=${accessToken}`;
    const response = await instagramGraphFetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      usageAccumulator,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      console.error(
        `Insights fetch failed for submission ${submission.id}:`,
        error
      );
      return null;
    }

    const data: InsightsData = await response.json();
    if (!data.data?.length) return null;

    const stats = { ...DEFAULT_STATS };
    let primaryViews = 0;

    data.data.forEach((metric) => {
      const value = metric.values[0]?.value || 0;

      // Map Quality of Attention metrics to readable keys
      if (metric.name === "ig_reels_avg_watch_time") {
        stats.avg_watch_time_ms = value;
      } else if (metric.name === "ig_reels_video_view_total_time") {
        stats.total_watch_time_ms = value;
      } else if (metric.name === "views") {
        stats.views = value;
        primaryViews = value;
      } else {
        // Direct mapping for standard metrics
        (stats as any)[metric.name] = value;
      }
    });

    // Fallback to reach if views is 0
    if (primaryViews === 0 && stats.reach > 0) {
      primaryViews = stats.reach;
    }

    return { views: primaryViews, stats };
  } catch (error: any) {
    console.error(
      `Error fetching insights for submission ${submission.id}:`,
      error.message
    );
    return null;
  }
}

// 💰 Update CPM contest budgets
async function updateCpmContestBudgets(
  supabaseAdmin: any,
  contestId?: string
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("contests")
      .select("id, contest_based_details, views_locked_at")
      .eq("contest_type", "cpm")
      .not("contest_based_details", "is", null)
      .is("views_locked_at", null); // Only update contests that haven't been finalized

    if (contestId) query = query.eq("id", contestId);

    const { data: contests, error } = await query;
    if (error || !contests?.length) return;

    for (const contest of contests) {
      const cpmConfig = contest.contest_based_details?.cpm_contest;
      if (!cpmConfig?.cpm_rate_usd) continue;

      // Fetch contest details for cap
      const { data: contestDetails } = await supabaseAdmin
        .from("contests")
        .select("max_earnings_per_creator")
        .eq("id", contest.id)
        .single();

      const maxEarningsPerCreator =
        contestDetails?.max_earnings_per_creator || null;

      // Get submissions with payment status
      const { data: submissions } = await supabaseAdmin
        .from("submissions")
        .select(
          "views, creator_id, created_at, paid, bonus_paid, earnings, bonus_amount"
        )
        .eq("contest_id", contest.id)
        .in("status", ["verified", "paid"])
        .order("created_at", { ascending: true });

      if (!submissions?.length) continue;

      // Group by creator to respect earnings cap
      const creatorEarnings = new Map<
        string,
        { cpmTotal: number; bonusTotal: number }
      >();
      const flatFeeBonus = cpmConfig.flat_fee_bonus || 0;
      const flatFeeBonusCap = cpmConfig.flat_fee_bonus_cap || null;

      // Track total bonus spending to apply cap (first-come-first-served)
      let totalBonusSpentSoFar = 0;
      const capInDollars = flatFeeBonusCap ? flatFeeBonusCap / 100 : null;

      for (const sub of submissions) {
        const creatorId = sub.creator_id;
        if (!creatorEarnings.has(creatorId)) {
          creatorEarnings.set(creatorId, { cpmTotal: 0, bonusTotal: 0 });
        }

        const creatorData = creatorEarnings.get(creatorId)!;

        // Use actual paid earnings if paid, otherwise calculate expected
        if (sub.paid && sub.earnings != null) {
          // Use actual paid amount from database
          creatorData.cpmTotal += sub.earnings / 100; // Convert cents to dollars
        } else {
          // Calculate expected CPM earnings for verified but unpaid submissions
          let views = sub.views || 0;
          if (cpmConfig.min_views && views < cpmConfig.min_views) views = 0;
          if (cpmConfig.max_views && views > cpmConfig.max_views)
            views = cpmConfig.max_views;

          const submissionEarnings = (views * cpmConfig.cpm_rate_usd) / 1000;

          // Apply creator cap if exists
          if (maxEarningsPerCreator) {
            const maxEarningsInDollars = maxEarningsPerCreator / 100;
            const remainingCap = maxEarningsInDollars - creatorData.cpmTotal;
            if (remainingCap > 0) {
              creatorData.cpmTotal += Math.min(
                submissionEarnings,
                remainingCap
              );
            }
          } else {
            creatorData.cpmTotal += submissionEarnings;
          }
        }

        // Use actual bonus amount if bonus_paid, otherwise calculate expected
        // Apply cap during calculation (first-come-first-served)
        if (sub.bonus_paid && sub.bonus_amount != null) {
          // Use actual bonus amount from database
          const actualBonus = sub.bonus_amount / 100;
          creatorData.bonusTotal += actualBonus;
          totalBonusSpentSoFar += actualBonus;
        } else if (flatFeeBonus > 0) {
          const bonusAmount = flatFeeBonus / 100;
          // Check if adding this bonus would exceed the cap
          if (
            capInDollars === null ||
            totalBonusSpentSoFar + bonusAmount <= capInDollars
          ) {
            creatorData.bonusTotal += bonusAmount;
            totalBonusSpentSoFar += bonusAmount;
          }
          // If cap would be exceeded, this submission gets $0 bonus (cap reached)
        }
      }

      // Sum up all creator earnings
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
  } catch (error: any) {
    console.error("CPM budget update failed:", error.message);
  }
}

// 🚀 Main handler - Now optimized, readable, and efficient!
export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const url = new URL(request.url);
    const contestId = url.searchParams.get("contestId");

    // Determine active contests up-front to avoid touching finalized ones
    let activeIds: string[] | undefined = undefined;
    if (contestId) {
      const { data: c } = await supabaseAdmin
        .from("contests")
        .select("id, views_locked_at, post_contest_status")
        .eq("id", contestId)
        .single();
      if (!c || !isContestEligibleForScheduledMetricsRefresh(c)) {
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
        .select("id, post_contest_status, views_locked_at")
        .is("views_locked_at", null)
        .or(SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER);
      const eligibleContests = (activeContests || []).filter(
        isContestEligibleForScheduledMetricsRefresh,
      );
      activeIds = eligibleContests.map((c: any) => c.id);
      if (!activeIds.length) {
        return NextResponse.json({ message: "No active contests to update" });
      }
    }

    console.log(
      `🚀 Starting Instagram insights update${
        contestId ? ` for contest ${contestId}` : ""
      }`
    );

    if (isInstagramInsightsQueueEnabled()) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
      const contestIdsToEnqueue = contestId ? [contestId] : activeIds ?? [];
      const results: Array<{ id: string; runId?: string; alreadyActive?: boolean }> = [];
      for (const cid of contestIdsToEnqueue) {
        try {
          const res = await fetch(
            `${baseUrl.replace(/\/$/, "")}/api/contests/${cid}/instagram-insights-refresh/enqueue`,
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
          console.warn(`[update-instagram-insights] Enqueue for ${cid} failed:`, e);
        }
      }
      return NextResponse.json({
        message: "Instagram insights refresh enqueued for contest(s)",
        queueEnabled: true,
        results,
      });
    }

    // 📥 Fetch submissions (only from active contests)
    let submissionsQuery = supabaseAdmin
      .from("submissions")
      .select("id, creator_id, contest_id, video_id, views, other_stats")
      .eq("platform", "instagram")
      .not("video_id", "is", null);

    if (contestId) {
      submissionsQuery = submissionsQuery.eq("contest_id", contestId);
    } else if (activeIds && activeIds.length) {
      submissionsQuery = submissionsQuery.in("contest_id", activeIds);
    }

    const { data: submissions, error: submissionError } =
      await submissionsQuery;

    if (submissionError) {
      throw new Error(
        `Failed to fetch submissions: ${submissionError.message}`
      );
    }

    if (!submissions?.length) {
      return NextResponse.json({
        message: `No submissions to update${
          contestId ? ` for contest ${contestId}` : ""
        }`,
      });
    }

    console.log(`📊 Processing ${submissions.length} submissions`);

    // 👥 Group by creator (more efficient than loops)
    const submissionsByCreator = submissions.reduce((acc, sub) => {
      if (!acc[sub.creator_id]) acc[sub.creator_id] = [];
      acc[sub.creator_id].push(sub);
      return acc;
    }, {} as Record<string, Submission[]>);

    const creatorIds = Object.keys(submissionsByCreator);

    // 🔍 Fetch creator profiles (only Instagram account data - no unnecessary fields!)
    const { data: creators, error: profilesError } = await supabaseAdmin
      .from("creator_profiles")
      .select("id, instagram_account")
      .in("id", creatorIds)
      .not("instagram_account", "is", null);

    if (profilesError) {
      throw new Error(
        `Failed to fetch creator profiles: ${profilesError.message}`
      );
    }

    if (!creators?.length) {
      await updateCpmContestBudgets(supabaseAdmin, contestId || undefined);
      return NextResponse.json({
        message:
          "No connected Instagram accounts found, budget tracking completed",
      });
    }

    // 🔄 Process insights efficiently
    const updates: SubmissionUpdate[] = [];
    const tokenUpdates: TokenUpdate[] = [];
    const usageAccumulator: MetaGraphUsageAccumulator = {};

    for (const creator of creators as Creator[]) {
      const account = creator.instagram_account;
      const userSubmissions = submissionsByCreator[creator.id];

      // Skip invalid accounts
      if (
        !account?.access_token ||
        (account.account_type !== "BUSINESS" &&
          account.account_type !== "MEDIA_CREATOR")
      ) {
        continue;
      }

      let accessToken = account.access_token;

      // 🔄 Refresh token if needed
      if (account.token_expiry && isTokenExpiring(account.token_expiry)) {
        const newToken = await refreshToken(
          creator.id,
          accessToken,
          usageAccumulator
        );
        if (!newToken) continue;

        accessToken = newToken;
        tokenUpdates.push({
          userId: creator.id,
          newAccountData: {
            ...account,
            access_token: newToken,
            token_expiry: dayjs().add(3600, "second").toISOString(),
          },
        });
      }

      // 📊 Process submissions for this creator
      for (const submission of userSubmissions) {
        if (!submission.video_id) continue;

        const result = await fetchInsights(
          submission,
          accessToken,
          usageAccumulator
        );
        if (!result) continue;

        const { views, stats } = result;

        if (
          hasStatsChanged(
            submission.views,
            views,
            submission.other_stats,
            stats
          )
        ) {
          updates.push({
            id: submission.id,
            views,
            other_stats: { ...submission.other_stats, instagram: stats },
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    await insertMetaGraphUsageLogRow({
      source: "instagram_insights_cron",
      contestId: contestId || null,
      runId: null,
      batchIndex: null,
      accumulator: usageAccumulator,
    });

    // 💾 Batch database updates (much more efficient!)
    const now = new Date().toISOString();

    if (tokenUpdates.length > 0) {
      console.log(`🔄 Updating ${tokenUpdates.length} tokens`);
      await Promise.allSettled(
        tokenUpdates.map((update) =>
          supabaseAdmin
            .from("creator_profiles")
            .update({
              instagram_account: update.newAccountData,
              updated_at: now,
            })
            .eq("id", update.userId)
        )
      );
    }

    if (updates.length > 0) {
      console.log(`📊 Updating ${updates.length} submissions`);
      await Promise.allSettled(
        updates.map((update) =>
          supabaseAdmin
            .from("submissions")
            .update({
              views: update.views,
              other_stats: update.other_stats,
              last_insights_update: now,
              updated_at: update.updated_at,
            })
            .eq("id", update.id)
        )
      );

      const updatedIds = new Set(updates.map((u) => u.id));
      const contestIdsUpdated = [
        ...new Set(
          submissions
            .filter((s) => updatedIds.has(s.id))
            .map((s) => s.contest_id)
            .filter(Boolean),
        ),
      ];
      await bumpContestLastMetricsUpdated(supabaseAdmin, contestIdsUpdated);
    }

    await updateCpmContestBudgets(supabaseAdmin, contestId || undefined);

    console.log(
      `✅ Instagram insights update completed. Updated ${updates.length} submissions`
    );
    return NextResponse.json({
      message: `Updated ${updates.length} Instagram submissions${
        contestId ? ` for contest ${contestId}` : ""
      } and CPM budgets`,
    });
  } catch (error: any) {
    console.error("❌ Instagram insights update failed:", error.message);
    return NextResponse.json(
      { error: `Cron job failed: ${error.message}` },
      { status: 500 }
    );
  }
}
