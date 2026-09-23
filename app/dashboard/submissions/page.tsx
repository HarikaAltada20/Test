import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import { redirect } from "next/navigation";
import SubmissionsClient from "./SubmissionsClient";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { SubmissionWithContest } from "@/types/supabase";
import { getCreatorStatsFromProfile } from "@/lib/creator-profile-stats";

export default async function SubmissionsPage() {
  const supabase = await createClient();

  const user = await getSessionUser(supabase);

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

  // Fetch only the first page via the paginated API-route handler logic.
  // The client component loads remaining pages incrementally.
  const PAGE_SIZE = 30;

  const { data: submissionsData, error: submissionsError, count: totalCount } = await supabase
    .from("submissions")
    .select(
      "id, contest_id, creator_id, content_link, views, metadata, other_stats, created_at, status, earnings, last_insights_update, insights_status, platform, video_id, video_title, video_thumbnail_url, paid, paid_at, bonus_paid, bonus_paid_at, bonus_amount, dual_rewards_payout, quality_score, quality_score_backfilled",
      { count: "exact" },
    )
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);

  if (submissionsError) {
    console.error("Error fetching submissions:", submissionsError.message);
    return (
      <SubmissionsClient
        initialSubmissions={[]}
        fetchError={submissionsError.message}
        creatorStats={{
          trustScorePct: null,
          trustNumber: null,
          avgQualityScore: null,
          bestQualityScore: null,
          totalQualityScore: null,
        }}
      />
    );
  }

  const submissionsToFormat = submissionsData || [];

  // Hydrate contest data for the first page only
  let contestsData: any[] = [];
  try {
    const contestIds = [...new Set(submissionsToFormat.map(sub => sub.contest_id).filter(Boolean))];

    if (contestIds.length > 0) {
      const { data: fetchedContests, error: contestsError } = await supabase
        .from("contests")
        .select("id, title, contest_type, contest_format, contest_based_details, bonus_details, end_date, post_contest_status, thumbnail_url, platform, advertiser_id")
        .in("id", contestIds);

      if (contestsError) {
        console.error("Error fetching contests:", contestsError);
      } else {
        contestsData = fetchedContests || [];

        const advertiserIds = [...new Set(contestsData.map(c => c.advertiser_id).filter(Boolean))];
        if (advertiserIds.length > 0) {
          const { data: profileData } = await supabase
            .from("advertiser_profiles")
            .select("id, company_name")
            .in("id", advertiserIds);

          if (profileData) {
            const profilesMap = new Map(profileData.map(p => [p.id, p]));
            contestsData = contestsData.map(c => ({
              ...c,
              advertiser_profiles: profilesMap.get(c.advertiser_id) || null
            }));
          }
        }
      }
    }
  } catch (error) {
    console.error("Unexpected error in contest fetch:", error);
  }

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

  // Build the initial cursor for the client to continue pagination
  const lastRow = submissionsToFormat[submissionsToFormat.length - 1];
  const initialNextCursor =
    submissionsToFormat.length === PAGE_SIZE && lastRow
      ? { cursor: lastRow.created_at, cursor_id: lastRow.id }
      : null;

  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select(
      "trust_score_metrics, avg_quality_score, best_quality_score, quality_score_sum, total_money_won, total_views",
    )
    .eq("id", user.id)
    .maybeSingle();

  const profileStats = getCreatorStatsFromProfile(creatorProfile);
  const creatorStats = {
    trustScorePct: profileStats.trustMetrics.trust_score,
    trustNumber: profileStats.trustMetrics.trust_number,
    avgQualityScore: profileStats.qualityMetrics.avg_quality_score,
    bestQualityScore: profileStats.qualityMetrics.best_quality_score,
    totalQualityScore: profileStats.qualityMetrics.quality_score_sum,
  };

  return (
    <SubmissionsClient
      initialSubmissions={(formattedSubmissions as SubmissionWithContest[]) || []}
      creatorStats={creatorStats}
      initialNextCursor={initialNextCursor}
      totalCount={totalCount ?? undefined}
    />
  );
}