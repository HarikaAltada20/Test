import React, { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { ContestsPageClient } from "./ContestsPageClient";
import { calculateLeaderboardBudgetSpent, calculateTwitterCpmBudgetSpent, Submission } from "@/lib/contest-utils";

export default async function ContestsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Error getting user:", error);
    return <div>Error loading page</div>;
  }

  if (!data.user) {
    console.log("ContestsPage: No session found, redirecting to signin.");
    redirect("/auth/signin");
  }

  const { data: userData } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", data.user.id)
    .single();

  if (userData?.user_type === "creator") {
    redirect("/dashboard/opportunities");
  }

  // Only allow advertisers (admins have their own route)
  if (userData?.user_type === "admin") {
    redirect("/dashboard/admin/contests");
  }

  if (userData?.user_type !== "advertiser") {
    redirect("/dashboard");
  }

  // Show only advertiser's own contests
  const { data: contestsData = [] } = await supabase
    .from("contests_with_status")
    .select("*, contest_based_details")
    .eq("advertiser_id", data.user.id)
    .order("created_at", { ascending: false });

  // For leaderboard contests, calculate actual budget spent from submissions (CPM now uses real-time budget_spent field)
  // For Twitter contests, fetch participant count from twitter_campaign_metrics
  const contestsWithCalculatedBudgets = await Promise.all((contestsData || []).map(async (contest) => {
    let updatedContest = { ...contest };

    // Check if this is a Twitter text_image contest
    const isTwitterTextImage =
      (contest.platform?.toLowerCase() === "twitter" ||
        contest.platform?.toLowerCase() === "x") &&
      contest.contest_format === "text_image";

    // Fetch participant count from twitter_campaign_metrics for Twitter contests
    if (isTwitterTextImage) {
      const { data: metrics } = await supabase
        .from("twitter_campaign_metrics")
        .select("total_participants, max_participants")
        .eq("contest_id", contest.id)
        .maybeSingle();

      if (metrics) {
        updatedContest.twitter_participants_count =
          metrics.total_participants || 0;
        updatedContest.twitter_max_participants =
          metrics.max_participants;
      } else {
        updatedContest.twitter_participants_count = 0;
        updatedContest.twitter_max_participants = null;
      }
    }

    // For leaderboard contests, calculate actual budget spent from submissions
    if (contest.contest_type === 'leaderboard' &&
      contest.contest_based_details?.leaderboard_contest?.total_budget > 0 &&
      contest.contest_based_details?.leaderboard_contest?.flat_fee_bonus > 0) {

      // Fetch submissions for this contest
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, paid, earnings, bonus_paid, bonus_amount, creator_id, created_at, status, views')
        .eq('contest_id', contest.id)
        .in('status', ['verified', 'paid']);

      // Calculate actual budget spent
      const actualBudgetSpent = calculateLeaderboardBudgetSpent(
        submissions || [],
        contest.contest_based_details.leaderboard_contest.flat_fee_bonus
      );

      // Update the contest object with calculated budget spent
      updatedContest = {
        ...updatedContest,
        contest_based_details: {
          ...updatedContest.contest_based_details,
          leaderboard_contest: {
            ...updatedContest.contest_based_details.leaderboard_contest,
            budget_spent: Math.round(actualBudgetSpent * 100) // Convert to cents
          }
        },
        status: updatedContest.status || 'unknown'
      };
    } 
    // Check if this is a Twitter CPM contest that needs budget calculation
    console.log(`[Twitter CPM Budget] Checking contest ${contest.id} (${contest.title}):`, {
      contest_type: contest.contest_type,
      platform: contest.platform,
      cpm_rate_usd: contest.contest_based_details?.cpm_contest?.cpm_rate_usd
    });
    
    if (contest.contest_type === 'cpm' &&
      contest.platform === 'twitter' &&
      contest.contest_based_details?.cpm_contest?.cpm_rate_usd > 0) {

      console.log(`[Twitter CPM Budget] Processing Twitter CPM contest ${contest.id} (${contest.title})`);

      // For Twitter contests, fetch tweets from twitter_campaign_tweets table instead of submissions
      // First try without moderation_status filter to see if tweets exist
      const { data: allTwitterTweets } = await supabase
        .from('twitter_campaign_tweets')
        .select(`
          id,
          creator_id,
          tweet_created_at,
          points,
          moderation_status,
          manual_points_adjustment
        `)
        .eq('contest_id', contest.id);

      console.log(`[Twitter CPM Budget] All tweets for contest ${contest.id}:`, allTwitterTweets?.slice(0, 2));

      // Now filter for verified/paid tweets
      const { data: twitterTweets } = await supabase
        .from('twitter_campaign_tweets')
        .select(`
          id,
          creator_id,
          tweet_created_at,
          points,
          moderation_status,
          manual_points_adjustment
        `)
        .eq('contest_id', contest.id)
        .in('moderation_status', ['verified', 'paid']); // Only include verified/paid tweets

      console.log(`[Twitter CPM Budget] Fetched ${twitterTweets?.length || 0} Twitter tweets for contest ${contest.id}:`, twitterTweets?.slice(0, 2));

      // Convert Twitter tweets to Submission format for budget calculation
      const submissions = twitterTweets?.map(tweet => ({
        id: tweet.id,
        creator_id: tweet.creator_id,
        created_at: tweet.tweet_created_at, // Use tweet_created_at instead of created_at
        platform: 'twitter', // Hardcode since this is Twitter table
        status: tweet.moderation_status,
        paid: tweet.moderation_status === 'paid',
        earnings: null, // Twitter uses points, not direct earnings
        bonus_paid: false,
        bonus_amount: 0,
        other_stats: {
          base_points: tweet.points || 0,
          manual_points_adjustment: tweet.manual_points_adjustment || 0
        },
        manual_points_adjustment: tweet.manual_points_adjustment || 0,
        views: 0 // Twitter doesn't use views
      })) || [];

      console.log(`[Twitter CPM Budget] Mapped ${submissions.length} submissions for budget calculation:`, submissions.slice(0, 2));

      // Calculate actual budget spent using Twitter CPM formula
      const actualBudgetSpent = calculateTwitterCpmBudgetSpent(
        submissions,
        contest.contest_based_details.cpm_contest.cpm_rate_usd,
        contest.contest_based_details.cpm_contest.max_earnings_per_creator,
        contest.contest_based_details.cpm_contest.min_views,
        contest.contest_based_details.cpm_contest.max_views
      );

      // Update the contest object with calculated budget spent
      updatedContest = {
        ...updatedContest,
        contest_based_details: {
          ...updatedContest.contest_based_details,
          cpm_contest: {
            ...updatedContest.contest_based_details.cpm_contest,
            budget_spent: Math.round(actualBudgetSpent * 100) // Convert to cents
          }
        },
        status: updatedContest.status || 'unknown'
      };
    } else {
      updatedContest.status = updatedContest.status || 'unknown';
    }

    return updatedContest;
  }));

  const typedContests = contestsWithCalculatedBudgets as any[];

  return (
    // <RouteGuard allowedUserTypes={['advertiser', 'admin']} fallbackPath="/dashboard/opportunities">
    <ContestsPageClient
      initialContests={typedContests}
      userId={data.user.id}
    />
    // </RouteGuard>
  );
}
