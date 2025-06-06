import React, { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ContestListClient } from "./ContestListClient";
import { RouteGuard } from "@/components/guards/RouteGuard";

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
    return { ...contest, total_prize_money_sortable };
  }) as any[];

  const publishedContests = typedContests.filter((contest) => !contest.is_draft);
  const draftContests = typedContests.filter((contest) => contest.is_draft);

  return (
    <RouteGuard allowedUserTypes={['advertiser']} fallbackPath="/dashboard/opportunities">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">My Contests</h1>
          <Button className="bg-rose-600 hover:bg-rose-700" asChild>
            <Link href="/dashboard/contests/create?new=true">
              <Plus className="mr-2 h-4 w-4" /> Create Contest
            </Link>
          </Button>
        </div>
        <Suspense fallback={<div>Loading contests...</div>}>
          <ContestListClient
            publishedContests={publishedContests}
            draftContests={draftContests}
          />
        </Suspense>
      </div>
    </RouteGuard>
  );
}
