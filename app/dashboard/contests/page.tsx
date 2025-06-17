import React, { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ContestListClient } from "./ContestListClient";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

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

  const typedContests = (contestsData || []).map(contest => {
    let total_prize_money_sortable: number | null = null;
    if (contest.contest_type === 'leaderboard' &&
      contest.contest_based_details &&
      typeof contest.contest_based_details === 'object' &&
      (contest.contest_based_details as any).leaderboard_contest &&
      typeof (contest.contest_based_details as any).leaderboard_contest.total_prize === 'number') {
      total_prize_money_sortable = (contest.contest_based_details as any).leaderboard_contest.total_prize;
    }
    return { ...contest, status: contest.status || 'unknown', total_prize_money_sortable };
  }) as any[];


  return (
    <RouteGuard allowedUserTypes={['advertiser', 'admin']} fallbackPath="/dashboard/opportunities">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Contests</h1>
          </div>
          <Button variant="white" className="w-full sm:w-auto" asChild>
            <Link href="/dashboard/contests/create">
              <Plus className="mr-2 h-4 w-4" /> Create Contest
            </Link>
          </Button>
        </div>
        <Suspense fallback={<div>Loading contests...</div>}>
          <ContestListClient
            initialContests={typedContests}
            isAdminView={false}
          />
        </Suspense>
      </div>
    </RouteGuard>
  );
}
