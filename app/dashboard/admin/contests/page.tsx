import React, { Suspense, type ComponentProps } from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ContestListClient } from "../../contests/ContestListClient";
import { getAllContestsWithCalculatedBudgets } from "@/lib/contest-service";
import { enrichContestsWithListCardStats } from "@/lib/contest-list-card-stats";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

type AdminContestListItem = ComponentProps<
  typeof ContestListClient
>["initialContests"][number];

export const revalidate = 0;

export default async function AdminContestsPage() {
  const { isAdmin, error } = await verifyAdminAccess();

  if (!isAdmin) {
    console.log("Non-admin user attempted to access admin contests:", error);
    redirect("/dashboard");
  }

  const supabase = await createClient();

  try {
    const contestsWithCalculatedBudgets =
      await getAllContestsWithCalculatedBudgets(supabase);
    const contestsWithCardStats = await enrichContestsWithListCardStats(
      contestsWithCalculatedBudgets || [],
    );

    const typedContests = contestsWithCardStats.map((contest) => ({
      ...contest,
      advertiser_name:
        (contest as { advertiser_profiles?: { company_name?: string } })
          .advertiser_profiles?.company_name || "Unknown Brand",
    })) as AdminContestListItem[];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              All Campaigns (Admin)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Admin view - showing all campaigns from all brands on the platform
            </p>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="flex min-h-[50vh] w-full items-center justify-center py-16">
              <PageLoadingSpinner mode="light" />
            </div>
          }
        >
          <ContestListClient
            initialContests={typedContests}
            isAdminView={true}
          />
        </Suspense>
      </div>
    );
  } catch (error) {
    console.error("Error fetching admin contests:", error);
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Error loading contests</p>
      </div>
    );
  }
}
