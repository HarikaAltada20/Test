import React, { Suspense } from "react";
import SubmitContentPage from "./client";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

export default async function page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8 flex justify-center">
          <PageLoadingSpinner mode="light" />
        </div>
      }
    >
      <SubmitContentPage contestId={resolvedParams.id} user={user} />
    </Suspense>
  );
}
