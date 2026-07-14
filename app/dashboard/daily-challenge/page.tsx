import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import DailyChallengeClient from "./DailyChallengeClient";

export const metadata: Metadata = {
  title: "Daily Challenge",
  description: "Platform-wide daily challenge leaderboard and rewards",
};

export default async function DailyChallengePage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/auth/signin");

  const { data: userData } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .single();

  return (
    <DailyChallengeClient
      currentUserId={user.id}
      isAdmin={userData?.user_type === "admin"}
    />
  );
}
