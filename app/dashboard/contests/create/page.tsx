import React from "react";
import CreateContestPage from "./client";
import { createClient } from "@/utils/supabase/server";
import { RouteGuard } from "@/components/guards/RouteGuard";

export default async function page() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  return (
    // <RouteGuard allowedUserTypes={['advertiser']} fallbackPath="/dashboard/opportunities">
      <CreateContestPage user={user?.user} />
    // </RouteGuard>
  );
}
