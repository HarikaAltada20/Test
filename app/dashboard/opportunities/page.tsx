import React from "react";
import OpportunitiesPage from "./client";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { createClient } from "@/utils/supabase/server";

export default async function OpportunitiesServerPage() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  return (
    // <RouteGuard allowedUserTypes={['creator']} fallbackPath="/dashboard/contests">
      <OpportunitiesPage user={user?.user} />
    // </RouteGuard>
  );
}
