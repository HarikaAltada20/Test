import React from "react";
import SubmitContentPage from "./client";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";

export default async function page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  return <SubmitContentPage contestId={resolvedParams.id} user={user} />;
}
