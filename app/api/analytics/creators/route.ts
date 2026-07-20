import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  parseBrandAnalyticsDateRange,
  parseBrandContestIdSet,
  parseBrandContestTypeSet,
  parseBrandAnalyticsSource,
  validateBrandAnalyticsDateRange,
} from "@/lib/brand-analytics-query";
import {
  attachCreatorsToSubmissionRows,
  fetchBrandPcSubmissionsAsAnalyticsRows,
} from "@/lib/brand-analytics-pc-submissions";
import { fetchBrandTotalPayoutsCents } from "@/lib/brand-analytics-payouts";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const submissionStatus = searchParams.get("status");
    const notRejected = searchParams.get("notRejected") === "true";
    const creatorId = searchParams.get("creatorId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const contestTypeSet = parseBrandContestTypeSet(searchParams);
    const contestIdSet = parseBrandContestIdSet(searchParams);
    const dateRange = parseBrandAnalyticsDateRange(searchParams);
    const dateValidation = validateBrandAnalyticsDateRange(dateRange);
    if (!dateValidation.ok) {
      return NextResponse.json({ error: dateValidation.error }, { status: 400 });
    }
    const { from: dateFrom, to: dateTo } = dateRange;
    const contentType = (searchParams.get("contentType") ?? "video")
      .trim()
      .toLowerCase() as "video" | "text_image";
    const videoPlatform = (searchParams.get("videoPlatform") ?? "all")
      .trim()
      .toLowerCase();
    const tiktokParam = searchParams.get("tiktok");
    const tiktokAnalytics = tiktokParam === "true" || tiktokParam === "1";
    const twitterParam = searchParams.get("twitter");
    const twitterAnalytics = twitterParam === "true" || twitterParam === "1";

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
        .select(
          `
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
        `,
        )
        .eq("id", creatorId)
        .single();

      if (!creator) {
        return NextResponse.json(
          { error: "Creator not found" },
          { status: 404 },
        );
      }

      // Get contest IDs for this advertiser (optionally by contest type)
      let contestIdsForFilter: string[] | null = null;
      if (contestTypeSet && contestTypeSet.size > 0) {
        const { data: typeContests } = await supabase
          .from("contests")
          .select("id")
          .eq("advertiser_id", user.id)
          .in("contest_type", [...contestTypeSet]);
        contestIdsForFilter = (typeContests || []).map(
          (c: { id: string }) => c.id,
        );
        if (contestIdsForFilter.length === 0) {
          contestIdsForFilter = [];
        }
      }
      if (contestIdSet !== null) {
        if (contestIdSet.size === 0) {
          contestIdsForFilter = [];
        } else if (contestIdsForFilter) {
          contestIdsForFilter = contestIdsForFilter.filter((id) =>
            contestIdSet.has(id),
          );
        } else {
          contestIdsForFilter = [...contestIdSet];
        }
      }

      // Get creator's submissions for this advertiser's contests (paginated to bypass row cap)
      const CREATOR_PAGE_SIZE = 1000;
      const submissionsAll: any[] = [];

      // Build base filters to apply per page
      const applyCreatorFilters = (q: any) => {
        let query = q
          .eq("creator_id", creatorId)
          .eq("contests.advertiser_id", user.id);
        if (contestIdsForFilter && contestIdsForFilter.length > 0) {
          query = query.in("contest_id", contestIdsForFilter);
        } else if (contestTypeSet && contestTypeSet.size > 0) {
          query = query.in("contest_id", []);
        }
        if (notRejected) {
          query = query.neq("status", "rejected");
        } else if (submissionStatus && submissionStatus !== "all") {
          if (submissionStatus === "verifiedPaid") {
            query = query.in("status", ["verified", "paid"]);
          } else {
            query = query.eq("status", submissionStatus);
          }
        }
        return query;
      };

      for (let page = 0; ; page++) {
        const from = page * CREATOR_PAGE_SIZE;
        const to = from + CREATOR_PAGE_SIZE - 1;
        const baseQuery = supabase
          .from("submissions")
          .select(
            `
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
        `,
          )
          .range(from, to)
          .order("created_at", { ascending: false });
        const { data: pageData, error: pageErr } =
          await applyCreatorFilters(baseQuery);
        if (pageErr) break;
        if (pageData && pageData.length > 0) submissionsAll.push(...pageData);
        if (!pageData || pageData.length < CREATOR_PAGE_SIZE) break;
      }
      const submissions = submissionsAll;

      // Calculate creator-specific metrics for this advertiser
      const totalSubmissions = submissions.length;
      const totalViews = submissions.reduce(
        (sum, sub) => sum + (sub.views || 0),
        0,
      );
      const totalEarnings = submissions.reduce(
        (sum, sub) => sum + (sub.earnings || 0),
        0,
      );
      const avgViewsPerSubmission =
        totalSubmissions > 0 ? totalViews / totalSubmissions : 0;

      // Platform breakdown
      const platformStats = submissions.reduce(
        (acc, sub) => {
          const platform = sub.platform || "unknown";
          if (!acc[platform]) {
            acc[platform] = { submissions: 0, views: 0, earnings: 0 };
          }
          acc[platform].submissions++;
          acc[platform].views += sub.views || 0;
          acc[platform].earnings += sub.earnings || 0;
          return acc;
        },
        {} as Record<
          string,
          { submissions: number; views: number; earnings: number }
        >,
      );

      // Contest type breakdown
      const contestTypeStats = submissions.reduce(
        (acc, sub) => {
          const contestType = (sub.contests as any).contest_type || "unknown";
          if (!acc[contestType]) {
            acc[contestType] = { submissions: 0, views: 0, earnings: 0 };
          }
          acc[contestType].submissions++;
          acc[contestType].views += sub.views || 0;
          acc[contestType].earnings += sub.earnings || 0;
          return acc;
        },
        {} as Record<
          string,
          { submissions: number; views: number; earnings: number }
        >,
      );

      // Performance timeline (monthly)
      const performanceTimeline = submissions.reduce(
        (acc, sub) => {
          const month = new Date(sub.created_at).toISOString().slice(0, 7); // YYYY-MM format
          if (!acc[month]) {
            acc[month] = { submissions: 0, views: 0, earnings: 0 };
          }
          acc[month].submissions++;
          acc[month].views += sub.views || 0;
          acc[month].earnings += sub.earnings || 0;
          return acc;
        },
        {} as Record<
          string,
          { submissions: number; views: number; earnings: number }
        >,
      );

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
            avgViewsPerSubmission:
              Math.round(avgViewsPerSubmission * 100) / 100,
          },
          platformStats,
          contestTypeStats,
          performanceTimeline,
          topSubmissions,
        },
      });
    } else {
      const statusNorm = submissionStatus?.trim().toLowerCase() || null;
      const source = parseBrandAnalyticsSource(searchParams);

      if (contestTypeSet !== null && contestTypeSet.size === 0) {
        return NextResponse.json({
          dataSource: source,
          leaderboards: {
            topByViews: [],
            topByViewsYoutubeInstagram: [],
            topByViewsTwitter: [],
            topBySubmissions: [],
            topByEarnings: [],
          },
          summary: {
            totalUniqueCreators: 0,
            totalSubmissions: 0,
            totalViews: 0,
            totalEarnings: 0,
            avgSubmissionsPerCreator: 0,
            avgViewsPerCreator: 0,
            avgEarningsPerCreator: 0,
          },
          demographics: {
            platformDemographics: {},
            contestTypePreferences: {},
          },
        });
      }

      // Get this advertiser's contests to find Twitter contest IDs and contest_type for preferences
      const { data: advertiserContests } = await supabase
        .from("contests")
        .select("id, platform, contest_based_details, contest_type")
        .eq("advertiser_id", user.id);
      const normalizePlatform = (c: any) => {
        const p = (c?.platform ?? "").toString().trim().toLowerCase();
        if (p === "x" || p === "twitter") return "twitter";
        if (p === "tiktok" || p === "tik_tok" || p === "tik-tok")
          return "tiktok";
        const d = c?.contest_based_details as
          | { twitter_campaign?: unknown }
          | undefined;
        if (d?.twitter_campaign != null) return "twitter";
        return p || "unknown";
      };
      const allowedPlatforms = ((): string[] => {
        const platforms: string[] = [];

        if (contentType === "video") {
          // Parse videoPlatform to determine which video platforms are selected
          if (videoPlatform === "all") {
            // "all" means all three video platforms selected
            platforms.push("youtube", "instagram", "tiktok");
          } else if (videoPlatform === "youtube_instagram") {
            platforms.push("youtube", "instagram");
          } else if (videoPlatform === "youtube_tiktok") {
            platforms.push("youtube", "tiktok");
          } else if (videoPlatform === "instagram_tiktok") {
            platforms.push("instagram", "tiktok");
          } else if (videoPlatform === "youtube") {
            platforms.push("youtube");
          } else if (videoPlatform === "instagram") {
            platforms.push("instagram");
          } else if (videoPlatform === "tiktok") {
            platforms.push("tiktok");
          } else {
            // Fallback: check individual flags
            platforms.push("youtube", "instagram");
            if (tiktokAnalytics) platforms.push("tiktok");
          }
        }

        // Add twitter if selected
        if (twitterAnalytics) {
          platforms.push("twitter");
        }

        // If no platforms selected, default to all
        if (platforms.length === 0) {
          return ["youtube", "instagram", "tiktok", "twitter"];
        }

        return platforms;
      })();
      let contestsFiltered = (advertiserContests || []).filter((c: any) =>
        allowedPlatforms.includes(normalizePlatform(c)),
      );
      if (contestTypeSet && contestTypeSet.size > 0) {
        contestsFiltered = contestsFiltered.filter((c: any) =>
          contestTypeSet.has((c.contest_type || "").toLowerCase()),
        );
      }
      if (contestIdSet !== null) {
        contestsFiltered = contestsFiltered.filter((c: any) =>
          contestIdSet.has(c.id),
        );
      }
      const videoContestIds = contestsFiltered
        .filter((c: any) => normalizePlatform(c) !== "twitter")
        .map((c: any) => c.id);
      const twitterContestIds =
        source === "pc_submissions"
          ? []
          : contestsFiltered
              .filter((c: any) => normalizePlatform(c) === "twitter")
              .map((c: any) => c.id);
      const twitterContestIdToType: Record<string, string> = {};
      contestsFiltered
        .filter((c: any) => normalizePlatform(c) === "twitter")
        .forEach((c: any) => {
          twitterContestIdToType[c.id] = c.contest_type || "unknown";
        });
      let twitterContestTypeCounts: Record<string, number> = {};

      // Get leaderboard of creators (paginated to bypass PostgREST row cap)
      const LIST_PAGE_SIZE = 1000;
      let submissionsRawAll: any[] = [];

      if (videoContestIds.length > 0) {
        if (source === "pc_submissions") {
          const pcRows = await fetchBrandPcSubmissionsAsAnalyticsRows(
            supabase,
            videoContestIds,
            {
              dateFrom,
              dateTo,
              notRejected,
              submissionStatus: statusNorm,
            },
          );
          submissionsRawAll = await attachCreatorsToSubmissionRows(
            supabase,
            pcRows,
          );
          const contestById = new Map(
            contestsFiltered.map((c: any) => [c.id, c]),
          );
          submissionsRawAll = submissionsRawAll.map((sub) => {
            const contest = contestById.get(sub.contest_id as string);
            return {
              ...sub,
              contests: contest
                ? {
                    id: contest.id,
                    advertiser_id: user.id,
                    title: contest.title,
                    contest_type: contest.contest_type,
                  }
                : null,
            };
          });
        } else {
        for (let page = 0; ; page++) {
          const from = page * LIST_PAGE_SIZE;
          const to = from + LIST_PAGE_SIZE - 1;
          let pageQuery = supabase
            .from("submissions")
            .select(
              `
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
        `,
            )
            .eq("contests.advertiser_id", user.id)
            .in("contest_id", videoContestIds)
            .gte("created_at", dateFrom.toISOString())
            .lte("created_at", dateTo.toISOString())
            .range(from, to)
            .order("created_at", { ascending: false });
          if (notRejected) {
            pageQuery = pageQuery.neq("status", "rejected");
          } else if (statusNorm && statusNorm !== "all") {
            if (statusNorm === "verifiedpaid") {
              pageQuery = pageQuery.in("status", ["verified", "paid"]);
            } else {
              pageQuery = pageQuery.eq("status", statusNorm);
            }
          }
          const { data: pageData } = await pageQuery;
          if (pageData && pageData.length > 0)
            submissionsRawAll.push(...pageData);
          if (!pageData || pageData.length < LIST_PAGE_SIZE) break;
        }
        }
      }
      const submissions = submissionsRawAll;

      // Twitter: aggregate by creator from twitter_campaign_tweets and leaderboard
      const twitterByCreator: Record<
        string,
        {
          totalSubmissions: number;
          totalViews: number;
          totalEarnings: number;
          firstSubmission: Date | null;
          lastSubmission: Date | null;
        }
      > = {};
      if (twitterContestIds.length > 0) {
        let tweetsQuery = supabase
          .from("twitter_campaign_tweets")
          .select("creator_id, contest_id, impressions, tweet_created_at")
          .in("contest_id", twitterContestIds)
          .gte("tweet_created_at", dateFrom.toISOString())
          .lte("tweet_created_at", dateTo.toISOString());
        if (notRejected) {
          tweetsQuery = tweetsQuery.neq("moderation_status", "rejected");
        } else if (statusNorm && statusNorm !== "all") {
          if (statusNorm === "verifiedpaid") {
            tweetsQuery = tweetsQuery.in("moderation_status", [
              "verified",
              "paid",
            ]);
          } else {
            tweetsQuery = tweetsQuery.eq("moderation_status", statusNorm);
          }
        }
        // ...existing code...
        const { data: tweets } = await tweetsQuery;
        (tweets || []).forEach((row: any) => {
          const cid = row.creator_id;
          const contestId = row.contest_id;
          if (contestId) {
            const typ = twitterContestIdToType[contestId] || "unknown";
            twitterContestTypeCounts[typ] =
              (twitterContestTypeCounts[typ] || 0) + 1;
          }
          if (!cid) return;
          if (!twitterByCreator[cid]) {
            twitterByCreator[cid] = {
              totalSubmissions: 0,
              totalViews: 0,
              totalEarnings: 0,
              firstSubmission: null,
              lastSubmission: null,
            };
          }
          twitterByCreator[cid].totalSubmissions += 1;
          twitterByCreator[cid].totalViews += Number(row.impressions) || 0;
          const d = row.tweet_created_at
            ? new Date(row.tweet_created_at)
            : null;
          if (d) {
            if (
              !twitterByCreator[cid].firstSubmission ||
              d < twitterByCreator[cid].firstSubmission!
            ) {
              twitterByCreator[cid].firstSubmission = d;
            }
            if (
              !twitterByCreator[cid].lastSubmission ||
              d > twitterByCreator[cid].lastSubmission!
            ) {
              twitterByCreator[cid].lastSubmission = d;
            }
          }
        });
        let lbQuery = supabase
          .from("twitter_campaign_leaderboard")
          .select("creator_id, earnings")
          .in("contest_id", twitterContestIds);
        if (statusNorm && statusNorm !== "all") {
          if (statusNorm === "verifiedpaid") {
            lbQuery = lbQuery.in("moderation_status", ["verified", "paid"]);
          } else {
            lbQuery = lbQuery.eq("moderation_status", statusNorm);
          }
        }
        const { data: leaderboard } = await lbQuery;
        (leaderboard || []).forEach((row: any) => {
          const cid = row.creator_id;
          if (!cid) return;
          if (!twitterByCreator[cid]) {
            twitterByCreator[cid] = {
              totalSubmissions: 0,
              totalViews: 0,
              totalEarnings: 0,
              firstSubmission: null,
              lastSubmission: null,
            };
          }
          twitterByCreator[cid].totalEarnings += Number(row.earnings) || 0;
        });
      }

      // Group by creator and calculate metrics (from submissions table)
      const creatorStats = submissions.reduce(
        (acc, sub) => {
          const creatorId = sub.creator_id;
          if (!acc[creatorId]) {
            acc[creatorId] = {
              creator: sub.creator,
              totalSubmissions: 0,
              totalViews: 0,
              totalEarnings: 0,
              viewsYoutubeInstagram: 0,
              viewsTwitter: 0,
              submissionsYoutubeInstagram: 0,
              submissionsYoutube: 0,
              submissionsInstagram: 0,
              submissionsTwitter: 0,
              platforms: new Set(),
              contestTypes: new Set(),
              firstSubmission: null,
              lastSubmission: null,
            };
          }

          acc[creatorId].totalSubmissions++;
          acc[creatorId].submissionsYoutubeInstagram =
            (acc[creatorId].submissionsYoutubeInstagram || 0) + 1;
          const plat = (sub.platform || "").toString().toLowerCase();
          if (plat === "youtube")
            acc[creatorId].submissionsYoutube =
              (acc[creatorId].submissionsYoutube || 0) + 1;
          if (plat === "instagram")
            acc[creatorId].submissionsInstagram =
              (acc[creatorId].submissionsInstagram || 0) + 1;
          const v = sub.views || 0;
          acc[creatorId].totalViews += v;
          acc[creatorId].viewsYoutubeInstagram += v;
          acc[creatorId].totalEarnings += sub.earnings || 0;
          if (sub.platform) acc[creatorId].platforms.add(sub.platform);
          if ((sub.contests as any).contest_type)
            acc[creatorId].contestTypes.add((sub.contests as any).contest_type);

          const submissionDate = new Date(sub.created_at);
          if (
            !acc[creatorId].firstSubmission ||
            submissionDate < acc[creatorId].firstSubmission
          ) {
            acc[creatorId].firstSubmission = submissionDate;
          }
          if (
            !acc[creatorId].lastSubmission ||
            submissionDate > acc[creatorId].lastSubmission
          ) {
            acc[creatorId].lastSubmission = submissionDate;
          }

          return acc;
        },
        {} as Record<string, any>,
      );

      // Merge Twitter data into creatorStats
      const twitterOnlyCreatorIds: string[] = [];
      for (const [creatorId, tw] of Object.entries(twitterByCreator)) {
        if (creatorStats[creatorId]) {
          creatorStats[creatorId].totalSubmissions += tw.totalSubmissions;
          creatorStats[creatorId].submissionsTwitter =
            (creatorStats[creatorId].submissionsTwitter || 0) +
            tw.totalSubmissions;
          creatorStats[creatorId].totalViews += tw.totalViews;
          creatorStats[creatorId].viewsTwitter =
            (creatorStats[creatorId].viewsTwitter || 0) + tw.totalViews;
          creatorStats[creatorId].totalEarnings += tw.totalEarnings;
          creatorStats[creatorId].platforms.add("twitter");
          if (
            tw.firstSubmission &&
            (!creatorStats[creatorId].firstSubmission ||
              tw.firstSubmission < creatorStats[creatorId].firstSubmission)
          ) {
            creatorStats[creatorId].firstSubmission = tw.firstSubmission;
          }
          if (
            tw.lastSubmission &&
            (!creatorStats[creatorId].lastSubmission ||
              tw.lastSubmission > creatorStats[creatorId].lastSubmission)
          ) {
            creatorStats[creatorId].lastSubmission = tw.lastSubmission;
          }
        } else {
          twitterOnlyCreatorIds.push(creatorId);
          creatorStats[creatorId] = {
            creator: null,
            totalSubmissions: tw.totalSubmissions,
            totalViews: tw.totalViews,
            totalEarnings: tw.totalEarnings,
            viewsYoutubeInstagram: 0,
            viewsTwitter: tw.totalViews,
            submissionsYoutubeInstagram: 0,
            submissionsYoutube: 0,
            submissionsInstagram: 0,
            submissionsTwitter: tw.totalSubmissions,
            platforms: new Set(["twitter"]),
            contestTypes: new Set(),
            firstSubmission: tw.firstSubmission,
            lastSubmission: tw.lastSubmission,
          };
        }
      }
      if (twitterOnlyCreatorIds.length > 0) {
        const { data: twitterCreators } = await supabase
          .from("users")
          .select(
            `
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
          `,
          )
          .in("id", twitterOnlyCreatorIds);
        (twitterCreators || []).forEach((u: any) => {
          if (creatorStats[u.id]) {
            creatorStats[u.id].creator = {
              ...u,
              creator_profiles: u.creator_profiles,
            };
          }
        });
      }

      // Convert to array and calculate additional metrics (filter out entries with no creator if needed)
      const creatorsLeaderboard = Object.values(creatorStats)
        .filter((c: any) => c.creator != null)
        .map((creator: any) => {
          const subYtIg = creator.submissionsYoutubeInstagram ?? 0;
          const subTw = creator.submissionsTwitter ?? 0;
          const subYt = creator.submissionsYoutube ?? 0;
          const subIg = creator.submissionsInstagram ?? 0;
          const vYtIg = creator.viewsYoutubeInstagram ?? 0;
          const vTw = creator.viewsTwitter ?? 0;
          return {
            ...creator,
            viewsYoutubeInstagram: vYtIg,
            viewsTwitter: vTw,
            submissionsYoutubeInstagram: subYtIg,
            submissionsYoutube: subYt,
            submissionsInstagram: subIg,
            submissionsTwitter: subTw,
            platforms: Array.from(creator.platforms),
            contestTypes: Array.from(creator.contestTypes),
            avgViewsPerSubmission:
              creator.totalSubmissions > 0
                ? creator.totalViews / creator.totalSubmissions
                : 0,
            avgViewsPerSubmissionYoutubeInstagram:
              subYtIg > 0 ? vYtIg / subYtIg : 0,
            avgViewsPerSubmissionTwitter: subTw > 0 ? vTw / subTw : 0,
            avgEarningsPerSubmission:
              creator.totalSubmissions > 0
                ? creator.totalEarnings / creator.totalSubmissions
                : 0,
            daysActive:
              creator.lastSubmission && creator.firstSubmission
                ? Math.ceil(
                    (creator.lastSubmission - creator.firstSubmission) /
                      (1000 * 60 * 60 * 24),
                  )
                : 0,
          };
        });

      // Sort by different criteria
      const topByViews = [...creatorsLeaderboard]
        .sort((a, b) => b.totalViews - a.totalViews)
        .slice(0, limit);

      const topByViewsYoutubeInstagram = [...creatorsLeaderboard]
        .filter((c) => (c.submissionsYoutubeInstagram ?? 0) > 0)
        .sort(
          (a, b) =>
            (b.viewsYoutubeInstagram ?? 0) - (a.viewsYoutubeInstagram ?? 0),
        )
        .slice(0, limit);

      const topByViewsTwitter = [...creatorsLeaderboard]
        .filter((c) => (c.submissionsTwitter ?? 0) > 0)
        .sort((a, b) => (b.viewsTwitter ?? 0) - (a.viewsTwitter ?? 0))
        .slice(0, limit);

      const topBySubmissions = [...creatorsLeaderboard]
        .sort((a, b) => b.totalSubmissions - a.totalSubmissions)
        .slice(0, limit);

      const topByEarnings = [...creatorsLeaderboard]
        .sort((a, b) => b.totalEarnings - a.totalEarnings)
        .slice(0, limit);

      // Calculate summary statistics (include Twitter)
      const totalUniqueCreators = creatorsLeaderboard.length;
      const twitterTotals = Object.values(twitterByCreator).reduce(
        (acc, tw) => ({
          submissions: acc.submissions + tw.totalSubmissions,
          views: acc.views + tw.totalViews,
          earnings: acc.earnings + tw.totalEarnings,
        }),
        { submissions: 0, views: 0, earnings: 0 },
      );
      const totalSubmissions = submissions.length + twitterTotals.submissions;
      const totalViews =
        submissions.reduce((sum, sub) => sum + (sub.views || 0), 0) +
        twitterTotals.views;
      const totalEarnings =
        submissions.reduce((sum, sub) => sum + (sub.earnings || 0), 0) +
        twitterTotals.earnings;

      let totalPayoutsCents = totalEarnings;
      try {
        totalPayoutsCents = await fetchBrandTotalPayoutsCents({
          supabase,
          videoContestIds,
          twitterContestIds,
          dateFrom,
          dateTo,
          isPc: source === "pc_submissions",
        });
      } catch (error) {
        console.error("Error computing creator summary payouts:", error);
      }

      // Platform demographics (include Twitter submission count)
      const platformDemographics = submissions.reduce(
        (acc, sub) => {
          const platform = sub.platform || "unknown";
          acc[platform] = (acc[platform] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      if (twitterTotals.submissions > 0) {
        platformDemographics["twitter"] =
          (platformDemographics["twitter"] || 0) + twitterTotals.submissions;
      }

      // Contest type preferences (video from submissions, Twitter from tweets)
      const contestTypePreferences = submissions.reduce(
        (acc, sub) => {
          const contestType = (sub.contests as any).contest_type || "unknown";
          acc[contestType] = (acc[contestType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      Object.entries(twitterContestTypeCounts).forEach(([typ, count]) => {
        contestTypePreferences[typ] =
          (contestTypePreferences[typ] || 0) + count;
      });

      return NextResponse.json({
        dataSource: source,
        leaderboards: {
          topByViews,
          topByViewsYoutubeInstagram,
          topByViewsTwitter,
          topBySubmissions,
          topByEarnings,
        },
        summary: {
          totalUniqueCreators,
          totalSubmissions,
          totalViews,
          totalEarnings,
          totalPayoutsCents,
          avgSubmissionsPerCreator:
            totalUniqueCreators > 0
              ? totalSubmissions / totalUniqueCreators
              : 0,
          avgViewsPerCreator:
            totalUniqueCreators > 0 ? totalViews / totalUniqueCreators : 0,
          avgEarningsPerCreator:
            totalUniqueCreators > 0 ? totalEarnings / totalUniqueCreators : 0,
          avgPayoutsPerCreator:
            totalUniqueCreators > 0
              ? totalPayoutsCents / 100 / totalUniqueCreators
              : 0,
        },
        demographics: {
          platformDemographics,
          contestTypePreferences,
        },
      });
    }
  } catch (error) {
    console.error("Analytics creators error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
