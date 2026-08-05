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
import {
  cachePlatformSubmissionMetrics,
  fetchPlatformSubmissionMetrics,
  loadPlatformSubmissionMetricsFromCache,
} from "@/lib/leaderboard-platform-metrics";

/** Chunk size for contest_id IN clauses to avoid backend/URL limits */
const CONTEST_IDS_CHUNK_SIZE = 200;
/** Page size for paginated twitter_campaign_leaderboard reads */
const LEADERBOARD_PAGE_SIZE = 1000;
/** Page size for twitter_campaign_participants and twitter_campaign_tweets */
const TWITTER_ACTIVITY_PAGE_SIZE = 1000;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const sortByRaw = searchParams.get("sortBy") || "winnings";
    const sortBy =
      sortByRaw === "affiliate_earnings" || sortByRaw === "other_earnings"
        ? "affiliate_and_other_earnings"
        : sortByRaw;
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
      // Fetch all active users (creators and advertisers); include creator_profiles when present.
      // Paginate: Supabase/PostgREST defaults to max 1000 rows per request without range().
      const USERS_PAGE = 1000;
      const usersSelect = `
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
          twitter_account,
          tiktok_account,
          total_money_won,
          total_contests_won,
          total_contests_participated,
          total_views,
          total_submissions_made,
          total_submissions_won
        )
      `;

      let fetchedCreators: any[] = [];
      let rangeFrom = 0;
      let creatorsError: { message: string } | null = null;

      while (true) {
        const { data: chunk, error } = await supabase
          .from("users")
          .select(usersSelect)
          .in("user_type", ["creator", "advertiser"]) // include both creators and advertisers
          .eq("is_active", true)
          .order("id", { ascending: true })
          .range(rangeFrom, rangeFrom + USERS_PAGE - 1);

        if (error) {
          creatorsError = error;
          break;
        }
        if (!chunk?.length) break;
        fetchedCreators = fetchedCreators.concat(chunk);
        if (chunk.length < USERS_PAGE) break;
        rangeFrom += USERS_PAGE;
      }

      if (creatorsError) {
        console.error("Error fetching creators:", creatorsError);
        return NextResponse.json(
          { error: "Failed to fetch creators" },
          { status: 500 },
        );
      }

      if (fetchedCreators.length === 0) {
        return NextResponse.json({ leaders: [] });
      }

      creators = fetchedCreators;

      // Cache users data for 10 minutes (shared across all queries)
      cache.set(usersCacheKey, creators, 600000);
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
      const platformValue = platform;
      const platformSubmissionsCacheKey =
        getPlatformSubmissionsCacheKey(platformValue);
      const cachedPlatformData = cache.get<any>(platformSubmissionsCacheKey);

      if (cachedPlatformData) {
        const metrics = loadPlatformSubmissionMetricsFromCache(cachedPlatformData);
        platformContestWins = metrics.contestWins;
        platformContestParticipations = metrics.contestParticipations;
        platformSubmissionsWon = metrics.submissionsWon;
        platformSubmissionsMade = metrics.submissionsMade;
        platformWinnings = metrics.winnings;
        platformViews = metrics.views;
      } else if (platformValue === "twitter") {
        const platformContestsCacheKey =
          getPlatformContestsCacheKey(platformValue);
        const cachedPlatformContests = cache.get<any>(platformContestsCacheKey);

        let contestIds: string[] = [];

        if (cachedPlatformContests?.contestIds) {
          contestIds = cachedPlatformContests.contestIds;
        } else {
          const { data: platformContests, error: contestsError } = await supabase
            .from("contests")
            .select("id")
            .eq("platform", platformValue);

          if (!contestsError && platformContests && platformContests.length > 0) {
            contestIds = platformContests.map((c) => c.id);
            cache.set(platformContestsCacheKey, { contestIds }, 600000);
          }
        }

        if (contestIds.length > 0) {
            // Twitter contests use twitter_campaign_leaderboard instead of submissions.
            // Fetch in chunks + paginated for scalability (avoids huge IN clauses and single large result sets).
            const creatorContestMap = new Map<string, Set<string>>();
            const creatorSubmissionsWonMap = new Map<string, number>();
            const creatorSubmissionsMadeMap = new Map<string, number>();
            const creatorWinningsMap = new Map<string, number>();
            const creatorViewsMap = new Map<string, number>();
            const creatorContestWinsMap = new Map<string, number>();
            const tweetCountByCreator = new Map<string, number>();
            const paidTweetCountByCreator = new Map<string, number>();
            let twitterError: Error | null = null;

            // Submissions made: chunk contest IDs and paginate twitter_campaign_participants
            for (
              let c = 0;
              c < contestIds.length;
              c += CONTEST_IDS_CHUNK_SIZE
            ) {
              const contestChunk = contestIds.slice(
                c,
                c + CONTEST_IDS_CHUNK_SIZE,
              );
              let participantOffset = 0;
              let participantRows: {
                creator_id: string;
                total_tweets_tracked: number | null;
              }[] = [];
              do {
                const { data: participantPage } = await supabase
                  .from("twitter_campaign_participants")
                  .select("creator_id, total_tweets_tracked")
                  .in("contest_id", contestChunk)
                  .range(
                    participantOffset,
                    participantOffset + TWITTER_ACTIVITY_PAGE_SIZE - 1,
                  );
                participantRows = participantPage || [];
                participantRows.forEach((r: any) => {
                  const cid = r.creator_id as string;
                  if (cid) {
                    const tracked = Number(r.total_tweets_tracked) || 0;
                    tweetCountByCreator.set(
                      cid,
                      (tweetCountByCreator.get(cid) || 0) + tracked,
                    );
                  }
                });
                participantOffset += TWITTER_ACTIVITY_PAGE_SIZE;
              } while (participantRows.length === TWITTER_ACTIVITY_PAGE_SIZE);
            }
            tweetCountByCreator.forEach((count, creatorId) => {
              creatorSubmissionsMadeMap.set(creatorId, count);
            });

            // Submissions won: chunk contest IDs and paginate twitter_campaign_tweets (moderation_status = 'paid')
            for (
              let c = 0;
              c < contestIds.length;
              c += CONTEST_IDS_CHUNK_SIZE
            ) {
              const contestChunk = contestIds.slice(
                c,
                c + CONTEST_IDS_CHUNK_SIZE,
              );
              let paidTweetOffset = 0;
              let paidTweetRows: { creator_id: string }[] = [];
              do {
                const { data: paidTweetPage } = await supabase
                  .from("twitter_campaign_tweets")
                  .select("creator_id")
                  .in("contest_id", contestChunk)
                  .eq("moderation_status", "paid")
                  .range(
                    paidTweetOffset,
                    paidTweetOffset + TWITTER_ACTIVITY_PAGE_SIZE - 1,
                  );
                paidTweetRows = paidTweetPage || [];
                paidTweetRows.forEach((r: any) => {
                  const cid = r.creator_id as string;
                  if (cid) {
                    paidTweetCountByCreator.set(
                      cid,
                      (paidTweetCountByCreator.get(cid) || 0) + 1,
                    );
                  }
                });
                paidTweetOffset += TWITTER_ACTIVITY_PAGE_SIZE;
              } while (paidTweetRows.length === TWITTER_ACTIVITY_PAGE_SIZE);
            }
            paidTweetCountByCreator.forEach((count, creatorId) => {
              creatorSubmissionsWonMap.set(creatorId, count);
            });

            // Leaderboard: chunk contest IDs and paginate twitter_campaign_leaderboard by id
            for (
              let c = 0;
              c < contestIds.length;
              c += CONTEST_IDS_CHUNK_SIZE
            ) {
              const contestChunk = contestIds.slice(
                c,
                c + CONTEST_IDS_CHUNK_SIZE,
              );
              let lbOffset = 0;
              let lbPage: any[] = [];
              do {
                const { data: lbPageData, error: lbError } = await supabase
                  .from("twitter_campaign_leaderboard")
                  .select(
                    "creator_id, contest_id, earnings, total_impressions, moderation_status, total_eligible_tweets",
                  )
                  .in("contest_id", contestChunk)
                  .order("id", { ascending: true })
                  .range(lbOffset, lbOffset + LEADERBOARD_PAGE_SIZE - 1);
                if (lbError) twitterError = lbError;
                lbPage = lbPageData || [];
                lbPage.forEach((row: any) => {
                  const creatorId = row.creator_id as string | null;
                  const contestId = row.contest_id as string | null;
                  if (!creatorId || !contestId) return;

                  const earnings = Number(row.earnings) || 0;
                  const impressions = Number(row.total_impressions) || 0;
                  const moderationStatus = (
                    (row.moderation_status || "pending") as string
                  ).toLowerCase();
                  const isPaid = moderationStatus === "paid";
                  const isWinner = isPaid;

                  if (moderationStatus !== "rejected") {
                    if (!creatorContestMap.has(creatorId)) {
                      creatorContestMap.set(creatorId, new Set());
                    }
                    creatorContestMap.get(creatorId)!.add(contestId);
                  }

                  if (isWinner) {
                    const currentContestWins =
                      creatorContestWinsMap.get(creatorId) || 0;
                    creatorContestWinsMap.set(
                      creatorId,
                      currentContestWins + 1,
                    );
                  }

                  const currentWinnings =
                    creatorWinningsMap.get(creatorId) || 0;
                  creatorWinningsMap.set(creatorId, currentWinnings + earnings);

                  const currentViews = creatorViewsMap.get(creatorId) || 0;
                  creatorViewsMap.set(creatorId, currentViews + impressions);
                });
                lbOffset += LEADERBOARD_PAGE_SIZE;
              } while (lbPage.length === LEADERBOARD_PAGE_SIZE);
            }

            if (!twitterError) {
              // Set participations (distinct contests)
              creatorContestMap.forEach((contestSet, creatorId) => {
                platformContestParticipations.set(creatorId, contestSet.size);
              });

              creatorSubmissionsWonMap.forEach((count, creatorId) => {
                platformSubmissionsWon.set(creatorId, count);
              });

              creatorSubmissionsMadeMap.forEach((count, creatorId) => {
                platformSubmissionsMade.set(creatorId, count);
              });

              creatorWinningsMap.forEach((total, creatorId) => {
                platformWinnings.set(creatorId, total);
              });

              creatorViewsMap.forEach((total, creatorId) => {
                platformViews.set(creatorId, total);
              });

              creatorContestWinsMap.forEach((count, creatorId) => {
                platformContestWins.set(creatorId, count);
              });
            }

          cache.set(
            platformSubmissionsCacheKey,
            cachePlatformSubmissionMetrics({
              contestWins: platformContestWins,
              contestParticipations: platformContestParticipations,
              submissionsWon: platformSubmissionsWon,
              submissionsMade: platformSubmissionsMade,
              winnings: platformWinnings,
              views: platformViews,
            }),
            600000,
          );
        }
      } else {
        const metrics = await fetchPlatformSubmissionMetrics(
          supabase,
          platformValue,
        );
        platformContestWins = metrics.contestWins;
        platformContestParticipations = metrics.contestParticipations;
        platformSubmissionsWon = metrics.submissionsWon;
        platformSubmissionsMade = metrics.submissionsMade;
        platformWinnings = metrics.winnings;
        platformViews = metrics.views;

        cache.set(
          platformSubmissionsCacheKey,
          cachePlatformSubmissionMetrics(metrics),
          600000,
        );
      }
    }

    // When showing "all" platforms, we still want Twitter contest participation,
    // submissions, and contest wins to be included in aggregate creator metrics,
    // since twitter submissions are stored separately from regular submissions.
    let twitterAllContestParticipations: Map<string, number> = new Map();
    let twitterAllSubmissionsMade: Map<string, number> = new Map();
    let twitterAllContestWins: Map<string, number> = new Map();
    let twitterAllSubmissionsWon: Map<string, number> = new Map();
    let twitterAllWinnings: Map<string, number> = new Map();

    if (platform === "all") {
      try {
        // Reuse the platform cache helpers with platformValue="twitter"
        const twitterPlatformValue = "twitter";
        const twitterContestsCacheKey =
          getPlatformContestsCacheKey(twitterPlatformValue);
        const cachedTwitterContests = cache.get<any>(twitterContestsCacheKey);

        let twitterContestIds: string[] = [];

        if (cachedTwitterContests?.contestIds) {
          twitterContestIds = cachedTwitterContests.contestIds;
        } else {
          const { data: twitterContests, error: twitterContestsError } =
            await supabase
              .from("contests")
              .select("id")
              .eq("platform", twitterPlatformValue);

          if (!twitterContestsError && twitterContests?.length) {
            twitterContestIds = twitterContests.map((c) => c.id);
            cache.set(
              twitterContestsCacheKey,
              { contestIds: twitterContestIds },
              600000,
            );
          }
        }

        if (twitterContestIds.length > 0) {
          const twitterSubmissionsCacheKey =
            getPlatformSubmissionsCacheKey(twitterPlatformValue);
          const cachedTwitterData = cache.get<any>(twitterSubmissionsCacheKey);

          if (
            cachedTwitterData?.submissionsMade &&
            cachedTwitterData.contestParticipations
          ) {
            twitterAllContestParticipations = new Map(
              cachedTwitterData.contestParticipations,
            );
            twitterAllSubmissionsMade = new Map(
              cachedTwitterData.submissionsMade,
            );
            if (cachedTwitterData.contestWins) {
              twitterAllContestWins = new Map(cachedTwitterData.contestWins);
            }
            if (cachedTwitterData.submissionsWon) {
              twitterAllSubmissionsWon = new Map(
                cachedTwitterData.submissionsWon,
              );
            }
            if (cachedTwitterData.winnings) {
              twitterAllWinnings = new Map(cachedTwitterData.winnings);
            }
          } else {
            // Scalable: chunk contest IDs and paginate leaderboard/participants/tweets (same as platform=twitter)
            const creatorContestMap = new Map<string, Set<string>>();
            const creatorSubmissionsMadeMap = new Map<string, number>();
            const creatorContestWinsMap = new Map<string, number>();
            const creatorSubmissionsWonMap = new Map<string, number>();
            const creatorWinningsMap = new Map<string, number>();
            let twitterAllError: Error | null = null;

            for (
              let c = 0;
              c < twitterContestIds.length;
              c += CONTEST_IDS_CHUNK_SIZE
            ) {
              const contestChunk = twitterContestIds.slice(
                c,
                c + CONTEST_IDS_CHUNK_SIZE,
              );
              let allParticipantOffset = 0;
              let allParticipantRows: {
                creator_id: string;
                total_tweets_tracked: number | null;
              }[] = [];
              do {
                const { data: allParticipantPage } = await supabase
                  .from("twitter_campaign_participants")
                  .select("creator_id, total_tweets_tracked")
                  .in("contest_id", contestChunk)
                  .range(
                    allParticipantOffset,
                    allParticipantOffset + TWITTER_ACTIVITY_PAGE_SIZE - 1,
                  );
                allParticipantRows = allParticipantPage || [];
                allParticipantRows.forEach((r: any) => {
                  const cid = r.creator_id as string;
                  if (cid) {
                    const tracked = Number(r.total_tweets_tracked) || 0;
                    creatorSubmissionsMadeMap.set(
                      cid,
                      (creatorSubmissionsMadeMap.get(cid) || 0) + tracked,
                    );
                  }
                });
                allParticipantOffset += TWITTER_ACTIVITY_PAGE_SIZE;
              } while (
                allParticipantRows.length === TWITTER_ACTIVITY_PAGE_SIZE
              );
            }

            for (
              let c = 0;
              c < twitterContestIds.length;
              c += CONTEST_IDS_CHUNK_SIZE
            ) {
              const contestChunk = twitterContestIds.slice(
                c,
                c + CONTEST_IDS_CHUNK_SIZE,
              );
              let paidAllTweetOffset = 0;
              let paidAllTweetRows: { creator_id: string }[] = [];
              do {
                const { data: paidAllTweetPage } = await supabase
                  .from("twitter_campaign_tweets")
                  .select("creator_id")
                  .in("contest_id", contestChunk)
                  .eq("moderation_status", "paid")
                  .range(
                    paidAllTweetOffset,
                    paidAllTweetOffset + TWITTER_ACTIVITY_PAGE_SIZE - 1,
                  );
                paidAllTweetRows = paidAllTweetPage || [];
                paidAllTweetRows.forEach((r: any) => {
                  const cid = r.creator_id as string;
                  if (cid) {
                    creatorSubmissionsWonMap.set(
                      cid,
                      (creatorSubmissionsWonMap.get(cid) || 0) + 1,
                    );
                  }
                });
                paidAllTweetOffset += TWITTER_ACTIVITY_PAGE_SIZE;
              } while (paidAllTweetRows.length === TWITTER_ACTIVITY_PAGE_SIZE);
            }

            for (
              let c = 0;
              c < twitterContestIds.length;
              c += CONTEST_IDS_CHUNK_SIZE
            ) {
              const contestChunk = twitterContestIds.slice(
                c,
                c + CONTEST_IDS_CHUNK_SIZE,
              );
              let lbOffset = 0;
              let lbPage: any[] = [];
              do {
                const { data: lbPageData, error: lbError } = await supabase
                  .from("twitter_campaign_leaderboard")
                  .select(
                    "creator_id, contest_id, total_eligible_tweets, moderation_status, earnings",
                  )
                  .in("contest_id", contestChunk)
                  .order("id", { ascending: true })
                  .range(lbOffset, lbOffset + LEADERBOARD_PAGE_SIZE - 1);
                if (lbError) twitterAllError = lbError;
                lbPage = lbPageData || [];
                lbPage.forEach((row: any) => {
                  const creatorId = row.creator_id as string | null;
                  const contestId = row.contest_id as string | null;
                  if (!creatorId || !contestId) return;

                  const moderationStatus = (
                    (row.moderation_status || "pending") as string
                  ).toLowerCase();
                  const isPaid = moderationStatus === "paid";
                  const earnings = Number(row.earnings) || 0;

                  if (moderationStatus !== "rejected") {
                    if (!creatorContestMap.has(creatorId)) {
                      creatorContestMap.set(creatorId, new Set());
                    }
                    creatorContestMap.get(creatorId)!.add(contestId);
                  }

                  if (isPaid) {
                    const currentContestWins =
                      creatorContestWinsMap.get(creatorId) || 0;
                    creatorContestWinsMap.set(
                      creatorId,
                      currentContestWins + 1,
                    );
                  }

                  const currentWinnings =
                    creatorWinningsMap.get(creatorId) || 0;
                  creatorWinningsMap.set(creatorId, currentWinnings + earnings);
                });
                lbOffset += LEADERBOARD_PAGE_SIZE;
              } while (lbPage.length === LEADERBOARD_PAGE_SIZE);
            }

            if (!twitterAllError) {
              creatorContestMap.forEach((contestSet, creatorId) => {
                twitterAllContestParticipations.set(creatorId, contestSet.size);
              });
              creatorSubmissionsMadeMap.forEach((count, creatorId) => {
                twitterAllSubmissionsMade.set(creatorId, count);
              });
              creatorContestWinsMap.forEach((count, creatorId) => {
                twitterAllContestWins.set(creatorId, count);
              });
              creatorSubmissionsWonMap.forEach((count, creatorId) => {
                twitterAllSubmissionsWon.set(creatorId, count);
              });
              creatorWinningsMap.forEach((total, creatorId) => {
                twitterAllWinnings.set(creatorId, total);
              });

              cache.set(
                twitterSubmissionsCacheKey,
                {
                  contestWins: Array.from(twitterAllContestWins.entries()),
                  contestParticipations: Array.from(
                    twitterAllContestParticipations.entries(),
                  ),
                  submissionsWon: Array.from(
                    twitterAllSubmissionsWon.entries(),
                  ),
                  submissionsMade: Array.from(
                    twitterAllSubmissionsMade.entries(),
                  ),
                  winnings: Array.from(twitterAllWinnings.entries()),
                  views: cachedTwitterData?.views || [],
                },
                600000,
              );
            }
          }
        }
      } catch (e) {
        console.error(
          "[creators/leaderboard] Failed to aggregate Twitter metrics for platform=all:",
          e,
        );
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

        // Calculate contests_won (creator-level total, possibly augmented later for Twitter)
        let contestsWon = isCreator ? profile?.total_contests_won || 0 : 0;
        if (platform !== "all") {
          // Use platform-specific count when filter is applied
          // This ensures we only count contests won for the selected platform
          contestsWon = isCreator
            ? platformContestWins.get(creator.id) || 0
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
        } else if (isCreator) {
          // When viewing "all", augment creator-level totals with Twitter
          // contest participation, submissions, contest wins, and winnings (separate tables).
          const twitterExtraContests =
            twitterAllContestParticipations.get(creator.id) || 0;
          const twitterExtraSubmissions =
            twitterAllSubmissionsMade.get(creator.id) || 0;
          const twitterExtraContestsWon =
            twitterAllContestWins.get(creator.id) || 0;
          const twitterExtraSubmissionsWon =
            twitterAllSubmissionsWon.get(creator.id) || 0;
          const twitterExtraWinnings = twitterAllWinnings.get(creator.id) || 0;

          contestsParticipated += twitterExtraContests;
          submissionsMade += twitterExtraSubmissions;
          contestsWon += twitterExtraContestsWon;
          submissionsWon += twitterExtraSubmissionsWon;
          totalWinnings += twitterExtraWinnings;
        }

        const hasYouTube = isCreator
          ? profile?.youtube_account !== null &&
            profile?.youtube_account !== undefined
          : false;
        const hasInstagram = isCreator
          ? profile?.instagram_account !== null &&
            profile?.instagram_account !== undefined
          : false;
        const hasTwitter = isCreator
          ? profile?.twitter_account !== null &&
            profile?.twitter_account !== undefined
          : false;
        const hasTiktok = isCreator
          ? profile?.tiktok_account !== null &&
            profile?.tiktok_account !== undefined
          : false;

        // Get affiliate_earnings and other_earnings directly from users table (separate fields)
        // These are NOT combined - they remain separate throughout
        const affiliateEarnings = creator.affiliate_earnings || 0;
        const otherEarnings = creator.other_earnings || 0;

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
          if (!accountDisplayName && hasTwitter) {
            const twAccount =
              typeof profile?.twitter_account === "string"
                ? JSON.parse(profile?.twitter_account as unknown as string)
                : profile?.twitter_account;
            accountDisplayName =
              twAccount?.username || twAccount?.name || null;
          }
          if (!accountDisplayName && hasTiktok) {
            const ttAccount =
              typeof profile?.tiktok_account === "string"
                ? JSON.parse(profile?.tiktok_account as unknown as string)
                : profile?.tiktok_account;
            accountDisplayName =
              ttAccount?.username || ttAccount?.display_name || null;
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
            has_twitter: hasTwitter,
            has_tiktok: hasTiktok,
          },
        };
      }),
    );

    // Filter by platform (skip for metrics that are not tied to a single platform)
    const shouldSkipPlatformFilter =
      sortBy === "referrals" ||
      sortBy === "total_coins" ||
      sortBy === "affiliate_and_other_earnings";

    const filteredLeaders = shouldSkipPlatformFilter
      ? leaders
      : leaders.filter((entry: any) => {
          // Only include creators when sorting by creator-specific metrics
          if (!shouldSkipPlatformFilter) {
            if (!entry.is_creator) return false;
          }

          if (platform === "all") return true;
          // Rank creators with activity on the selected platform (from submissions),
          // not merely those who have a linked social account.
          return (
            (entry.metrics.submissions_made || 0) > 0 ||
            (entry.metrics.winnings || 0) > 0 ||
            (entry.metrics.contests_participated || 0) > 0
          );
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

      if (sortBy === "affiliate_and_other_earnings") {
        const bSum =
          (b.metrics.affiliate_earnings || 0) + (b.metrics.other_earnings || 0);
        const aSum =
          (a.metrics.affiliate_earnings || 0) + (a.metrics.other_earnings || 0);
        return bSum - aSum;
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
      const aVal = Number(a.metrics[sortKey]) || 0;
      const bVal = Number(b.metrics[sortKey]) || 0;
      return bVal - aVal;
    });

    // Apply top-100 cap only for non-admin views
    const cappedLeaders = isAdmin ? sortedLeaders : sortedLeaders.slice(0, 100);

    // Prepare subsets for summary.
    // When a specific platform is selected, base summary on the filtered leaders
    // so totals (e.g. winnings, submissions won) reflect that platform only.
    const summarySource = platform === "all" ? leaders : filteredLeaders;
    const creatorsAll = summarySource.filter((e: any) => e.is_creator);

    // Count creators by platform (always calculate from all leaders, not filtered)
    const instagramCreatorsCount = leaders.filter(
      (entry: any) => entry.is_creator && entry.platforms.has_instagram,
    ).length;
    const youtubeCreatorsCount = leaders.filter(
      (entry: any) => entry.is_creator && entry.platforms.has_youtube,
    ).length;
    const twitterCreatorsCount = leaders.filter(
      (entry: any) => entry.is_creator && entry.platforms.has_twitter,
    ).length;
    const tiktokCreatorsCount = leaders.filter(
      (entry: any) => entry.is_creator && entry.platforms.has_tiktok,
    ).length;

    // Calculate summary statistics; creator-only metrics over creators, mixed metrics over summarySource
    const summary = {
      // creators count should reflect only creators
      totalCreators: creatorsAll.length,
      instagramCreators: instagramCreatorsCount,
      youtubeCreators: youtubeCreatorsCount,
      twitterCreators: twitterCreatorsCount,
      tiktokCreators: tiktokCreatorsCount,
      // creator-only aggregates
      totalContestsWon: creatorsAll.reduce(
        (sum: number, entry: any) => sum + entry.metrics.contests_won,
        0,
      ),
      totalSubmissionsWon: creatorsAll.reduce(
        (sum: number, entry: any) => sum + entry.metrics.submissions_won,
        0,
      ),
      totalContestsParticipated: creatorsAll.reduce(
        (sum: number, entry: any) => sum + entry.metrics.contests_participated,
        0,
      ),
      totalSubmissionsMade: creatorsAll.reduce(
        (sum: number, entry: any) => sum + entry.metrics.submissions_made,
        0,
      ),
      // mixed metrics include both creators and advertisers
      totalReferrals: summarySource.reduce(
        (sum, entry) => sum + entry.metrics.referrals,
        0,
      ),
      totalAdvertisersReferred: summarySource.reduce(
        (sum, entry) => sum + (entry.metrics.advertisers_referred || 0),
        0,
      ),
      totalCreatorsReferred: summarySource.reduce(
        (sum, entry) => sum + (entry.metrics.creators_referred || 0),
        0,
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
      600000,
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
      { status: 500 },
    );
  }
}
