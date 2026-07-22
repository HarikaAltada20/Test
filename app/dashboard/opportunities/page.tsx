import React, { Suspense } from "react";
import OpportunitiesPage from "./client";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import { listCampaignsPaginated } from "@/lib/contest-list-query";
import { buildOpportunitiesListQueryKey } from "@/lib/opportunities-list-query";
import { getCreatorUserCountries } from "@/lib/opportunities-user-countries";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

export const dynamic = "force-dynamic";

export default async function OpportunitiesServerPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

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
  let initialUserCountries: string[] = [];
  let initialListQueryKey = "";

  if (user) {
    initialUserCountries = await getCreatorUserCountries(supabase, user.id);

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

    initialListQueryKey = buildOpportunitiesListQueryKey(listQuery);

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
      console.error("[opportunities/page] initial list fetch failed:", error);
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[76vh]">
          <PageLoadingSpinner mode="light" />
        </div>
      }
    >
      <OpportunitiesPage
        user={user}
        initialContests={initialContests}
        initialTotal={initialTotal}
        initialTabCounts={initialTabCounts}
        initialUserCountries={initialUserCountries}
        initialListQueryKey={initialListQueryKey}
      />
    </Suspense>
  );
}
