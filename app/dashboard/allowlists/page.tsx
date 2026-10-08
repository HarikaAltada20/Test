import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import AllowlistsClient from "./client";

export default async function AllowlistsPage() {
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

  if (userData?.user_type !== "advertiser") {
    redirect("/dashboard");
  }

  return <AllowlistsClient />;
}
