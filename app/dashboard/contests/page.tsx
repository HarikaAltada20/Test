import React, { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import { redirect } from "next/navigation";
import {
  ContestsPageClient,
  type CreatorRouteNotice,
} from "./ContestsPageClient";
import { ContestsListLoader } from "./ContestsListLoader";
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

  if (userData?.user_type === "admin") {
    redirect("/dashboard/admin/contests");
  }

  if (userData?.user_type !== "advertiser") {
    redirect("/dashboard");
  }

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
    <ContestsPageClient userId={user.id} creatorRouteNotice={creatorRouteNotice}>
      <Suspense
        fallback={
          <div className="flex min-h-[50vh] w-full items-center justify-center py-16">
            <PageLoadingSpinner mode="light" />
          </div>
        }
      >
        <ContestsListLoader userId={user.id} />
      </Suspense>
    </ContestsPageClient>
  );
}
