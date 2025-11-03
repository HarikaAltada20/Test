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

    // Fetch platform-specific contest wins, participations, submissions, and winnings if platform filter is applied
    // This ensures all metrics only count data from the selected platform
    let platformContestWins: Map<string, number> = new Map();
    let platformContestParticipations: Map<string, number> = new Map();
    let platformSubmissionsWon: Map<string, number> = new Map();
    let platformSubmissionsMade: Map<string, number> = new Map();
    let platformWinnings: Map<string, number> = new Map();
    let platformViews: Map<string, number> = new Map();
    if (platform !== "all") {
      const platformValue = platform === "youtube" ? "youtube" : "instagram";

      // First, get all contest IDs for the specified platform
      const { data: platformContests, error: contestsError } = await supabase
        .from("contests")
        .select("id")
        .eq("platform", platformValue);

      if (!contestsError && platformContests && platformContests.length > 0) {
        const contestIds = platformContests.map((c) => c.id);

        // Get all contest wins for these contests
        const { data: contestWinsData, error: contestWinsError } =
          await supabase
            .from("creator_contest_wins")
            .select("creator_id")
            .in("contest_id", contestIds);

        if (!contestWinsError && contestWinsData) {
          contestWinsData.forEach((win: any) => {
            const creatorId = win.creator_id;
            const currentCount = platformContestWins.get(creatorId) || 0;
            platformContestWins.set(creatorId, currentCount + 1);
          });
        }

        // Get all submissions for these contests
        const { data: submissionsData, error: submissionsError } =
          await supabase
            .from("submissions")
            .select("creator_id, contest_id, status, earnings, views")
            .in("contest_id", contestIds);

        if (!submissionsError && submissionsData) {
          // Count distinct contests per creator for participations
          const creatorContestMap = new Map<string, Set<string>>();
          // Count submissions won (status = 'paid') per creator
          const creatorSubmissionsWonMap = new Map<string, number>();
          // Count total submissions made per creator
          const creatorSubmissionsMadeMap = new Map<string, number>();
          // Sum earnings from paid submissions per creator
          const creatorWinningsMap = new Map<string, number>();
          // Sum views per creator (platform-scoped since submissions filtered by contestIds)
          const creatorViewsMap = new Map<string, number>();

          submissionsData.forEach((sub: any) => {
            const creatorId = sub.creator_id;
            const contestId = sub.contest_id;
            const status = sub.status;
            const earnings = sub.earnings || 0;
            const views = sub.views || 0;

            // Count participations (distinct contests)
            if (!creatorContestMap.has(creatorId)) {
              creatorContestMap.set(creatorId, new Set());
            }
            creatorContestMap.get(creatorId)?.add(contestId);

            // Count submissions won (status = 'paid')
            if (status === "paid") {
              const currentWon = creatorSubmissionsWonMap.get(creatorId) || 0;
              creatorSubmissionsWonMap.set(creatorId, currentWon + 1);

              // Sum earnings from paid submissions (winnings)
              const currentWinnings = creatorWinningsMap.get(creatorId) || 0;
              creatorWinningsMap.set(creatorId, currentWinnings + earnings);
            }

            // Count total submissions made
            const currentMade = creatorSubmissionsMadeMap.get(creatorId) || 0;
            creatorSubmissionsMadeMap.set(creatorId, currentMade + 1);

            // Sum views per creator
            const currentViews = creatorViewsMap.get(creatorId) || 0;
            creatorViewsMap.set(creatorId, currentViews + views);
          });

          // Set participations (distinct contests)
          creatorContestMap.forEach((contestSet, creatorId) => {
            platformContestParticipations.set(creatorId, contestSet.size);
          });

          // Set submissions won
          creatorSubmissionsWonMap.forEach((count, creatorId) => {
            platformSubmissionsWon.set(creatorId, count);
          });

          // Set submissions made
          creatorSubmissionsMadeMap.forEach((count, creatorId) => {
            platformSubmissionsMade.set(creatorId, count);
          });

          // Set winnings (sum of earnings from paid submissions)
          creatorWinningsMap.forEach((total, creatorId) => {
            platformWinnings.set(creatorId, total);
          });

          // Set views (sum of submission views for contests on selected platform)
          creatorViewsMap.forEach((total, creatorId) => {
            platformViews.set(creatorId, total);
          });
        }
      }
    }

    // Always compute per-platform view totals per creator for accurate "Both" display
    const youtubeViewsMap: Map<string, number> = new Map();
    const instagramViewsMap: Map<string, number> = new Map();
    const { data: allSubs, error: allSubsError } = await supabase
      .from("submissions")
      .select("creator_id, platform, views");
    if (!allSubsError && allSubs) {
      allSubs.forEach((sub: any) => {
        const creatorId = sub.creator_id;
        const views = sub.views || 0;
        const plat = (sub.platform || "").toLowerCase();
        if (plat === "youtube") {
          const cur = youtubeViewsMap.get(creatorId) || 0;
          youtubeViewsMap.set(creatorId, cur + views);
        } else if (plat === "instagram") {
          const cur = instagramViewsMap.get(creatorId) || 0;
          instagramViewsMap.set(creatorId, cur + views);
        }
      });
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
          // Per-platform views derived from submissions
          const ytViews = youtubeViewsMap.get(creator.id) || 0;
          const igViews = instagramViewsMap.get(creator.id) || 0;
          // Platform-aware "verified views"
          let safeVerifiedViews = totalViews;
          if (platform === "youtube") {
            safeVerifiedViews = platformViews.get(creator.id) ?? ytViews;
          } else if (platform === "instagram") {
            safeVerifiedViews = platformViews.get(creator.id) ?? igViews;
          } else {
            const sumBoth = ytViews + igViews;
            safeVerifiedViews = sumBoth || totalViews;
          }

          // Money won can be either aggregated in profile or derived from transactions; prefer profile
          let totalWinnings = profile?.total_money_won || 0;

          // Calculate platform-specific winnings
          if (platform !== "all") {
            // Use platform-specific total when filter is applied
            // This ensures we only count winnings from contests on the selected platform
            totalWinnings = platformWinnings.get(creator.id) || 0;
          }

          // Submissions metrics sourced from creator_profiles
          let submissionsWon = profile?.total_submissions_won || 0;
          let submissionsMade = profile?.total_submissions_made || 0;

          // Calculate platform-specific submissions_won and submissions_made
          if (platform !== "all") {
            // Use platform-specific count when filter is applied
            // This ensures we only count submissions for the selected platform
            submissionsWon = platformSubmissionsWon.get(creator.id) || 0;
            submissionsMade = platformSubmissionsMade.get(creator.id) || 0;
          }

          // Prefer explicit profile counter if present; fallback to distinct contests from submissions
          let contestsParticipated = profile?.total_contests_participated || 0;
          // No fallback to live counting here to keep endpoint efficient and aligned with persisted metrics

          // Calculate platform-specific contests_participated
          if (platform !== "all") {
            // Use platform-specific count when filter is applied
            // This ensures we only count contests participated for the selected platform
            contestsParticipated =
              platformContestParticipations.get(creator.id) || 0;
          }

          const hasYouTube =
            profile?.youtube_account !== null &&
            profile?.youtube_account !== undefined;
          const hasInstagram =
            profile?.instagram_account !== null &&
            profile?.instagram_account !== undefined;

          // Calculate affiliate earnings from total_other_earnings in users table
          const affiliateEarnings = creator.total_other_earnings || 0;

          // Calculate platform-specific contests_won
          let contestsWon = profile?.total_contests_won || 0;
          if (platform !== "all") {
            // Use platform-specific count when filter is applied
            // This ensures we only count contests won for the selected platform
            contestsWon = platformContestWins.get(creator.id) || 0;
          }

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
              contests_won: contestsWon,
              verified_views: safeVerifiedViews,
              youtube_verified_views: ytViews,
              instagram_verified_views: igViews,
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

    // Count creators by platform (always calculate from all leaders, not filtered)
    const instagramCreatorsCount = leaders.filter(
      (entry) => entry.platforms.has_instagram
    ).length;
    const youtubeCreatorsCount = leaders.filter(
      (entry) => entry.platforms.has_youtube
    ).length;

    // Calculate summary statistics from filtered leaders
    const summary = {
      totalCreators: totalCreatorsCount,
      instagramCreators: instagramCreatorsCount,
      youtubeCreators: youtubeCreatorsCount,
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
