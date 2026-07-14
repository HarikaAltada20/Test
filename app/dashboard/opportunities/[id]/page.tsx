import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import { ContestClientPage } from "./client";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  return <ContestClientPage contestId={resolvedParams.id} user={user} />;
}
