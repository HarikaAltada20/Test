import { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import LeaderboardClient from "./LeaderboardClient";

export const metadata: Metadata = {
  title: "Creator Leaderboard",
  description: "See top creators and their achievements",
};

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Get user role from the database
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .single();

  if (userError) {
    console.error("Error fetching user data:", userError);
    redirect("/dashboard?error=user_fetch_failed");
  }

  // Allow both creators and advertisers to view leaderboard
  // if (userData?.user_type !== "creator") {
  //   redirect("/dashboard");
  // }

  return <LeaderboardClient />;
}
