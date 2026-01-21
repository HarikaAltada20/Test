import { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateLeaderboardBudgetSpent,
  calculateTwitterCpmBudgetSpent,
  Submission,
} from "@/lib/contest-utils";
import { createClient } from "@/utils/supabase/server";

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

export async function getAdvertiserContestsWithCalculatedBudgets(
  advertiserId: string,
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient ?? (await createClient());

  const { data: contestsData = [] } = await supabase
    .from("contests_with_status")
    .select("*, contest_based_details")
    .eq("advertiser_id", advertiserId)
    .order("created_at", { ascending: false });

  const contestsWithCalculatedBudgets = await Promise.all(
    (contestsData || []).map(async (contest: ContestWithDetails) => {
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

        if (isTwitterTextImage) {
          const { data: twitterTweets, error: twitterError } = await supabase
            .from("twitter_campaign_tweets")
            .select("id, creator_id, tweet_created_at, moderation_status")
            .eq("contest_id", contest.id)
            .eq("is_eligible", true)
            .in("moderation_status", ["verified", "paid"]);

          if (!twitterError && twitterTweets) {
            leaderboardSubmissions = twitterTweets
              .filter((tweet) => tweet.creator_id)
              .map((tweet) => ({
                id: tweet.id,
                creator_id: tweet.creator_id,
                created_at: tweet.tweet_created_at || new Date().toISOString(),
                status: tweet.moderation_status,
                paid: tweet.moderation_status === "paid",
                earnings: null,
                bonus_paid: false,
              }));
          }
        } else {
          const { data: submissions } = await supabase
            .from("submissions")
            .select(
              "id, paid, earnings, bonus_paid, bonus_amount, creator_id, created_at, status, views"
            )
            .eq("contest_id", contest.id)
            .in("status", ["verified", "paid"]);

          leaderboardSubmissions = (submissions || []).map((submission) => ({
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

        const actualBudgetSpent = calculateLeaderboardBudgetSpent(
          leaderboardSubmissions,
          leaderboard.flat_fee_bonus
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
          status: updatedContest.status || "unknown",
        };
      }

      const platformSlug = (contest.platform || "").toLowerCase();
      const hasCpmRate = cpmDetails?.cpm_rate_usd > 0;
      const isTwitterPlatform =
        platformSlug === "twitter" || platformSlug === "x";

      if (contest.contest_type === "cpm" && isTwitterPlatform && hasCpmRate) {
        const { data: twitterTweets } = await supabase
          .from("twitter_campaign_tweets")
          .select(
            `
            id,
            creator_id,
            tweet_created_at,
            points,
            moderation_status,
            manual_points_adjustment
          `
          )
          .eq("contest_id", contest.id)
          .in("moderation_status", ["verified", "paid"]);

        const submissions =
          (twitterTweets?.map((tweet) => ({
            id: tweet.id,
            creator_id: tweet.creator_id,
            created_at: tweet.tweet_created_at,
            platform: "twitter",
            status: tweet.moderation_status,
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

        const actualBudgetSpent = calculateTwitterCpmBudgetSpent(
          submissions,
          cpmDetails.cpm_rate_usd,
          cpmDetails.max_earnings_per_creator,
          cpmDetails.min_views,
          cpmDetails.max_views,
          cpmDetails.flat_fee_bonus || 0,
          cpmDetails.flat_fee_bonus_cap || null
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
          status: updatedContest.status || "unknown",
        };
      } else if (contest.contest_type === "cpm" && hasCpmRate) {
        const { data: submissions, error: submissionsError } = await supabase
          .from("submissions")
          .select(
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
            `
          )
          .eq("contest_id", contest.id)
          .in("status", ["verified", "paid"])
          .order("created_at", { ascending: true });

        if (!submissionsError) {
          const submissionRecords = (submissions || []).map((submission) => ({
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

          const actualBudgetSpent = calculateTwitterCpmBudgetSpent(
            submissionRecords,
            cpmDetails.cpm_rate_usd,
            contest.max_earnings_per_creator ||
              cpmDetails.max_earnings_per_creator ||
              null,
            cpmDetails.min_views,
            cpmDetails.max_views,
            cpmDetails.flat_fee_bonus || 0,
            cpmDetails.flat_fee_bonus_cap || null
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
            status: updatedContest.status || "unknown",
          };
        } else {
          console.error(
            "Failed to calculate CPM budget for contest",
            contest.id,
            submissionsError.message
          );
          updatedContest.status = updatedContest.status || "unknown";
        }
      } else {
        updatedContest.status = updatedContest.status || "unknown";
      }

      return updatedContest;
    })
  );

  return contestsWithCalculatedBudgets;
}
