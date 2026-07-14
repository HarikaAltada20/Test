import React, { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import { redirect } from "next/navigation";
import { RouteGuard } from "@/components/guards/RouteGuard";
import {
  ContestsPageClient,
  type CreatorRouteNotice,
} from "./ContestsPageClient";
import { getAdvertiserContestsWithCalculatedBudgets } from "@/lib/contest-service";
import { enrichContestsWithListCardStats } from "@/lib/contest-list-card-stats";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

export default async function ContestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    creator_route?: string;
    contest_id?: string;
    creator_section?: string;
  }>;
}) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    console.log("ContestsPage: No session found, redirecting to signin.");
    redirect("/auth/signin");
  }

  const { data: userData } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
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

  const contestsWithCalculatedBudgets =
    await getAdvertiserContestsWithCalculatedBudgets(user.id, supabase);

  const typedContests = await enrichContestsWithListCardStats(
    contestsWithCalculatedBudgets || [],
  );

  const resolvedSearch = await searchParams;
  let creatorRouteNotice: CreatorRouteNotice = null;
  if (resolvedSearch.creator_route === "1") {
    if (resolvedSearch.contest_id) {
      const { data: contest } = await supabase
        .from("contests")
        .select("advertiser_id, title")
        .eq("id", resolvedSearch.contest_id)
        .maybeSingle();
      const owns = Boolean(contest && contest.advertiser_id === user.id);
      // Only block / modal when this brand does not own the contest (owners are redirected to /dashboard/contests/[id] by middleware).
      if (!owns) {
        creatorRouteNotice = {
          kind: "from_opportunity",
          contestId: resolvedSearch.contest_id,
          contestTitle: contest?.title ?? null,
        };
      }
    } else {
      const s = resolvedSearch.creator_section;
      if (s === "submissions" || s === "earnings" || s === "opportunities") {
        creatorRouteNotice = { kind: "generic", section: s };
      } else {
        creatorRouteNotice = { kind: "generic" };
      }
    }
  }

  return (
    // <RouteGuard allowedUserTypes={['advertiser', 'admin']} fallbackPath="/dashboard/opportunities">
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] w-full items-center justify-center py-16">
          <PageLoadingSpinner mode="light" />
        </div>
      }
    >
      <ContestsPageClient
        initialContests={typedContests}
        userId={user.id}
        creatorRouteNotice={creatorRouteNotice}
      />
    </Suspense>
    // </RouteGuard>
  );
}
