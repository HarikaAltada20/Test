import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const submissionStatus = searchParams.get("status");

    // Get user type
    const { data: userData } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (userData?.user_type !== "advertiser") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch contests with submission data
    let submissionsQuery = supabase
      .from("submissions")
      .select(`
        id,
        views,
        created_at,
        platform,
        creator_id,
        other_stats,
        status,
        contest_id
      `);

    // Apply status filter if provided
    if (submissionStatus && submissionStatus !== "all") {
      if (submissionStatus === "verifiedPaid") {
        submissionsQuery = submissionsQuery.in("status", ["verified", "paid"]);
      } else {
        submissionsQuery = submissionsQuery.eq("status", submissionStatus);
      }
    }

    const { data: allSubmissions } = await submissionsQuery;

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
        live_submission_count
      `)
      .eq("advertiser_id", user.id)
      .order("created_at", { ascending: false });

    // Attach filtered submissions to contests
    const contestsWithSubmissions = contests?.map(contest => ({
      ...contest,
      submissions: allSubmissions?.filter(sub => sub.contest_id === contest.id) || []
    })) || [];

    if (!contestsWithSubmissions) {
      return NextResponse.json({ error: "Failed to fetch contests" }, { status: 500 });
    }

    // Calculate overview metrics based on filtered submissions
    const totalContests = contestsWithSubmissions.length;
    const totalSubmissions = contestsWithSubmissions.reduce((sum, contest) => sum + (contest.submissions?.length || 0), 0);
    const totalViews = contestsWithSubmissions.reduce((sum, contest) => 
      sum + contest.submissions?.reduce((subSum, sub) => subSum + (sub.views || 0), 0) || 0, 0
    );

    // Calculate total spent (only for contests that have filtered submissions)
    const totalSpent = contestsWithSubmissions.reduce((sum, contest) => {
      // Only include contest budget if it has submissions after filtering
      if (contest.submissions.length > 0) {
        const details = contest.contest_based_details;
        if (contest.contest_type === "leaderboard" && details?.leaderboard_contest?.total_prize) {
          return sum + details.leaderboard_contest.total_prize;
        } else if (contest.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
          return sum + details.cpm_contest.total_budget;
        }
      }
      return sum;
    }, 0);

    // Calculate additional metrics
    const avgCostPerView = totalViews > 0 ? totalSpent / totalViews : 0;
    const avgCostPerSubmission = totalSubmissions > 0 ? totalSpent / totalSubmissions : 0;
    const avgSubmissionsPerContest = totalContests > 0 ? totalSubmissions / totalContests : 0;

    // Platform breakdown based on filtered submissions
    const platformStats = contestsWithSubmissions.reduce((acc, contest) => {
      const platform = contest.platform || "unknown";
      if (!acc[platform]) {
        acc[platform] = {
          contests: 0,
          submissions: 0,
          views: 0,
          spent: 0
        };
      }
      
      // Only count contests that have submissions after filtering
      if (contest.submissions.length > 0) {
        acc[platform].contests++;
        acc[platform].submissions += contest.submissions.length;
        acc[platform].views += contest.submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0;
        
        // Calculate spent for this contest
        const details = contest.contest_based_details;
        let contestSpent = 0;
        if (contest.contest_type === "leaderboard" && details?.leaderboard_contest?.total_prize) {
          contestSpent = details.leaderboard_contest.total_prize;
        } else if (contest.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
          contestSpent = details.cpm_contest.total_budget;
        }
        acc[platform].spent += contestSpent;
      }
      
      return acc;
    }, {} as Record<string, { contests: number; submissions: number; views: number; spent: number }>);

    // Monthly trends (last 12 months) based on filtered submissions
    const monthlyData = contestsWithSubmissions.reduce((acc, contest) => {
      const month = new Date(contest.created_at).toISOString().slice(0, 7); // YYYY-MM format
      if (!acc[month]) {
        acc[month] = {
          contests: 0,
          submissions: 0,
          views: 0,
          spent: 0
        };
      }
      
      // Only count contests that have submissions after filtering
      if (contest.submissions.length > 0) {
        acc[month].contests++;
        acc[month].submissions += contest.submissions.length;
        acc[month].views += contest.submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0;
        
        const details = contest.contest_based_details;
        let contestSpent = 0;
        if (contest.contest_type === "leaderboard" && details?.leaderboard_contest?.total_prize) {
          contestSpent = details.leaderboard_contest.total_prize;
        } else if (contest.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
          contestSpent = details.cpm_contest.total_budget;
        }
        acc[month].spent += contestSpent;
      }
      
      return acc;
    }, {} as Record<string, { contests: number; submissions: number; views: number; spent: number }>);

    // Find top performing contest based on filtered submissions
    const topContest = contestsWithSubmissions.reduce((top, contest) => {
      const contestViews = contest.submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0;
      const topViews = top?.submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0;
      return contestViews > topViews ? contest : top;
    }, contestsWithSubmissions[0] || null);

    // Contest type breakdown based on filtered submissions
    const contestTypeStats = contestsWithSubmissions.reduce((acc, contest) => {
      const type = contest.contest_type || "unknown";
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          submissions: 0,
          views: 0,
          spent: 0
        };
      }
      
      // Only count contests that have submissions after filtering
      if (contest.submissions.length > 0) {
        acc[type].count++;
        acc[type].submissions += contest.submissions.length;
        acc[type].views += contest.submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0;
        
        const details = contest.contest_based_details;
        let contestSpent = 0;
        if (contest.contest_type === "leaderboard" && details?.leaderboard_contest?.total_prize) {
          contestSpent = details.leaderboard_contest.total_prize;
        } else if (contest.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
          contestSpent = details.cpm_contest.total_budget;
        }
        acc[type].spent += contestSpent;
      }
      
      return acc;
    }, {} as Record<string, { count: number; submissions: number; views: number; spent: number }>);

    const response = {
      overview: {
        totalContests,
        totalSubmissions,
        totalViews,
        totalSpent,
        avgCostPerView: Math.round(avgCostPerView * 100) / 100, // Round to 2 decimal places
        avgCostPerSubmission: Math.round(avgCostPerSubmission * 100) / 100,
        avgSubmissionsPerContest: Math.round(avgSubmissionsPerContest * 100) / 100,
        topContest: topContest ? {
          id: topContest.id,
          title: topContest.title,
          views: topContest.submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0,
          submissions: topContest.live_submission_count || 0
        } : null
      },
      platformStats,
      monthlyData,
      contestTypeStats
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Analytics overview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
