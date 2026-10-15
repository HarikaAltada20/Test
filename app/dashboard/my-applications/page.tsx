import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import MyApplicationsClient from "./client";

export const metadata: Metadata = {
  title: "My applications",
};

export default async function MyApplicationsPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    redirect("/auth/signin");
  }

  const { data: userData } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .single();

  if (userData?.user_type !== "creator") {
    redirect("/dashboard");
  }

  return <MyApplicationsClient />;
}
