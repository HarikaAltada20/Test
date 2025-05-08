import { createClient } from "@/utils/supabase/server";
import { ContestClientPage } from "./client";
import { use } from "react";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  return <ContestClientPage contestId={resolvedParams.id} user={user?.user} />;
}
