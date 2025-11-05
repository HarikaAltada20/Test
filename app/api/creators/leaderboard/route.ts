import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  leaderboardCache,
  adminLeaderboardCache,
  getLeaderboardCacheKey,
  getUsersCacheKey,
  getPlatformContestsCacheKey,
  getPlatformSubmissionsCacheKey,
} from "@/lib/cache-utils";

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
    const isAdmin = searchParams.get("admin") === "1";

    // Use appropriate cache instance based on admin status
    const cache = isAdmin ? adminLeaderboardCache : leaderboardCache;

    // Check cache for full response first (most efficient)
    const cacheKey = getLeaderboardCacheKey({
      sortBy,
      platform,
      page,
      limit,
      isAdmin,
    });
    const cachedResponse = cache.get<any>(cacheKey);
    if (cachedResponse) {
      // Return cached response with cached timestamp
      return NextResponse.json({
        ...cachedResponse,
        cached: true,
      });
    }

    // Check cache for users query (expensive operation)
    const usersCacheKey = getUsersCacheKey();
    let creators = cache.get<any[]>(usersCacheKey);

    if (!creators) {
      // Fetch all active users (creators and advertisers); include creator_profiles when present
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
        affiliate_earnings,
        other_earnings,
        user_type,
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
        .in("user_type", ["creator", "advertiser"]) // include both creators and advertisers
        .eq("is_active", true);

      const { data: fetchedCreators, error: creatorsError } = await usersQuery;

      if (creatorsError) {
        console.error("Error fetching creators:", creatorsError);
        return NextResponse.json(
          { error: "Failed to fetch creators" },
          { status: 500 }
        );
      }

      if (!fetchedCreators || fetchedCreators.length === 0) {
        return NextResponse.json({ leaders: [] });
      }

      creators = fetchedCreators;

      // Cache users data for 60 seconds (shared across all queries)
      cache.set(usersCacheKey, creators, 60000);
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

      // Check cache for platform-specific contest IDs
      const platformContestsCacheKey =
        getPlatformContestsCacheKey(platformValue);
      const cachedPlatformContests = cache.get<any>(platformContestsCacheKey);

      let contestIds: string[] = [];

      if (cachedPlatformContests?.contestIds) {
        contestIds = cachedPlatformContests.contestIds;
      } else {
        // First, get all contest IDs for the specified platform
        const { data: platformContests, error: contestsError } = await supabase
          .from("contests")
          .select("id")
          .eq("platform", platformValue);

        if (!contestsError && platformContests && platformContests.length > 0) {
          contestIds = platformContests.map((c) => c.id);
          // Cache contest IDs for 60 seconds
          cache.set(platformContestsCacheKey, { contestIds }, 60000);
        }
      }

      if (contestIds.length > 0) {
        // Check cache for platform-specific submissions data
        const platformSubmissionsCacheKey =
          getPlatformSubmissionsCacheKey(platformValue);
        const cachedPlatformData = cache.get<any>(platformSubmissionsCacheKey);

        if (cachedPlatformData) {
          platformContestWins = new Map(cachedPlatformData.contestWins);
          platformContestParticipations = new Map(
            cachedPlatformData.contestParticipations
          );
          platformSubmissionsWon = new Map(cachedPlatformData.submissionsWon);
          platformSubmissionsMade = new Map(cachedPlatformData.submissionsMade);
          platformWinnings = new Map(cachedPlatformData.winnings);
          platformViews = new Map(cachedPlatformData.views);
        } else {
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

          // Cache platform-specific data for 60 seconds
          cache.set(
            platformSubmissionsCacheKey,
            {
              contestWins: Array.from(platformContestWins.entries()),
              contestParticipations: Array.from(
                platformContestParticipations.entries()
              ),
              submissionsWon: Array.from(platformSubmissionsWon.entries()),
              submissionsMade: Array.from(platformSubmissionsMade.entries()),
              winnings: Array.from(platformWinnings.entries()),
              views: Array.from(platformViews.entries()),
            },
            60000
          );
        }
      }
    }

    // Process users to calculate metrics
    const leaders = await Promise.all(
      creators.map(async (creator: any) => {
        const profile = Array.isArray(creator.creator_profiles)
          ? creator.creator_profiles[0]
          : creator.creator_profiles;
        const isCreator = creator.user_type === "creator" && !!profile;

        // Prefer metrics persisted on creator_profiles to avoid heavy per-user queries
        const totalViews = isCreator ? profile?.total_views || 0 : 0;
        // Verified views should always reflect the profile's total_views without platform filtering
        const safeVerifiedViews = totalViews;

        // Money won can be either aggregated in profile or derived from transactions; prefer profile
        let totalWinnings = isCreator ? profile?.total_money_won || 0 : 0;

        // Calculate platform-specific winnings
        if (platform !== "all") {
          // Use platform-specific total when filter is applied
          // This ensures we only count winnings from contests on the selected platform
          totalWinnings = isCreator ? platformWinnings.get(creator.id) || 0 : 0;
        }

        // Submissions metrics sourced from creator_profiles
        let submissionsWon = isCreator
          ? profile?.total_submissions_won || 0
          : 0;
        let submissionsMade = isCreator
          ? profile?.total_submissions_made || 0
          : 0;

        // Calculate platform-specific submissions_won and submissions_made
        if (platform !== "all") {
          // Use platform-specific count when filter is applied
          // This ensures we only count submissions for the selected platform
          submissionsWon = isCreator
            ? platformSubmissionsWon.get(creator.id) || 0
            : 0;
          submissionsMade = isCreator
            ? platformSubmissionsMade.get(creator.id) || 0
            : 0;
        }

        // Prefer explicit profile counter if present; fallback to distinct contests from submissions
        let contestsParticipated = isCreator
          ? profile?.total_contests_participated || 0
          : 0;
        // No fallback to live counting here to keep endpoint efficient and aligned with persisted metrics

        // Calculate platform-specific contests_participated
        if (platform !== "all") {
          // Use platform-specific count when filter is applied
          // This ensures we only count contests participated for the selected platform
          contestsParticipated = isCreator
            ? platformContestParticipations.get(creator.id) || 0
            : 0;
        }

        const hasYouTube = isCreator
          ? profile?.youtube_account !== null &&
            profile?.youtube_account !== undefined
          : false;
        const hasInstagram = isCreator
          ? profile?.instagram_account !== null &&
            profile?.instagram_account !== undefined
          : false;

        // Get affiliate_earnings and other_earnings directly from users table (separate fields)
        // These are NOT combined - they remain separate throughout
        const affiliateEarnings = creator.affiliate_earnings || 0;
        const otherEarnings = creator.other_earnings || 0;

        // Calculate platform-specific contests_won
        let contestsWon = isCreator ? profile?.total_contests_won || 0 : 0;
        if (platform !== "all") {
          // Use platform-specific count when filter is applied
          // This ensures we only count contests won for the selected platform
          contestsWon = isCreator
            ? platformContestWins.get(creator.id) || 0
            : 0;
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
          is_creator: isCreator,
          metrics: {
            winnings: totalWinnings,
            // affiliate_earnings and other_earnings are separate fields from users table
            affiliate_earnings: affiliateEarnings,
            other_earnings: otherEarnings,
            contests_won: contestsWon,
            verified_views: safeVerifiedViews,
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
        : (platform === "all" ? leaders : leaders).filter((entry: any) => {
            // Only include creators when sorting by creator-specific metrics
            if (
              !(
                sortBy === "referrals" ||
                sortBy === "total_coins" ||
                sortBy === "affiliate_earnings"
              )
            ) {
              if (!entry.is_creator) return false;
            }
            if (platform === "all") return true;
            if (platform === "youtube") return entry.platforms.has_youtube;
            if (platform === "instagram") return entry.platforms.has_instagram;
            return true;
          });

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

      // Sort by combined affiliate_earnings + other_earnings
      if (sortBy === "affiliate_earnings") {
        const aTotal =
          (a.metrics.affiliate_earnings || 0) + (a.metrics.other_earnings || 0);
        const bTotal =
          (b.metrics.affiliate_earnings || 0) + (b.metrics.other_earnings || 0);
        return bTotal - aTotal;
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

    // Apply top-100 cap only for non-admin views
    const cappedLeaders = isAdmin ? sortedLeaders : sortedLeaders.slice(0, 100);

    // Prepare subsets for summary
    const creatorsAll = leaders.filter((e: any) => e.is_creator);

    // Count creators by platform (always calculate from all leaders, not filtered)
    const instagramCreatorsCount = leaders.filter(
      (entry: any) => entry.is_creator && entry.platforms.has_instagram
    ).length;
    const youtubeCreatorsCount = leaders.filter(
      (entry: any) => entry.is_creator && entry.platforms.has_youtube
    ).length;

    // Calculate summary statistics; creator-only metrics over creators, mixed over all filtered
    const summary = {
      // creators count should reflect only creators
      totalCreators: creatorsAll.length,
      instagramCreators: instagramCreatorsCount,
      youtubeCreators: youtubeCreatorsCount,
      // creator-only aggregates
      totalContestsWon: creatorsAll.reduce(
        (sum: number, entry: any) => sum + entry.metrics.contests_won,
        0
      ),
      totalSubmissionsWon: creatorsAll.reduce(
        (sum: number, entry: any) => sum + entry.metrics.submissions_won,
        0
      ),
      totalContestsParticipated: creatorsAll.reduce(
        (sum: number, entry: any) => sum + entry.metrics.contests_participated,
        0
      ),
      totalSubmissionsMade: creatorsAll.reduce(
        (sum: number, entry: any) => sum + entry.metrics.submissions_made,
        0
      ),
      // mixed metrics include both creators and advertisers
      totalReferrals: leaders.reduce(
        (sum, entry) => sum + entry.metrics.referrals,
        0
      ),
      totalAdvertisersReferred: leaders.reduce(
        (sum, entry) => sum + (entry.metrics.advertisers_referred || 0),
        0
      ),
      totalCreatorsReferred: leaders.reduce(
        (sum, entry) => sum + (entry.metrics.creators_referred || 0),
        0
      ),
    };

    // Calculate pagination
    const totalPages = Math.ceil(cappedLeaders.length / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLeaders = cappedLeaders.slice(startIndex, endIndex);

    // Cache the full response
    cache.set(
      cacheKey,
      {
        leaders: paginatedLeaders,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: cappedLeaders.length,
          itemsPerPage: limit,
        },
        summary,
        lastUpdated: new Date().toISOString(),
      },
      60000
    );

    return NextResponse.json({
      leaders: paginatedLeaders,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: cappedLeaders.length,
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
