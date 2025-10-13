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
  const contestsWithCalculatedBudgets = await Promise.all((contestsData || []).map(async (contest) => {
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
      return {
        ...contest,
        contest_based_details: {
          ...contest.contest_based_details,
          leaderboard_contest: {
            ...contest.contest_based_details.leaderboard_contest,
            budget_spent: Math.round(actualBudgetSpent * 100) // Convert to cents
          }
        },
        status: contest.status || 'unknown'
      };
    }
    return {
      ...contest,
      status: contest.status || 'unknown'
    };
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
