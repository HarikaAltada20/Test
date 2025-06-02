import React from "react";
import ShareContestPage from "./client";
import { createClient } from "@/utils/supabase/server";

export default async function page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  return <ShareContestPage user={user?.user || null} contestId={resolvedParams.id} />;
}
