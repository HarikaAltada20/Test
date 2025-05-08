import React from "react";
import SettingsPage from "./client";
import { createClient } from "@/utils/supabase/server";

export default async function page() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  return <SettingsPage user={user?.user} />;
}
