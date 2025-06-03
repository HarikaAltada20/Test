import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import SubmissionsClient from "./SubmissionsClient";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { SubmissionWithContest } from "@/types/supabase";

export default async function SubmissionsPage() {
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

  if (userData?.user_type !== "creator") {
    console.warn(`User ${user.id} with type ${userData?.user_type} attempted to access creator content page.`);
    redirect("/dashboard");
  }

  // Get submissions for this creator
  const { data: submissionsData, error: submissionsError } = await supabase
    .from("submissions")
    .select(
      `
      id,
      created_at,
      content_link,
      views,
      status,
      earnings,
      last_insights_update,
      contest_id,
      creator_id,
      description,
      other_stats,
      platform,
      video_id,
      video_title,
      video_thumbnail_url,
      contests (
        id,
        title,
        contest_type,
        contest_based_details,
        end_date,
        post_contest_status 
      )
    `
    )
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  if (submissionsError) {
    console.error("Error fetching submissions:", submissionsError.message);
    return (
      <RouteGuard allowedUserTypes={['creator']} fallbackPath="/dashboard/contests">
        <SubmissionsClient initialSubmissions={[]} fetchError={submissionsError.message} />
      </RouteGuard>
    );
  }

  const submissionsToFormat = submissionsData || [];

  const formattedSubmissions = submissionsToFormat.map(sub => ({
    ...sub,
    contests: sub.contests ? { ...sub.contests } : null,
    formatted_created_at: sub.created_at
      ? new Date(sub.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      : 'Date N/A'
  }));

  return (
    <RouteGuard allowedUserTypes={['creator']} fallbackPath="/dashboard/contests">
      <SubmissionsClient
        initialSubmissions={(formattedSubmissions as SubmissionWithContest[]) || []}
      />
    </RouteGuard>
  );
}