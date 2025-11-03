import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 60; // Revalidate every 60 seconds

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const sortBy = searchParams.get("sortBy") || "winnings";
    const platform = searchParams.get("platform") || "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");

    // Fetch all creators with their profiles
    let usersQuery = supabase
      .from("users")
      .select(
        `
        id,
        username,
        full_name,
        profile_picture_url,
        total_lifetime_coins_earned,
        advertisers_referred,
        creators_referred,
        total_other_earnings,
        creator_profiles (
          id,
          youtube_account,
          instagram_account,
          total_money_won,
          total_contests_won,
          total_contests_participated,
          total_views,
          total_submissions_made,
          total_submissions_won
        )
      `
      )
      .eq("user_type", "creator")
      .eq("is_active", true);

    const { data: creators, error: creatorsError } = await usersQuery;

    if (creatorsError) {
      console.error("Error fetching creators:", creatorsError);
      return NextResponse.json(
        { error: "Failed to fetch creators" },
        { status: 500 }
      );
    }

    if (!creators || creators.length === 0) {
      return NextResponse.json({ leaders: [] });
    }

    // Process creators to calculate metrics
    const leaders = await Promise.all(
      creators
        .filter((creator: any) => {
          // Only include creators who have a creator_profile
          const profile = Array.isArray(creator.creator_profiles)
            ? creator.creator_profiles[0]
            : creator.creator_profiles;
          return profile !== null && profile !== undefined;
        })
        .map(async (creator: any) => {
          const profile = Array.isArray(creator.creator_profiles)
            ? creator.creator_profiles[0]
            : creator.creator_profiles;

          // Prefer metrics persisted on creator_profiles to avoid heavy per-user queries
          const totalViews = profile?.total_views || 0;
          // Business rule: Treat total verified views as the value stored in creator_profiles.total_views
          const safeVerifiedViews = totalViews;

          // Money won can be either aggregated in profile or derived from transactions; prefer profile
          const totalWinnings = profile?.total_money_won || 0;

          // Submissions metrics sourced from creator_profiles
          const submissionsWon = profile?.total_submissions_won || 0;
          const submissionsMade = profile?.total_submissions_made || 0;

          // Prefer explicit profile counter if present; fallback to distinct contests from submissions
          let contestsParticipated = profile?.total_contests_participated || 0;
          // No fallback to live counting here to keep endpoint efficient and aligned with persisted metrics

          const hasYouTube =
            profile?.youtube_account !== null &&
            profile?.youtube_account !== undefined;
          const hasInstagram =
            profile?.instagram_account !== null &&
            profile?.instagram_account !== undefined;

          // Calculate affiliate earnings from total_other_earnings in users table
          const affiliateEarnings = creator.total_other_earnings || 0;

          // Derive a consistent account display name similar to analytics usage
          let accountDisplayName: string | null = null;
          try {
            if (hasYouTube) {
              const ytAccount =
                typeof profile?.youtube_account === "string"
                  ? JSON.parse(profile?.youtube_account as unknown as string)
                  : profile?.youtube_account;
              accountDisplayName = ytAccount?.channel_title || null;
            }
            if (!accountDisplayName && hasInstagram) {
              const igAccount =
                typeof profile?.instagram_account === "string"
                  ? JSON.parse(profile?.instagram_account as unknown as string)
                  : profile?.instagram_account;
              accountDisplayName =
                igAccount?.username || igAccount?.full_name || null;
            }
          } catch {}

          // Ensure username is always populated; fallback to platform account name or full name
          const resolvedUsername =
            creator.username ||
            accountDisplayName ||
            creator.full_name ||
            "anonymous";

          return {
            user_id: creator.id,
            username: resolvedUsername,
            full_name: creator.full_name,
            profile_picture_url: creator.profile_picture_url,
            metrics: {
              winnings: totalWinnings,
              affiliate_earnings: affiliateEarnings,
              contests_won: profile?.total_contests_won || 0,
              verified_views: safeVerifiedViews,
              youtube_verified_views: 0,
              instagram_verified_views: 0,
              submissions_won: submissionsWon,
              contests_participated: contestsParticipated,
              submissions_made: submissionsMade,
              referrals:
                (creator.advertisers_referred || 0) +
                (creator.creators_referred || 0),
              advertisers_referred: creator.advertisers_referred || 0,
              creators_referred: creator.creators_referred || 0,
              total_coins: creator.total_lifetime_coins_earned || 0,
            },
            platforms: {
              has_youtube: hasYouTube,
              has_instagram: hasInstagram,
            },
          };
        })
    );

    // Filter by platform (skip filter for referrals, total_coins, and affiliate_earnings as they're not platform-specific)
    const filteredLeaders =
      sortBy === "referrals" ||
      sortBy === "total_coins" ||
      sortBy === "affiliate_earnings"
        ? leaders
        : platform === "all"
        ? leaders
        : leaders.filter((entry) =>
            platform === "youtube"
              ? entry.platforms.has_youtube
              : platform === "instagram"
              ? entry.platforms.has_instagram
              : true
          );

    // Sort by selected metric
    const sortedLeaders = [...filteredLeaders].sort((a, b) => {
      // Custom tie-breakers when ranking by winnings
      if (sortBy === "winnings") {
        const primary = b.metrics.winnings - a.metrics.winnings;
        if (primary !== 0) return primary;
        // First tie-breaker: higher contests_participated
        const t1 =
          b.metrics.contests_participated - a.metrics.contests_participated;
        if (t1 !== 0) return t1;
        // Second tie-breaker: higher submissions_made
        return b.metrics.submissions_made - a.metrics.submissions_made;
      }

      // Custom tie-breakers when ranking by contests_won
      if (sortBy === "contests_won") {
        const primary = b.metrics.contests_won - a.metrics.contests_won;
        if (primary !== 0) return primary;
        // Tie-breaker: higher contests_participated (more activity)
        return (
          b.metrics.contests_participated - a.metrics.contests_participated
        );
      }

      // Custom tie-breakers when ranking by submissions_won
      if (sortBy === "submissions_won") {
        const primary = b.metrics.submissions_won - a.metrics.submissions_won;
        if (primary !== 0) return primary;
        // First tie-breaker: higher submissions_made
        const t1 = b.metrics.submissions_made - a.metrics.submissions_made;
        if (t1 !== 0) return t1;
        // Second tie-breaker: higher contests_participated
        const t2 =
          b.metrics.contests_participated - a.metrics.contests_participated;
        if (t2 !== 0) return t2;
        // Final tie-breaker: higher winnings
        return b.metrics.winnings - a.metrics.winnings;
      }

      const sortKey = sortBy as keyof typeof a.metrics;
      const aVal = a.metrics[sortKey];
      const bVal = b.metrics[sortKey];
      return bVal - aVal;
    });

    // Limit to top 100
    const top100Leaders = sortedLeaders.slice(0, 100);

    // Count total creators from creator_profiles table
    // filteredLeaders already contains all creators with profiles, filtered by platform
    const totalCreatorsCount = filteredLeaders.length;

    // Calculate summary statistics from filtered leaders
    const summary = {
      totalCreators: totalCreatorsCount,
      totalWinnings: filteredLeaders.reduce(
        (sum, entry) => sum + entry.metrics.winnings,
        0
      ),
      totalAffiliateEarnings: filteredLeaders.reduce(
        (sum, entry) => sum + entry.metrics.affiliate_earnings,
        0
      ),
      totalViews: filteredLeaders.reduce(
        (sum, entry) => sum + entry.metrics.verified_views,
        0
      ),
      totalContestsWon: filteredLeaders.reduce(
        (sum, entry) => sum + entry.metrics.contests_won,
        0
      ),
      totalSubmissionsWon: filteredLeaders.reduce(
        (sum, entry) => sum + entry.metrics.submissions_won,
        0
      ),
      totalContestsParticipated: filteredLeaders.reduce(
        (sum, entry) => sum + entry.metrics.contests_participated,
        0
      ),
      totalSubmissionsMade: filteredLeaders.reduce(
        (sum, entry) => sum + entry.metrics.submissions_made,
        0
      ),
      totalReferrals: filteredLeaders.reduce(
        (sum, entry) => sum + entry.metrics.referrals,
        0
      ),
      totalAdvertisersReferred: filteredLeaders.reduce(
        (sum, entry) => sum + (entry.metrics.advertisers_referred || 0),
        0
      ),
      totalCreatorsReferred: filteredLeaders.reduce(
        (sum, entry) => sum + (entry.metrics.creators_referred || 0),
        0
      ),
      totalCoins: filteredLeaders.reduce(
        (sum, entry) => sum + entry.metrics.total_coins,
        0
      ),
      averageWinnings:
        filteredLeaders.length > 0
          ? Math.round(
              filteredLeaders.reduce(
                (sum, entry) => sum + entry.metrics.winnings,
                0
              ) / filteredLeaders.length
            )
          : 0,
      averageViews:
        filteredLeaders.length > 0
          ? Math.round(
              filteredLeaders.reduce(
                (sum, entry) => sum + entry.metrics.verified_views,
                0
              ) / filteredLeaders.length
            )
          : 0,
    };

    // Calculate pagination
    const totalPages = Math.ceil(top100Leaders.length / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLeaders = top100Leaders.slice(startIndex, endIndex);

    return NextResponse.json({
      leaders: paginatedLeaders,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: top100Leaders.length,
        itemsPerPage: limit,
      },
      summary,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in leaderboard API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
