import React, { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import OpportunitiesPage from "./client";
import { OpportunitiesListLoader } from "./OpportunitiesListLoader";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

export const dynamic = "force-dynamic";

export default async function OpportunitiesServerPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    return <OpportunitiesPage user={null} />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[76vh]">
          <PageLoadingSpinner mode="light" />
        </div>
      }
    >
      <OpportunitiesListLoader user={user} />
    </Suspense>
  );
}
