import React from "react";
import SettingsPage from "./client";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";

export default async function page() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  return <SettingsPage user={user} />;
}
