import React from "react";
import CreateContestPage from "./client";
import { createClient } from "@/utils/supabase/server";

export default async function page() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  return <CreateContestPage user={user?.user} />;
}
