import React from "react";
import ProfilePage from "./client";
import { createClient } from "@/utils/supabase/server";

export default async function page() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  return <ProfilePage user={user?.user} />;
}
