import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { listCampaignsPaginated } from "@/lib/contest-list-query";
import { ContestListClient } from "./ContestListClient";
import {
  ContestsPageClient,
  type CreatorRouteNotice,
} from "./ContestsPageClient";
import { cn } from "@/lib/utils";

type ContestsListLoaderProps = {
  userId?: string;
  isAdminView?: boolean;
  creatorRouteNotice?: CreatorRouteNotice;
};

export async function ContestsListLoader({
  userId,
  isAdminView = false,
  creatorRouteNotice = null,
}: ContestsListLoaderProps) {
  const supabase = await createClient();

  const list = await listCampaignsPaginated({
    supabase,
    scope: isAdminView ? "admin" : "advertiser",
    advertiserId: isAdminView ? undefined : userId,
    tab: "all",
    sort: "created_at_desc",
    page: 1,
    limit: 9,
  });

  const contests = isAdminView
    ? list.contests.map((contest) => ({
        ...contest,
        advertiser_name: contest.advertiser_name || "Unknown Brand",
      }))
    : list.contests;

  const listClient = (
    <ContestListClient
      initialContests={
        contests as Parameters<typeof ContestListClient>[0]["initialContests"]
      }
      initialTotal={list.total}
      initialTabCounts={list.tabCounts}
      initialPostPhaseCounts={list.postPhaseCounts}
      initialAvailablePlatforms={list.availablePlatforms}
      isAdminView={isAdminView}
    />
  );

  if (isAdminView) {
    return (
      <div className="space-y-6">
        <header
          className={cn(
            "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
            "pb-6 border-b border-gray-200/90 dark:border-white/10",
          )}
        >
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
              All Campaigns (Admin)
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Admin view — all campaigns from every brand on the platform.
            </p>
          </div>
          <div className="flex w-full shrink-0 sm:w-auto sm:justify-end">
            <Link
              href="/dashboard/admin/contests/create"
              className={cn(
                "inline-flex w-full sm:w-auto items-center justify-center gap-2",
                "h-11 px-4 sm:px-5 text-sm font-semibold rounded-xl text-white shadow-sm",
                "transition-[opacity,box-shadow,transform] hover:opacity-95 active:scale-[0.98]",
                "bg-[#4A00BE] ring-1 ring-black/5",
                "dark:bg-[#5F2BB1] dark:ring-white/10",
              )}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sm:hidden">Create for brand</span>
              <span className="hidden sm:inline">
                Create campaign for brand
              </span>
            </Link>
          </div>
        </header>
        {listClient}
      </div>
    );
  }

  if (!userId) {
    return listClient;
  }

  return (
    <ContestsPageClient
      userId={userId}
      creatorRouteNotice={creatorRouteNotice}
      initialTabCounts={list.tabCounts}
    >
      {listClient}
    </ContestsPageClient>
  );
}
