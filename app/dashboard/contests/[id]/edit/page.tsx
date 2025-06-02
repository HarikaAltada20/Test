import React from "react";
import EditContestPage from "./client";
import { createClient } from "@/utils/supabase/server";

export default async function page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  return <EditContestPage user={user?.user} contestId={resolvedParams.id} />;
}
