import { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateLeaderboardBudgetSpent,
  calculateTwitterCpmBudgetSpent,
  Submission,
} from "@/lib/contest-utils";
import { createClient } from "@/utils/supabase/server";
import {
  contestCache,
  contestDetailsCache,
  getContestsCacheKey,
  getContestDetailsCacheKey,
  clearContestsCache,
} from "@/lib/cache-utils";
import {
  isCpmContestType,
  isDualRewardsContestType,
  isMilestoneContestType,
} from "@/lib/contest-type";
import {
  computeBudgetFilledCents,
  computeBudgetPaidCents,
  getBudgetTileMode,
  type BudgetTileSubmission,
} from "@/lib/contest-budget-tile-metrics";
import {
  fetchContestSubmissionsAllPages,
  fetchContestTwitterTweetsAllPages,
} from "@/lib/fetch-contest-submissions";

type ContestWithDetails = {
  id: string;
  contest_based_details: Record<string, any> | null;
  contest_type?: string | null;
  platform?: string | null;
  contest_format?: string | null;
  max_earnings_per_creator?: number | null;
  // Include all other fields returned by contests_with_status
  [key: string]: any;
};

const normalizeContestDetails = (contest: ContestWithDetails) =>
  contest.contest_based_details || {};

const DEFAULT_SELECT = "*, contest_based_details";
const SELECT_WITH_ADVERTISER_PROFILE = `${DEFAULT_SELECT}, advertiser_profiles!advertiser_id(company_name)`;

interface FetchContestsOptions {
  advertiserId?: string;
  includeAdvertiserProfile?: boolean;
}

async function fetchContestsWithDetails(
  supabase: SupabaseClient,
  options: FetchContestsOptions = {},
) {
  const cacheKey = getContestsCacheKey(options);
  const cachedData = contestCache.get<ContestWithDetails[]>(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const selectClause = options.includeAdvertiserProfile
    ? SELECT_WITH_ADVERTISER_PROFILE
    : DEFAULT_SELECT;

  let query = supabase
    .from("contests_with_status")
    .select(selectClause)
    .order("created_at", { ascending: false });

  if (options.advertiserId) {
    query = query.eq("advertiser_id", options.advertiserId);
  }

  const { data = [] } = (await query) as unknown as {
    data: ContestWithDetails[];
  };

  contestCache.set(cacheKey, data);
  return data;
}

export async function enrichContestWithCalculatedBudgets(
  contest: ContestWithDetails,
  supabase: SupabaseClient,
) {
  const cacheKey = getContestDetailsCacheKey(contest.id);
  const isMilestone = isMilestoneContestType(contest.contest_type);
  // Milestone budget_spent is derived from live submissions; do not serve stale cached rows.
  if (!isMilestone) {
    const cachedData = contestDetailsCache.get<ContestWithDetails>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }

  let updatedContest: ContestWithDetails = {
    ...contest,
    contest_based_details: contest.contest_based_details || {},
  };

  const contestDetails = normalizeContestDetails(updatedContest);
  const leaderboard = contestDetails?.leaderboard_contest || {};
  const cpmDetails = contestDetails?.cpm_contest || {};

  const isTwitterTextImage =
    (contest.platform?.toLowerCase() === "twitter" ||
      contest.platform?.toLowerCase() === "x") &&
    contest.contest_format === "text_image";

  if (isTwitterTextImage) {
    const { data: metrics } = await supabase
      .from("twitter_campaign_metrics")
      .select("total_participants, max_participants")
      .eq("contest_id", contest.id)
      .maybeSingle();

    if (metrics) {
      updatedContest.twitter_participants_count =
        metrics.total_participants || 0;
      updatedContest.twitter_max_participants = metrics.max_participants;
    } else {
      updatedContest.twitter_participants_count = 0;
      updatedContest.twitter_max_participants = null;
    }
  }

  if (
    contest.contest_type === "leaderboard" &&
    leaderboard?.total_budget > 0 &&
    leaderboard?.flat_fee_bonus > 0
  ) {
    let leaderboardSubmissions: Submission[] = [];
    let leaderboardFetchOk = false;

    if (isTwitterTextImage) {
      const { data: twitterTweets, error: twitterError } =
        await fetchContestTwitterTweetsAllPages(
          supabase,
          contest.id,
          "id, creator_id, tweet_created_at, moderation_status, is_eligible, deleted_at",
          {
            isEligible: true,
            deletedAtNull: true,
            moderationStatusIn: ["verified", "paid"],
            order: { column: "tweet_created_at", ascending: true },
          },
        );

      if (twitterError) {
        console.error(
          "Failed to load leaderboard Twitter tweets for contest",
          contest.id,
          String((twitterError as { message?: string })?.message ?? twitterError),
        );
      } else {
        leaderboardFetchOk = true;
        leaderboardSubmissions = (twitterTweets || [])
          .filter((tweet: any) => tweet.creator_id)
          .map((tweet: any) => ({
            id: tweet.id,
            creator_id: tweet.creator_id,
            created_at: tweet.tweet_created_at || new Date().toISOString(),
            status: tweet.moderation_status,
            is_eligible: tweet.is_eligible === true,
            deleted_at: tweet.deleted_at ?? null,
            paid: tweet.moderation_status === "paid",
            earnings: null,
            bonus_paid: false,
            is_twitter_tweet: true as const,
            platform: "twitter" as const,
          }));
      }
    } else {
      const { data: submissions, error: submissionsError } =
        await fetchContestSubmissionsAllPages(
        supabase,
        contest.id,
        "id, paid, earnings, bonus_paid, bonus_amount, creator_id, created_at, status, views",
        { statusIn: ["verified", "paid"], order: { column: "created_at", ascending: true } },
      );

      if (submissionsError) {
        console.error(
          "Failed to load leaderboard submissions for contest",
          contest.id,
          String((submissionsError as { message?: string })?.message ?? submissionsError),
        );
      } else {
        leaderboardFetchOk = true;
        leaderboardSubmissions = (submissions || []).map((submission: any) => ({
        id: submission.id,
        paid: submission.paid,
        earnings: submission.earnings,
        bonus_paid: submission.bonus_paid,
        bonus_amount:
          submission.bonus_amount !== null &&
          submission.bonus_amount !== undefined
            ? submission.bonus_amount
            : undefined,
        creator_id: submission.creator_id,
        created_at: submission.created_at,
        status: submission.status || undefined,
        views: submission.views,
      }));
      }
    }

    if (leaderboardFetchOk) {
    const actualBudgetSpent = calculateLeaderboardBudgetSpent(
      leaderboardSubmissions,
      leaderboard.flat_fee_bonus,
    );

    updatedContest = {
      ...updatedContest,
      contest_based_details: {
        ...contestDetails,
        leaderboard_contest: {
          ...leaderboard,
          budget_spent: Math.round(actualBudgetSpent * 100),
        },
      },
    };
    }
  }

  const platformSlug = (contest.platform || "").toLowerCase();
  const hasCpmRate = cpmDetails?.cpm_rate_usd > 0;
  const isTwitterPlatform = platformSlug === "twitter" || platformSlug === "x";

  if (contest.contest_type === "cpm" && isTwitterPlatform && hasCpmRate) {
    const { data: twitterTweets, error: twitterCpmError } =
      await fetchContestTwitterTweetsAllPages(
      supabase,
      contest.id,
      `
            id,
            creator_id,
            tweet_created_at,
            points,
            moderation_status,
            manual_points_adjustment,
            is_eligible,
            deleted_at
          `,
      {
        isEligible: true,
        deletedAtNull: true,
        moderationStatusIn: ["verified", "paid"],
        order: { column: "tweet_created_at", ascending: true },
      },
    );

    if (twitterCpmError) {
      console.error(
        "Failed to load Twitter CPM tweets for contest",
        contest.id,
        String((twitterCpmError as { message?: string })?.message ?? twitterCpmError),
      );
    } else {
    const submissions =
      (twitterTweets?.map((tweet: any) => ({
        id: tweet.id,
        creator_id: tweet.creator_id,
        created_at: tweet.tweet_created_at,
        platform: "twitter",
        status: tweet.moderation_status,
        is_eligible: tweet.is_eligible === true,
        deleted_at: tweet.deleted_at ?? null,
        is_twitter_tweet: true as const,
        paid: tweet.moderation_status === "paid",
        earnings: null,
        bonus_paid: false,
        bonus_amount: 0,
        other_stats: {
          base_points: tweet.points || 0,
          manual_points_adjustment: tweet.manual_points_adjustment || 0,
        },
        manual_points_adjustment: tweet.manual_points_adjustment || 0,
        views: 0,
      })) as Submission[]) || [];

    const { data: leaderboardAdjustments } = await supabase
      .from("twitter_campaign_leaderboard")
      .select("creator_id, manual_points_adjustment")
      .eq("contest_id", contest.id);

    const manualAdjustmentMap: Record<string, number> = {};
    (leaderboardAdjustments || []).forEach((entry: any) => {
      if (
        entry.creator_id &&
        typeof entry.manual_points_adjustment === "number"
      ) {
        manualAdjustmentMap[entry.creator_id] = entry.manual_points_adjustment;
      }
    });

    const actualBudgetSpent = calculateTwitterCpmBudgetSpent(
      submissions,
      cpmDetails.cpm_rate_usd,
      contest.max_earnings_per_creator ||
        cpmDetails.max_earnings_per_creator ||
        null,
      cpmDetails.min_views,
      cpmDetails.max_views,
      cpmDetails.flat_fee_bonus || 0,
      cpmDetails.flat_fee_bonus_cap || null,
      manualAdjustmentMap,
    );

    updatedContest = {
      ...updatedContest,
      contest_based_details: {
        ...contestDetails,
        cpm_contest: {
          ...cpmDetails,
          budget_spent: Math.round(actualBudgetSpent * 100),
        },
      },
    };
    }
  } else if (isCpmContestType(contest.contest_type) && hasCpmRate) {
    const { data: submissions, error: submissionsError } =
      await fetchContestSubmissionsAllPages(
        supabase,
        contest.id,
        `
              id,
              creator_id,
              created_at,
              status,
              paid,
              earnings,
              views,
              platform,
              other_stats,
              bonus_paid,
              bonus_amount
            `,
        {
          statusIn: ["verified", "paid"],
          order: { column: "created_at", ascending: true },
        },
      );

    if (!submissionsError) {
      const submissionRecords = (submissions || []).map((submission: any) => ({
        id: submission.id,
        creator_id: submission.creator_id,
        created_at: submission.created_at,
        status: submission.status || undefined,
        paid: submission.paid ?? false,
        earnings: submission.earnings,
        views: submission.views,
        platform: submission.platform || contest.platform || undefined,
        other_stats: submission.other_stats,
        bonus_paid: submission.bonus_paid ?? false,
        bonus_amount: submission.bonus_amount ?? undefined,
      }));

      const { data: leaderboardAdjustments } = await supabase
        .from("twitter_campaign_leaderboard")
        .select("creator_id, manual_points_adjustment")
        .eq("contest_id", contest.id);

      const manualAdjustmentMap: Record<string, number> = {};
      (leaderboardAdjustments || []).forEach((entry: any) => {
        if (
          entry.creator_id &&
          typeof entry.manual_points_adjustment === "number"
        ) {
          manualAdjustmentMap[entry.creator_id] =
            entry.manual_points_adjustment;
        }
      });

      const actualBudgetSpent = calculateTwitterCpmBudgetSpent(
        submissionRecords,
        cpmDetails.cpm_rate_usd,
        contest.max_earnings_per_creator ||
          cpmDetails.max_earnings_per_creator ||
          null,
        cpmDetails.min_views,
        cpmDetails.max_views,
        cpmDetails.flat_fee_bonus || 0,
        cpmDetails.flat_fee_bonus_cap || null,
        manualAdjustmentMap,
      );

      updatedContest = {
        ...updatedContest,
        contest_based_details: {
          ...contestDetails,
          cpm_contest: {
            ...cpmDetails,
            budget_spent: Math.round(actualBudgetSpent * 100),
          },
        },
      };
    } else {
      console.error(
        "Failed to calculate CPM budget for contest",
        contest.id,
        String((submissionsError as { message?: string })?.message ?? submissionsError),
      );
    }
  }

  const milestoneContestDetails =
    normalizeContestDetails(updatedContest).milestone_contest;
  if (
    isMilestoneContestType(contest.contest_type) &&
    milestoneContestDetails &&
    Array.isArray(milestoneContestDetails.milestones) &&
    milestoneContestDetails.milestones.length > 0
  ) {
    const { data: milestoneSubmissions, error: milestoneSubErr } =
      await fetchContestSubmissionsAllPages(
        supabase,
        contest.id,
        "id, creator_id, created_at, status, paid, paid_at, earnings, views, platform, other_stats, bonus_paid, bonus_amount, metadata, milestone_bonus_paid",
        {
          statusIn: ["pending", "verified", "paid"],
          order: { column: "created_at", ascending: true },
        },
      );

    if (!milestoneSubErr) {
      const milestoneRecords = (milestoneSubmissions || []).map((s: any) => ({
        id: s.id,
        creator_id: s.creator_id,
        created_at: s.created_at,
        status: s.status,
        paid: s.paid,
        paid_at: s.paid_at,
        earnings: s.earnings,
        views: s.views,
        platform: s.platform,
        other_stats: s.other_stats,
        bonus_paid: s.bonus_paid,
        bonus_amount: s.bonus_amount,
        metadata: s.metadata,
        milestone_bonus_paid: s.milestone_bonus_paid,
      }));

      const budgetSubs: BudgetTileSubmission[] = milestoneRecords.map((s) => ({
        id: s.id,
        creator_id: s.creator_id,
        created_at: s.created_at,
        status: s.status,
        paid: s.paid,
        paid_at: s.paid_at,
        earnings: s.earnings,
        views: s.views,
        platform: s.platform,
        other_stats: s.other_stats,
        bonus_paid: s.bonus_paid,
        bonus_amount: s.bonus_amount,
      }));

      const tileInput = {
        contest_type: contest.contest_type,
        post_contest_status: contest.post_contest_status,
        max_earnings_per_creator: contest.max_earnings_per_creator,
        contest_based_details: normalizeContestDetails(updatedContest),
      };
      const mode = getBudgetTileMode(contest.post_contest_status);
      const milestoneBudgetSpentCents =
        mode === "paid"
          ? computeBudgetPaidCents(tileInput, budgetSubs)
          : computeBudgetFilledCents(tileInput, budgetSubs);

      updatedContest = {
        ...updatedContest,
        contest_based_details: {
          ...normalizeContestDetails(updatedContest),
          milestone_contest: {
            ...milestoneContestDetails,
            budget_spent: milestoneBudgetSpentCents,
          },
        },
      };
    } else {
      console.error(
        "Failed to calculate milestone budget for contest",
        contest.id,
        String((milestoneSubErr as { message?: string })?.message ?? milestoneSubErr),
      );
    }
  }

  if (isDualRewardsContestType(contest.contest_type)) {
    const { data: dualSubmissions, error: dualSubErr } =
      await fetchContestSubmissionsAllPages(
        supabase,
        contest.id,
        "id, creator_id, created_at, status, paid, paid_at, earnings, views, platform, other_stats, bonus_paid, bonus_amount, dual_rewards_payout",
        {
          statusIn: ["verified", "paid"],
          order: { column: "created_at", ascending: true },
        },
      );

    if (!dualSubErr) {
      const budgetSubs: BudgetTileSubmission[] = (dualSubmissions || []).map(
        (s: {
          id: string;
          creator_id: string;
          created_at: string;
          status?: string | null;
          paid?: boolean | null;
          paid_at?: string | null;
          earnings?: number | null;
          views?: number | null;
          platform?: string | null;
          other_stats?: unknown;
          bonus_paid?: boolean | null;
          bonus_amount?: number | null;
          dual_rewards_payout?: unknown;
        }) => ({
          id: s.id,
          creator_id: s.creator_id,
          created_at: s.created_at,
          status: s.status || undefined,
          paid: s.paid ?? false,
          paid_at: s.paid_at,
          earnings: s.earnings,
          views: s.views ?? 0,
          platform: s.platform || contest.platform || undefined,
          other_stats: s.other_stats,
          bonus_paid: s.bonus_paid ?? false,
          bonus_amount: s.bonus_amount ?? undefined,
          dual_rewards_payout: s.dual_rewards_payout,
        }),
      );

      const tileInput = {
        contest_type: contest.contest_type,
        post_contest_status: contest.post_contest_status,
        max_earnings_per_creator: contest.max_earnings_per_creator,
        contest_based_details: normalizeContestDetails(updatedContest),
      };
      const mode = getBudgetTileMode(contest.post_contest_status);
      const poolSpentCents =
        mode === "paid"
          ? computeBudgetPaidCents(tileInput, budgetSubs)
          : computeBudgetFilledCents(tileInput, budgetSubs);

      updatedContest = {
        ...updatedContest,
        contest_based_details: {
          ...normalizeContestDetails(updatedContest),
          pool_budget_spent_cents: poolSpentCents,
        },
      };
    } else {
      console.error(
        "Failed to calculate dual rewards pool budget for contest",
        contest.id,
        String((dualSubErr as { message?: string })?.message ?? dualSubErr),
      );
    }
  }

  if (!updatedContest.status) {
    updatedContest.status = "unknown";
  }

  if (!isMilestone) {
    contestDetailsCache.set(cacheKey, updatedContest);
  }
  return updatedContest;
}

export async function getAdvertiserContestsWithCalculatedBudgets(
  advertiserId: string,
  supabaseClient?: SupabaseClient,
) {
  const supabase = supabaseClient ?? (await createClient());
  const contestsData = await fetchContestsWithDetails(supabase, {
    advertiserId,
  });

  const contestsWithCalculatedBudgets = await Promise.all(
    contestsData.map(async (contest) => {
      const enrichedContest = await enrichContestWithCalculatedBudgets(
        contest,
        supabase,
      );
      return enrichedContest;
    }),
  );

  return contestsWithCalculatedBudgets;
}

export async function getAllContestsWithCalculatedBudgets(
  supabaseClient?: SupabaseClient,
) {
  const supabase = supabaseClient ?? (await createClient());
  const contestsData = await fetchContestsWithDetails(supabase, {
    includeAdvertiserProfile: true,
  });

  const contestsWithCalculatedBudgets = await Promise.all(
    contestsData.map(async (contest) => {
      const enrichedContest = await enrichContestWithCalculatedBudgets(
        contest,
        supabase,
      );
      return enrichedContest;
    }),
  );

  return contestsWithCalculatedBudgets;
}
