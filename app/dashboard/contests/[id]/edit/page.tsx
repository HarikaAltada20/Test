import React from "react";
import EditContestClient from "./client";
import { createClient } from "@/utils/supabase/server";

export default async function page({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>,
  searchParams: Promise<{ dates?: string }>
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const datesOnly = resolvedSearchParams.dates === 'true';

  return <EditContestClient
    user={user?.user}
    contestId={resolvedParams.id}
    datesOnly={datesOnly}
  />;
}
