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
    const creatorId = searchParams.get("creatorId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get user type
    const { data: userData } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (userData?.user_type !== "advertiser") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (creatorId) {
      // Get detailed analytics for a specific creator
      const { data: creator } = await supabase
        .from("users")
        .select(`
          id,
          username,
          email,
          created_at,
          creator_profiles (
            bio,
            total_contests_participated,
            total_contests_won,
            total_views,
            total_money_won,
            youtube_account,
            instagram_account
          )
        `)
        .eq("id", creatorId)
        .single();

      if (!creator) {
        return NextResponse.json({ error: "Creator not found" }, { status: 404 });
      }

      // Get creator's submissions for this advertiser's contests
      let submissionsQuery = supabase
        .from("submissions")
        .select(`
          id,
          views,
          created_at,
          platform,
          status,
          earnings,
          contest_id,
          contests!inner (
            id,
            title,
            advertiser_id,
            contest_type,
            contest_based_details
          )
        `)
        .eq("creator_id", creatorId)
        .eq("contests.advertiser_id", user.id);

      // Apply status filter if provided
      if (submissionStatus && submissionStatus !== "all") {
        if (submissionStatus === "verifiedPaid") {
          submissionsQuery = submissionsQuery.in("status", ["verified", "paid"]);
        } else {
          submissionsQuery = submissionsQuery.eq("status", submissionStatus);
        }
      }

      const { data: submissions } = await submissionsQuery.order("created_at", { ascending: false });

      if (!submissions) {
        return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
      }

      // Calculate creator-specific metrics for this advertiser
      const totalSubmissions = submissions.length;
      const totalViews = submissions.reduce((sum, sub) => sum + (sub.views || 0), 0);
      const totalEarnings = submissions.reduce((sum, sub) => sum + (sub.earnings || 0), 0);
      const avgViewsPerSubmission = totalSubmissions > 0 ? totalViews / totalSubmissions : 0;

      // Platform breakdown
      const platformStats = submissions.reduce((acc, sub) => {
        const platform = sub.platform || "unknown";
        if (!acc[platform]) {
          acc[platform] = { submissions: 0, views: 0, earnings: 0 };
        }
        acc[platform].submissions++;
        acc[platform].views += sub.views || 0;
        acc[platform].earnings += sub.earnings || 0;
        return acc;
      }, {} as Record<string, { submissions: number; views: number; earnings: number }>);

      // Contest type breakdown
      const contestTypeStats = submissions.reduce((acc, sub) => {
        const contestType = (sub.contests as any).contest_type || "unknown";
        if (!acc[contestType]) {
          acc[contestType] = { submissions: 0, views: 0, earnings: 0 };
        }
        acc[contestType].submissions++;
        acc[contestType].views += sub.views || 0;
        acc[contestType].earnings += sub.earnings || 0;
        return acc;
      }, {} as Record<string, { submissions: number; views: number; earnings: number }>);

      // Performance timeline (monthly)
      const performanceTimeline = submissions.reduce((acc, sub) => {
        const month = new Date(sub.created_at).toISOString().slice(0, 7); // YYYY-MM format
        if (!acc[month]) {
          acc[month] = { submissions: 0, views: 0, earnings: 0 };
        }
        acc[month].submissions++;
        acc[month].views += sub.views || 0;
        acc[month].earnings += sub.earnings || 0;
        return acc;
      }, {} as Record<string, { submissions: number; views: number; earnings: number }>);

      // Top performing submissions
      const topSubmissions = submissions
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 10);

      return NextResponse.json({
        creator: {
          ...creator,
          metrics: {
            totalSubmissions,
            totalViews,
            totalEarnings,
            avgViewsPerSubmission: Math.round(avgViewsPerSubmission * 100) / 100
          },
          platformStats,
          contestTypeStats,
          performanceTimeline,
          topSubmissions
        }
      });
    } else {
      // Get leaderboard of creators
      let submissionsQuery = supabase
        .from("submissions")
        .select(`
          id,
          views,
          created_at,
          platform,
          status,
          earnings,
          creator_id,
          creator:creator_id (
            id,
            username,
            creator_profiles (
              bio,
              total_views,
              total_contests_participated,
              total_contests_won,
              youtube_account,
              instagram_account
            )
          ),
          contests!inner (
            id,
            advertiser_id,
            title,
            contest_type
          )
        `)
        .eq("contests.advertiser_id", user.id);

      // Apply status filter if provided
      if (submissionStatus && submissionStatus !== "all") {
        if (submissionStatus === "verifiedPaid") {
          submissionsQuery = submissionsQuery.in("status", ["verified", "paid"]);
        } else {
          submissionsQuery = submissionsQuery.eq("status", submissionStatus);
        }
      }

      const { data: submissions } = await submissionsQuery.order("created_at", { ascending: false });

      if (!submissions) {
        return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
      }

      // Group by creator and calculate metrics
      const creatorStats = submissions.reduce((acc, sub) => {
        const creatorId = sub.creator_id;
        if (!acc[creatorId]) {
          acc[creatorId] = {
            creator: sub.creator,
            totalSubmissions: 0,
            totalViews: 0,
            totalEarnings: 0,
            platforms: new Set(),
            contestTypes: new Set(),
            firstSubmission: null,
            lastSubmission: null
          };
        }

        acc[creatorId].totalSubmissions++;
        acc[creatorId].totalViews += sub.views || 0;
        acc[creatorId].totalEarnings += sub.earnings || 0;
        if (sub.platform) acc[creatorId].platforms.add(sub.platform);
        if ((sub.contests as any).contest_type) acc[creatorId].contestTypes.add((sub.contests as any).contest_type);

        const submissionDate = new Date(sub.created_at);
        if (!acc[creatorId].firstSubmission || submissionDate < acc[creatorId].firstSubmission) {
          acc[creatorId].firstSubmission = submissionDate;
        }
        if (!acc[creatorId].lastSubmission || submissionDate > acc[creatorId].lastSubmission) {
          acc[creatorId].lastSubmission = submissionDate;
        }

        return acc;
      }, {} as Record<string, any>);

      // Convert to array and calculate additional metrics
      const creatorsLeaderboard = Object.values(creatorStats).map((creator: any) => ({
        ...creator,
        platforms: Array.from(creator.platforms),
        contestTypes: Array.from(creator.contestTypes),
        avgViewsPerSubmission: creator.totalSubmissions > 0 ? creator.totalViews / creator.totalSubmissions : 0,
        avgEarningsPerSubmission: creator.totalSubmissions > 0 ? creator.totalEarnings / creator.totalSubmissions : 0,
        daysActive: creator.lastSubmission && creator.firstSubmission ? 
          Math.ceil((creator.lastSubmission - creator.firstSubmission) / (1000 * 60 * 60 * 24)) : 0
      }));

      // Sort by different criteria
      const topByViews = [...creatorsLeaderboard]
        .sort((a, b) => b.totalViews - a.totalViews)
        .slice(0, limit);
      
      const topBySubmissions = [...creatorsLeaderboard]
        .sort((a, b) => b.totalSubmissions - a.totalSubmissions)
        .slice(0, limit);
      
      const topByEarnings = [...creatorsLeaderboard]
        .sort((a, b) => b.totalEarnings - a.totalEarnings)
        .slice(0, limit);

      // Calculate summary statistics
      const totalUniqueCreators = creatorsLeaderboard.length;
      const totalSubmissions = submissions.length;
      const totalViews = submissions.reduce((sum, sub) => sum + (sub.views || 0), 0);
      const totalEarnings = submissions.reduce((sum, sub) => sum + (sub.earnings || 0), 0);

      // Platform demographics
      const platformDemographics = submissions.reduce((acc, sub) => {
        const platform = sub.platform || "unknown";
        acc[platform] = (acc[platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Contest type preferences
      const contestTypePreferences = submissions.reduce((acc, sub) => {
        const contestType = (sub.contests as any).contest_type || "unknown";
        acc[contestType] = (acc[contestType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return NextResponse.json({
        leaderboards: {
          topByViews,
          topBySubmissions,
          topByEarnings
        },
        summary: {
          totalUniqueCreators,
          totalSubmissions,
          totalViews,
          totalEarnings,
          avgSubmissionsPerCreator: totalUniqueCreators > 0 ? totalSubmissions / totalUniqueCreators : 0,
          avgViewsPerCreator: totalUniqueCreators > 0 ? totalViews / totalUniqueCreators : 0,
          avgEarningsPerCreator: totalUniqueCreators > 0 ? totalEarnings / totalUniqueCreators : 0
        },
        demographics: {
          platformDemographics,
          contestTypePreferences
        }
      });
    }
  } catch (error) {
    console.error("Analytics creators error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
