import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { RouteGuard } from "@/components/guards/RouteGuard";
import AnalyticsClient from "./AnalyticsClient";
import { formatCurrencyFromCents } from "@/lib/currency-utils";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .single();

  if (userError) {
    console.error("Error fetching user data:", userError);
    redirect("/dashboard?error=user_fetch_failed");
  }

  // Only allow advertisers to access this page
  if (userData?.user_type !== "advertiser") {
    console.warn(
      `User ${user.id} with type ${userData?.user_type} attempted to access analytics page.`
    );
    redirect("/dashboard");
  }

  // Fetch analytics data
  const { data: contests } = await supabase
    .from("contests")
    .select("*")
    .eq("advertiser_id", user.id);

  const { data: submissions } = await supabase
    .from("submissions")
    .select("*, contests!inner(*)")
    .eq("contests.advertiser_id", user.id);

  // Calculate analytics
  const totalContests = contests?.length || 0;
  const totalSubmissions = submissions?.length || 0;
  const totalViews =
    submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0;
  const totalSpent =
    contests?.reduce((sum, contest) => {
      if (
        contest.contest_type === "leaderboard" &&
        contest.contest_based_details?.leaderboard_contest?.total_prize
      ) {
        return (
          sum + contest.contest_based_details.leaderboard_contest.total_prize
        );
      } else if (
        contest.contest_type === "cpm" &&
        contest.contest_based_details?.cpm_contest?.total_budget
      ) {
        return sum + contest.contest_based_details.cpm_contest.total_budget;
      }
      return sum;
    }, 0) || 0;

  return (
    <RouteGuard allowedUserTypes={["advertiser"]} fallbackPath="/dashboard/opportunities">
      <AnalyticsClient
        totalContests={totalContests}
        totalSubmissions={totalSubmissions}
        totalViews={totalViews}
        totalSpent={formatCurrencyFromCents(totalSpent)}
      />
    </RouteGuard>
  );
}
