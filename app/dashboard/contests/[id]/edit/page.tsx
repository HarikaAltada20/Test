import React from "react";
import EditContestPage from "./client";
import { createClient } from "@/utils/supabase/server";

export default async function page({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  return <EditContestPage user={user?.user} contestId={params.id} />;
}
