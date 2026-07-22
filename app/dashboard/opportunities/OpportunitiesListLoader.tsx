import { createClient } from "@/utils/supabase/server";
import type { UserResponse } from "@supabase/supabase-js";
import { listCampaignsPaginated } from "@/lib/contest-list-query";
import { buildOpportunitiesListQueryKey } from "@/lib/opportunities-list-query";
import { getCreatorUserCountries } from "@/lib/opportunities-user-countries";
import OpportunitiesPage from "./client";

type OpportunitiesListLoaderProps = {
  user: NonNullable<UserResponse["data"]["user"]>;
};

export async function OpportunitiesListLoader({
  user,
}: OpportunitiesListLoaderProps) {
  const supabase = await createClient();
  const initialUserCountries = await getCreatorUserCountries(supabase, user.id);

  const listQuery = {
    tab: "all" as const,
    sort: "relevance_desc" as const,
    page: 1,
    limit: 9,
    platform: "all",
    contestType: "all",
    mediaType: "all" as const,
    search: "",
    userCountries: initialUserCountries,
  };

  const initialListQueryKey = buildOpportunitiesListQueryKey(listQuery);

  let initialContests: Awaited<
    ReturnType<typeof listCampaignsPaginated>
  >["contests"] = [];
  let initialTotal = 0;
  let initialTabCounts = {
    all: 0,
    live: 0,
    upcoming: 0,
    ended: 0,
  };

  try {
    const list = await listCampaignsPaginated({
      supabase,
      scope: "opportunities",
      ...listQuery,
      contestFormat: "all",
    });

    initialContests = list.contests;
    initialTotal = list.total;
    initialTabCounts = {
      all: list.tabCounts.all ?? 0,
      live: list.tabCounts.live ?? 0,
      upcoming: list.tabCounts.upcoming ?? 0,
      ended: list.tabCounts.ended ?? 0,
    };
  } catch (error) {
    console.error("[OpportunitiesListLoader] initial list fetch failed:", error);
  }

  return (
    <OpportunitiesPage
      user={user}
      initialContests={initialContests}
      initialTotal={initialTotal}
      initialTabCounts={initialTabCounts}
      initialUserCountries={initialUserCountries}
      initialListQueryKey={initialListQueryKey}
    />
  );
}
