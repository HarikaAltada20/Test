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

  console.log("contestData", contestData);

  if (!contestData) {
    redirect("/dashboard/contests");
  }

  let finalInspirationLinks: string[] | null = null;
  const rawInspirationLinks = contestData.inspiration_links;

  if (Array.isArray(rawInspirationLinks)) {
    finalInspirationLinks = rawInspirationLinks.filter(link => typeof link === 'string');
  } else if (typeof rawInspirationLinks === 'string') {
    try {
      const parsed = JSON.parse(rawInspirationLinks);
      if (Array.isArray(parsed)) {
        finalInspirationLinks = parsed.filter(link => typeof link === 'string');
      } else {
        finalInspirationLinks = null;
      }
    } catch (error) {
      finalInspirationLinks = null;
    }
  } else if (rawInspirationLinks === null) {
    finalInspirationLinks = null;
  } else {
    if (rawInspirationLinks !== undefined) {
      // console.warn('Inspiration links is of unexpected type:', typeof rawInspirationLinks, rawInspirationLinks);
    }
    finalInspirationLinks = null;
  }

  const { data: submissionsData } = await supabase // Renamed to avoid conflict
    .from("submissions")
    .select("*, creator_profiles(username)")
    .eq("contest_id", contestId)
    .order("current_views", { ascending: false });

  const isLive = contestData.status === "active";

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
    start_date: contestData.start_date,
    end_date: contestData.end_date,
    rules: contestData.rules,
    inspiration_links: finalInspirationLinks,
    resources: contestData.resources,
    contest_type: contestData.contest_type,
    contest_based_details: contestData.contest_based_details,
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
