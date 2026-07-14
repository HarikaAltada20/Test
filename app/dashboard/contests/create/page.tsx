import React from "react";
import CreateContestPage from "./client";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import { RouteGuard } from "@/components/guards/RouteGuard";

export default async function page() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  return (
    // <RouteGuard allowedUserTypes={['advertiser']} fallbackPath="/dashboard/opportunities">
      <CreateContestPage user={user} />
    // </RouteGuard>
  );
}
