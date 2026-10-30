import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import HelpClient from "./client";
import BrandHelpClient from "./BrandHelpClient";

export const metadata: Metadata = {
  title: "Help - Game Of Creators",
  description: "Chat with the Game Of Creators team or learn how it works",
};

export default async function HelpPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    redirect("/auth/signin");
  }

  const { data: advertiserProfile } = await supabase
    .from("advertiser_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (advertiserProfile) {
    return <BrandHelpClient />;
  }

  return <HelpClient />;
}
