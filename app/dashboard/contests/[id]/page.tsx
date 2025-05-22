import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ContestDetailClient from "./contest-detail-client"; // Import the new client component

export default async function ContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const contestId = resolvedParams.id;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: userData } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .single();

  if (userData?.user_type !== "advertiser") {
    redirect("/dashboard");
  }

  const { data: contestData } = await supabase // Renamed to avoid conflict with component prop
    .from("contests_with_status")
    .select("*")
    .eq("id", contestId)
    .single();

  if (!contestData) {
    redirect("/dashboard/contests");
  }

  const { data: submissionsData } = await supabase // Renamed to avoid conflict
    .from("submissions")
    .select("*, creator_profiles(username)")
    .eq("contest_id", contestId)
    .order("current_views", { ascending: false });

  const isLive = contestData.status === "live";

  const calculateDurationDays = (
    start: string | null,
    end: string | null
  ): number | null => {
    if (!start || !end) return null;
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (error) {
      console.error("Error calculating duration:", error);
      return null;
    }
  };

  const durationDays = calculateDurationDays(
    contestData.start_date,
    contestData.end_date
  );

  // Ensure contestData and submissionsData are compatible with the client component props
  // The client component expects specific shapes for contest and submissions
  const contest = {
    id: contestData.id,
    title: contestData.title,
    status: contestData.status,
    thumbnail_url: contestData.thumbnail_url,
    brief: contestData.brief,
    platform: contestData.platform,
    start_date: contestData.start_date, // Pass as string or Date
    end_date: contestData.end_date,     // Pass as string or Date
    prizes: contestData.prizes || [], // Ensure it's an array
    rules: contestData.rules,
    inspiration_links: contestData.inspiration_links,
    resources: contestData.resources,
    total_prize: contestData.total_prize,
    winner_count: contestData.winner_count,
  };

  const submissions = submissionsData
    ? submissionsData.map((sub) => ({
      id: sub.id,
      creator_profiles: sub.creator_profiles,
      created_at: sub.created_at, // Pass as string or Date
      current_views: sub.current_views,
      status: sub.status,
      content_link: sub.content_link,
    }))
    : null;

  return (
    <ContestDetailClient
      contest={contest}
      submissions={submissions}
      isLive={isLive}
      durationDays={durationDays}
      contestId={contestId}
    />
  );
}
