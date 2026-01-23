import React, { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { ContestsPageClient } from "./ContestsPageClient";
import { getAdvertiserContestsWithCalculatedBudgets } from "@/lib/contest-service";

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

  const contestsWithCalculatedBudgets =
    await getAdvertiserContestsWithCalculatedBudgets(data.user.id, supabase);

  const typedContests = contestsWithCalculatedBudgets as any[];

  return (
    // <RouteGuard allowedUserTypes={['advertiser', 'admin']} fallbackPath="/dashboard/opportunities">
    <ContestsPageClient initialContests={typedContests} userId={data.user.id} />
    // </RouteGuard>
  );
}
