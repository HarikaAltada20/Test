import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user type
    const { data: userData } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (userData?.user_type !== "advertiser") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const contestId = searchParams.get("contestId");

    if (contestId) {
      // Get detailed analytics for a specific contest
      const { data: contest } = await supabase
        .from("contests")
        .select(`
          id,
          title,
          platform,
          contest_type,
          start_date,
          end_date,
          created_at,
          contest_based_details,
          live_submission_count,
          brief_html,
          submissions (
            id,
            views,
            created_at,
            platform,
            creator_id,
            other_stats,
            status,
            earnings,
            creator:creator_id (
              username,
              creator_profiles (
                total_views,
                total_contests_participated,
                youtube_account,
                instagram_account
              )
            )
          )
        `)
        .eq("id", contestId)
        .eq("advertiser_id", user.id)
        .single();

      if (!contest) {
        return NextResponse.json({ error: "Contest not found" }, { status: 404 });
      }

      // Calculate contest-specific metrics
      const totalViews = contest.submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0;
      const totalSubmissions = contest.submissions?.length || 0;
      
      // Calculate total spent for this contest
      let totalSpent = 0;
      const details = contest.contest_based_details;
      if (contest.contest_type === "leaderboard" && details?.leaderboard_contest?.total_prize) {
        totalSpent = details.leaderboard_contest.total_prize;
      } else if (contest.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
        totalSpent = details.cpm_contest.total_budget;
      }

      const avgViewsPerSubmission = totalSubmissions > 0 ? totalViews / totalSubmissions : 0;
      const costPerView = totalViews > 0 ? totalSpent / totalViews : 0;

      // Top performing submissions
      const topSubmissions = contest.submissions
        ?.sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 10) || [];

      // Submission timeline (daily submissions)
      const submissionTimeline = contest.submissions?.reduce((acc, sub) => {
        const date = new Date(sub.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = 0;
        }
        acc[date]++;
        return acc;
      }, {} as Record<string, number>) || {};

      // Platform breakdown for this contest
      const platformBreakdown = contest.submissions?.reduce((acc, sub) => {
        const platform = sub.platform || "unknown";
        if (!acc[platform]) {
          acc[platform] = { count: 0, views: 0 };
        }
        acc[platform].count++;
        acc[platform].views += sub.views || 0;
        return acc;
      }, {} as Record<string, { count: number; views: number }>) || {};

      // Creator participation stats
      const uniqueCreators = new Set(contest.submissions?.map(sub => sub.creator_id)).size;
      const avgSubmissionsPerCreator = uniqueCreators > 0 ? totalSubmissions / uniqueCreators : 0;

      return NextResponse.json({
        contest: {
          ...contest,
          metrics: {
            totalViews,
            totalSubmissions,
            totalSpent,
            avgViewsPerSubmission: Math.round(avgViewsPerSubmission * 100) / 100,
            costPerView: Math.round(costPerView * 100) / 100,
            uniqueCreators,
            avgSubmissionsPerCreator: Math.round(avgSubmissionsPerCreator * 100) / 100
          },
          topSubmissions,
          submissionTimeline,
          platformBreakdown
        }
      });
    } else {
      // Get list of all contests with basic metrics
      const { data: contests } = await supabase
        .from("contests")
        .select(`
          id,
          title,
          platform,
          contest_type,
          start_date,
          end_date,
          created_at,
          contest_based_details,
          live_submission_count,
          post_contest_status,
          moderation_status,
          submissions (
            id,
            views,
            created_at,
            platform
          )
        `)
        .eq("advertiser_id", user.id)
        .order("created_at", { ascending: false });

      if (!contests) {
        return NextResponse.json({ error: "Failed to fetch contests" }, { status: 500 });
      }

      // Calculate metrics for each contest
      const contestsWithMetrics = contests.map(contest => {
        const totalViews = contest.submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0;
        const totalSubmissions = contest.submissions?.length || 0;
        
        // Calculate total spent for this contest
        let totalSpent = 0;
        const details = contest.contest_based_details;
        if (contest.contest_type === "leaderboard" && details?.leaderboard_contest?.total_prize) {
          totalSpent = details.leaderboard_contest.total_prize;
        } else if (contest.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
          totalSpent = details.cpm_contest.total_budget;
        }

        const avgViewsPerSubmission = totalSubmissions > 0 ? totalViews / totalSubmissions : 0;
        const costPerView = totalViews > 0 ? totalSpent / totalViews : 0;
        const roi = totalViews > 0 ? (totalViews / totalSpent) * 100 : 0; // Views per dollar spent

        return {
          ...contest,
          metrics: {
            totalViews,
            totalSubmissions,
            totalSpent,
            avgViewsPerSubmission: Math.round(avgViewsPerSubmission * 100) / 100,
            costPerView: Math.round(costPerView * 100) / 100,
            roi: Math.round(roi * 100) / 100
          }
        };
      });

      // Calculate summary statistics
      const totalContests = contestsWithMetrics.length;
      const totalViews = contestsWithMetrics.reduce((sum, contest) => sum + contest.metrics.totalViews, 0);
      const totalSubmissions = contestsWithMetrics.reduce((sum, contest) => sum + contest.metrics.totalSubmissions, 0);
      const totalSpent = contestsWithMetrics.reduce((sum, contest) => sum + contest.metrics.totalSpent, 0);
      const avgCostPerView = totalViews > 0 ? totalSpent / totalViews : 0;

      // Performance comparison
      const avgPerformance = {
        avgViewsPerContest: totalContests > 0 ? totalViews / totalContests : 0,
        avgSubmissionsPerContest: totalContests > 0 ? totalSubmissions / totalContests : 0,
        avgSpentPerContest: totalContests > 0 ? totalSpent / totalContests : 0,
        avgCostPerView: Math.round(avgCostPerView * 100) / 100
      };

      return NextResponse.json({
        contests: contestsWithMetrics,
        summary: {
          totalContests,
          totalViews,
          totalSubmissions,
          totalSpent,
          ...avgPerformance
        }
      });
    }
  } catch (error) {
    console.error("Analytics contests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
