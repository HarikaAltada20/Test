import { createClient } from "@/utils/supabase/server";
import { listCampaignsPaginated } from "@/lib/contest-list-query";
import { ContestListClient } from "./ContestListClient";

type ContestsListLoaderProps = {
  userId?: string;
  isAdminView?: boolean;
};

export async function ContestsListLoader({
  userId,
  isAdminView = false,
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

  return (
    <ContestListClient
      initialContests={contests as Parameters<typeof ContestListClient>[0]["initialContests"]}
      initialTotal={list.total}
      initialTabCounts={list.tabCounts}
      initialPostPhaseCounts={list.postPhaseCounts}
      initialAvailablePlatforms={list.availablePlatforms}
      isAdminView={isAdminView}
    />
  );
}
