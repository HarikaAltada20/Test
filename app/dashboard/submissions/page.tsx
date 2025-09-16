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

  // Simplified query - get only basic submission data first
  const { data: submissionsData, error: submissionsError } = await supabase
    .from("submissions")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  if (submissionsError) {
    console.error("Error fetching submissions:", submissionsError.message);
    return (
      // <RouteGuard allowedUserTypes={['creator']} fallbackPath="/dashboard/contests">
        <SubmissionsClient initialSubmissions={[]} fetchError={submissionsError.message} />
      // </RouteGuard>
    );
  }

  const submissionsToFormat = submissionsData || [];

  // Get contest data using the simplest possible query
  let contestsData: any[] = [];
  try {
    const contestIds = [...new Set(submissionsToFormat.map(sub => sub.contest_id).filter(Boolean))];

    if (contestIds.length > 0) {
      const { data: fetchedContests } = await supabase
        .from("contests")
        .select("id, title, contest_type, contest_based_details, end_date, post_contest_status")
        .in("id", contestIds);

      contestsData = fetchedContests || [];
    }
  } catch (error) {
    console.warn("Could not fetch contest details:", error);
    // Continue without contest data if there's an error
  }

  // Create a map of contests for quick lookup
  const contestsMap = new Map();
  contestsData.forEach(contest => {
    contestsMap.set(contest.id, contest);
  });

  const formattedSubmissions = submissionsToFormat.map(sub => ({
    ...sub,
    contests: sub.contest_id ? contestsMap.get(sub.contest_id) || null : null,
    formatted_created_at: sub.created_at
      ? new Date(sub.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      : 'Date N/A'
  }));

  return (
    // <RouteGuard allowedUserTypes={['creator']} fallbackPath="/dashboard/contests">
      <SubmissionsClient
        initialSubmissions={(formattedSubmissions as SubmissionWithContest[]) || []}
      />
    // </RouteGuard>
  );
}