import React, { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { ContestsPageClient } from "./ContestsPageClient";
import { calculateLeaderboardBudgetSpent, Submission } from "@/lib/contest-utils";

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
        .select('paid, earnings, bonus_paid, bonus_amount, creator_id, created_at, status, views')
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
