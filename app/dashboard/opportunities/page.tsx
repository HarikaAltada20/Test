import React from "react";
import OpportunitiesPage from "./client";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";

export default async function OpportunitiesServerPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  return (
    // <RouteGuard allowedUserTypes={['creator']} fallbackPath="/dashboard/contests">
      <OpportunitiesPage user={user} />
    // </RouteGuard>
  );
}
