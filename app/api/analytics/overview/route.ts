import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
    const submissionStatusRaw = searchParams.get("status");
    const submissionStatus = submissionStatusRaw?.trim().toLowerCase() || null;
    const notRejected = searchParams.get("notRejected") === "true";
    const contestTypeFilter = (searchParams.get("type") ?? "all")
      .trim()
      .toLowerCase() as "all" | "leaderboard" | "cpm";
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

    // 1. Fetch contests first to get IDs for filtering submissions
    let contests: any[] = [];
    const CHUNK_CONTEST = 1000;
    let contestRangeFrom = 0;
    while (true) {
      const { data: chunk, error: contestsError } = await supabase
        .from("contests")
        .select(
          `
          id,
          title,
          platform,
          contest_type,
          start_date,
          end_date,
          created_at,
          contest_based_details,
          live_submission_count,
          moderation_status
        `,
        )
        .eq("advertiser_id", user.id)
        .order("created_at", { ascending: false })
        .range(contestRangeFrom, contestRangeFrom + CHUNK_CONTEST - 1);

      if (contestsError) {
        console.error("Error fetching contests:", contestsError);
        return NextResponse.json(
          { error: "Failed to fetch contests" },
          { status: 500 },
        );
      }
      if (!chunk || chunk.length === 0) break;
      contests = contests.concat(chunk);
      if (chunk.length < CHUNK_CONTEST) break;
      contestRangeFrom += CHUNK_CONTEST;
    }

    const advertiserContestIds = contests?.map((c) => c.id) || [];

    // 2. Fetch submissions for these contests in chunks to avoid Supabase's 1000-row limit
    let allSubmissions: any[] = [];
    if (advertiserContestIds.length > 0) {
      const CHUNK = 1000;
      const CONTEST_ID_CHUNK = 200;
      for (let idFrom = 0; idFrom < advertiserContestIds.length; idFrom += CONTEST_ID_CHUNK) {
        const contestIdChunk = advertiserContestIds.slice(
          idFrom,
          idFrom + CONTEST_ID_CHUNK,
        );
        let rangeFrom = 0;
        while (true) {
          let query = supabase.from("submissions").select(`
            id,
            views,
            created_at,
            platform,
            creator_id,
            other_stats,
            status,
            contest_id
          `)
            .in("contest_id", contestIdChunk)
            .range(rangeFrom, rangeFrom + CHUNK - 1);

          // Apply status filter if provided
          if (notRejected) {
            query = query.neq("status", "rejected");
          } else if (submissionStatus && submissionStatus !== "all") {
            if (submissionStatus === "verifiedpaid") {
              query = query.in("status", ["verified", "paid"]);
            } else {
              query = query.eq("status", submissionStatus);
            }
          }

          const { data: chunk, error: submissionsError } = await query;
          if (submissionsError) {
            console.error("Error fetching submissions chunk:", submissionsError);
            return NextResponse.json(
              { error: "Failed to fetch submissions" },
              { status: 500 },
            );
          }
          if (!chunk || chunk.length === 0) break;
          allSubmissions = allSubmissions.concat(chunk);
          if (chunk.length < CHUNK) break;
          rangeFrom += CHUNK;
        }
      }
    }

    // Normalize platform key (used for Twitter/TikTok contest detection)
    const normalizePlatformKey = (contest: {
      platform?: string | null;
      contest_based_details?: unknown;
    }): string => {
      const raw = contest.platform;
      const p = (raw ?? "").toString().trim().toLowerCase();
      if (p === "x" || p === "twitter") return "twitter";
      if (p === "tiktok" || p === "tik_tok" || p === "tik-tok") return "tiktok";
      if (p === "youtube" || p === "instagram") return p;
      const details = contest.contest_based_details as
        | { twitter_campaign?: unknown }
        | null
        | undefined;
      if (details?.twitter_campaign != null) return "twitter";
      return p || "unknown";
    };

    // Attach filtered submissions to contests
    const contestsWithSubmissions =
      contests?.map((contest) => ({
        ...contest,
        submissions:
          allSubmissions?.filter((sub) => sub.contest_id === contest.id) || [],
      })) || [];

    if (!contestsWithSubmissions) {
      return NextResponse.json(
        { error: "Failed to fetch contests" },
        { status: 500 },
      );
    }

    const contestsFilteredByType =
      contestTypeFilter === "all"
        ? contestsWithSubmissions
        : contestsWithSubmissions.filter(
            (contest) =>
              (contest as { contest_type?: string }).contest_type ===
              contestTypeFilter,
          );

    // Platform filter: video (youtube/instagram/tiktok) and/or text_image (twitter); both => all selected
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
    const contestsFilteredByPlatform =
      allowedPlatforms.length === 0
        ? []
        : contestsFilteredByType.filter((c) =>
            allowedPlatforms.includes(normalizePlatformKey(c)),
          );

    const twitterContestIds = contestsFilteredByPlatform
      .filter((c) => normalizePlatformKey(c) === "twitter")
      .map((c) => c.id);

    // Twitter: count, views, likes, replies from twitter_campaign_tweets (per-tweet status + impressions)
    let twitterTweetCountByContest: Record<string, number> = {};
    let twitterViewsByContest: Record<string, number> = {};
    let twitterLikesByContest: Record<string, number> = {};
    let twitterRepliesByContest: Record<string, number> = {};
    let tweetsList: {
      contest_id?: string;
      impressions?: number;
      likes?: number;
      replies?: number;
      moderation_status?: string;
    }[] = [];
    if (twitterContestIds.length > 0) {
      let tweetsQuery = supabase
        .from("twitter_campaign_tweets")
        .select("contest_id, impressions, likes, replies, moderation_status")
        .in("contest_id", twitterContestIds);
      if (notRejected) {
        tweetsQuery = tweetsQuery.neq("moderation_status", "rejected");
      } else if (submissionStatus && submissionStatus !== "all") {
        if (submissionStatus === "verifiedpaid") {
          tweetsQuery = tweetsQuery.in("moderation_status", [
            "verified",
            "paid",
          ]);
        } else {
          tweetsQuery = tweetsQuery.eq("moderation_status", submissionStatus);
        }
      }
      const { data: twitterTweetsFiltered } = await tweetsQuery;
      tweetsList = twitterTweetsFiltered || [];
      twitterTweetCountByContest = tweetsList.reduce(
        (acc: Record<string, number>, row: { contest_id?: string }) => {
          const cid = row.contest_id;
          if (cid) acc[cid] = (acc[cid] || 0) + 1;
          return acc;
        },
        {},
      );
      twitterViewsByContest = tweetsList.reduce(
        (
          acc: Record<string, number>,
          row: { contest_id?: string; impressions?: number },
        ) => {
          const cid = row.contest_id;
          const imp = Number(row.impressions) || 0;
          if (cid) acc[cid] = (acc[cid] || 0) + imp;
          return acc;
        },
        {},
      );
      twitterLikesByContest = tweetsList.reduce(
        (
          acc: Record<string, number>,
          row: { contest_id?: string; likes?: number },
        ) => {
          const cid = row.contest_id;
          const likes = Number(row.likes) || 0;
          if (cid) acc[cid] = (acc[cid] || 0) + likes;
          return acc;
        },
        {},
      );
      twitterRepliesByContest = tweetsList.reduce(
        (
          acc: Record<string, number>,
          row: { contest_id?: string; replies?: number },
        ) => {
          const cid = row.contest_id;
          const replies = Number(row.replies) || 0;
          if (cid) acc[cid] = (acc[cid] || 0) + replies;
          return acc;
        },
        {},
      );
    }

    // Unfiltered submission and Twitter tweet counts for status breakdown (within filtered contests)
    const contestIdsAll = contestsFilteredByPlatform.map((c) => c.id);
    let allSubmissionsUnfiltered: any[] = [];
    if (contestIdsAll.length > 0) {
      const CHUNK = 1000;
      const CONTEST_ID_CHUNK = 200;
      for (let idFrom = 0; idFrom < contestIdsAll.length; idFrom += CONTEST_ID_CHUNK) {
        const contestIdChunk = contestIdsAll.slice(
          idFrom,
          idFrom + CONTEST_ID_CHUNK,
        );
        let rangeFrom = 0;
        while (true) {
          const { data: chunk, error: unfilteredError } = await supabase
            .from("submissions")
            .select("id, status, contest_id, other_stats")
            .in("contest_id", contestIdChunk)
            .range(rangeFrom, rangeFrom + CHUNK - 1);

          if (unfilteredError) {
            console.error("Error fetching unfiltered submissions:", unfilteredError);
            return NextResponse.json(
              { error: "Failed to fetch unfiltered submissions" },
              { status: 500 },
            );
          }
          if (!chunk || chunk.length === 0) break;
          allSubmissionsUnfiltered = allSubmissionsUnfiltered.concat(chunk);
          if (chunk.length < CHUNK) break;
          rangeFrom += CHUNK;
        }
      }
    }
    let twitterTweetsAll: {
      contest_id?: string;
      likes?: number;
      replies?: number;
      moderation_status?: string;
    }[] = [];
    if (twitterContestIds.length > 0) {
      const { data: allTweets } = await supabase
        .from("twitter_campaign_tweets")
        .select("contest_id, likes, replies, moderation_status")
        .in("contest_id", twitterContestIds);
      twitterTweetsAll = allTweets || [];
    }

    // Contest lifecycle from dates (UTC)
    const getContestLifecycle = (contest: {
      start_date?: string | null;
      end_date?: string | null;
    }): "upcoming" | "active" | "ended" | "incomplete" => {
      const start = contest.start_date
        ? new Date(contest.start_date).getTime()
        : null;
      const end = contest.end_date
        ? new Date(contest.end_date).getTime()
        : null;
      if (start == null || end == null) return "incomplete";
      const now = Date.now();
      if (now < start) return "upcoming";
      if (now >= end) return "ended";
      return "active";
    };

    // Extract likes/comments from submission other_stats (YouTube/Instagram/TikTok)
    const getSubmissionLikes = (sub: { other_stats?: unknown }): number => {
      const s = sub.other_stats as Record<string, unknown> | null | undefined;
      if (!s) return 0;
      const y = s.youtube as Record<string, unknown> | undefined;
      const i = s.instagram as Record<string, unknown> | undefined;
      const t = s.tiktok as Record<string, unknown> | undefined;
      return (
        Number(y?.likes ?? y?.like_count ?? 0) ||
        Number(i?.likes ?? i?.like_count ?? 0) ||
        Number(t?.likes ?? t?.like_count ?? 0) ||
        0
      );
    };
    const getSubmissionComments = (sub: { other_stats?: unknown }): number => {
      const s = sub.other_stats as Record<string, unknown> | null | undefined;
      if (!s) return 0;
      const y = s.youtube as Record<string, unknown> | undefined;
      const i = s.instagram as Record<string, unknown> | undefined;
      const t = s.tiktok as Record<string, unknown> | undefined;
      return (
        Number(y?.comments ?? y?.comment_count ?? 0) ||
        Number(i?.comments ?? i?.comment_count ?? 0) ||
        Number(t?.comments ?? t?.comment_count ?? 0) ||
        0
      );
    };

    // Per-contest submission count and views (non-Twitter from submissions; Twitter from twitter_* tables)
    const getContestSubmissionCount = (
      contest: { id: string; submissions?: unknown[] },
      platform: string,
    ) => {
      if (platform === "twitter")
        return twitterTweetCountByContest[contest.id] || 0;
      return contest.submissions?.length || 0;
    };
    const getContestViews = (
      contest: { id: string; submissions?: { views?: number }[] },
      platform: string,
    ) => {
      if (platform === "twitter") return twitterViewsByContest[contest.id] || 0;
      return (
        contest.submissions?.reduce(
          (sum: number, sub: { views?: number }) => sum + (sub.views || 0),
          0,
        ) || 0
      );
    };
    const getContestLikes = (
      contest: { id: string; submissions?: { other_stats?: unknown }[] },
      platform: string,
    ) => {
      if (platform === "twitter") return twitterLikesByContest[contest.id] || 0;
      return (
        contest.submissions?.reduce(
          (sum: number, sub) => sum + getSubmissionLikes(sub),
          0,
        ) || 0
      );
    };
    const getContestComments = (
      contest: { id: string; submissions?: { other_stats?: unknown }[] },
      platform: string,
    ) => {
      if (platform === "twitter")
        return twitterRepliesByContest[contest.id] || 0;
      return (
        contest.submissions?.reduce(
          (sum: number, sub) => sum + getSubmissionComments(sub),
          0,
        ) || 0
      );
    };
    const getContestSpent = (contest: {
      contest_type?: string;
      contest_based_details?: any;
    }) => {
      const details = contest.contest_based_details;
      if (
        contest.contest_type === "leaderboard" &&
        details?.leaderboard_contest?.total_prize
      ) {
        return Number(details.leaderboard_contest.total_prize) || 0;
      }
      if (
        contest.contest_type === "cpm" &&
        details?.cpm_contest?.total_budget
      ) {
        return Number(details.cpm_contest.total_budget) || 0;
      }
      if (contest.contest_type === "milestone") {
        return (
          Number(details?.milestone_contest?.total_budget_cents) ||
          Number(details?.milestone_contest?.total_budget) ||
          0
        );
      }
      return 0;
    };

    // Calculate overview metrics (include Twitter from twitter_* tables)
    const totalContests = contestsFilteredByPlatform.length;
    let totalSubmissions = 0;
    let totalViews = 0;
    for (const contest of contestsFilteredByPlatform) {
      const platform = normalizePlatformKey(contest);
      totalSubmissions += getContestSubmissionCount(contest, platform);
      totalViews += getContestViews(contest, platform);
    }

    // Calculate total spent (include contest budget if it has submissions or Twitter tweets after filtering)
    const totalSpent = contestsFilteredByPlatform.reduce((sum, contest) => {
      const platform = normalizePlatformKey(contest);
      const hasActivity =
        platform === "twitter"
          ? (twitterTweetCountByContest[contest.id] || 0) > 0
          : (contest.submissions?.length || 0) > 0;
      if (hasActivity) {
        return sum + getContestSpent(contest);
      }
      return sum;
    }, 0);

    // Calculate additional metrics
    const avgCostPerView = totalViews > 0 ? totalSpent / totalViews : 0;
    const avgCostPerSubmission =
      totalSubmissions > 0 ? totalSpent / totalSubmissions : 0;
    const avgSubmissionsPerContest =
      totalContests > 0 ? totalSubmissions / totalContests : 0;

    // Contest status counts (filtered by platform)
    const modStatus = (c: { moderation_status?: string | null }) =>
      (c.moderation_status ?? "").toString().toLowerCase();
    const publishedContests = contestsFilteredByPlatform.filter(
      (c) => modStatus(c) === "published",
    ).length;
    const draftContests = contestsFilteredByPlatform.filter(
      (c) => modStatus(c) === "draft",
    ).length;
    const pendingApprovalContests = contestsFilteredByPlatform.filter(
      (c) => modStatus(c) === "pending_approval",
    ).length;
    const approvedContests = contestsFilteredByPlatform.filter(
      (c) => modStatus(c) === "approved",
    ).length;
    const rejectedContests = contestsFilteredByPlatform.filter(
      (c) => modStatus(c) === "rejected",
    ).length;
    const lifecycleCounts = { upcoming: 0, active: 0, ended: 0 };
    for (const c of contestsFilteredByPlatform) {
      if (modStatus(c) !== "published") continue;
      const life = getContestLifecycle(c);
      if (life === "upcoming") lifecycleCounts.upcoming++;
      else if (life === "active") lifecycleCounts.active++;
      else if (life === "ended") lifecycleCounts.ended++;
    }

    // Submission status counts: when status filter is active use filtered set; otherwise unfiltered breakdown
    let verifiedSubmissions = 0;
    let paidSubmissions = 0;
    let pendingSubmissions = 0;
    let rejectedSubmissions = 0;
    if (submissionStatus && submissionStatus !== "all") {
      // Use filtered submissions (contest.submissions) and filtered tweets (tweetsList)
      for (const contest of contestsFilteredByPlatform) {
        const platform = normalizePlatformKey(contest);
        if (platform === "twitter") continue;
        for (const sub of contest.submissions || []) {
          const st = (sub as { status?: string }).status ?? "";
          const stLower = st.toString().toLowerCase();
          if (stLower === "verified") verifiedSubmissions++;
          else if (stLower === "paid") paidSubmissions++;
          else if (stLower === "pending") pendingSubmissions++;
          else if (stLower === "rejected") rejectedSubmissions++;
        }
      }
      tweetsList.forEach((row: { moderation_status?: string }) => {
        const st = (row.moderation_status ?? "pending")
          .toString()
          .toLowerCase();
        if (st === "verified") verifiedSubmissions++;
        else if (st === "paid") paidSubmissions++;
        else if (st === "pending") pendingSubmissions++;
        else if (st === "rejected") rejectedSubmissions++;
      });
    } else {
      (allSubmissionsUnfiltered || []).forEach((s: { status?: string }) => {
        const st = (s.status ?? "").toString().toLowerCase();
        if (st === "verified") verifiedSubmissions++;
        else if (st === "paid") paidSubmissions++;
        else if (st === "pending") pendingSubmissions++;
        else if (st === "rejected") rejectedSubmissions++;
      });
      twitterTweetsAll.forEach((row) => {
        const st = (row.moderation_status ?? "pending")
          .toString()
          .toLowerCase();
        if (st === "verified") verifiedSubmissions++;
        else if (st === "paid") paidSubmissions++;
        else if (st === "pending") pendingSubmissions++;
        else if (st === "rejected") rejectedSubmissions++;
      });
    }

    // Total likes/comments (filtered: from current submission/tweet set)
    let totalLikes = 0;
    let totalComments = 0;
    for (const contest of contestsFilteredByPlatform) {
      const platform = normalizePlatformKey(contest);
      totalLikes += getContestLikes(contest, platform);
      totalComments += getContestComments(contest, platform);
    }

    // Platform breakdown: when a filter is active, "contests" = contests with ≥1 submission in that status
    type PlatformStat = {
      contests: number;
      submissions: number;
      views: number;
      spent: number;
      publishedContests: number;
      draftContests: number;
      activeContests: number;
      upcomingContests: number;
      endedContests: number;
      pendingApprovalContests: number;
      approvedContests: number;
      rejectedContests: number;
      verifiedSubmissions: number;
      paidSubmissions: number;
      pendingSubmissions: number;
      rejectedSubmissions: number;
      totalLikes: number;
      totalComments: number;
    };
    const platformStats = contestsFilteredByPlatform.reduce(
      (acc, contest) => {
        const platform = normalizePlatformKey(contest);
        const subCount = getContestSubmissionCount(contest, platform);
        const views = getContestViews(contest, platform);
        const likes = getContestLikes(contest, platform);
        const comments = getContestComments(contest, platform);
        const mod = modStatus(contest);
        const life = getContestLifecycle(contest);
        if (!acc[platform]) {
          acc[platform] = {
            contests: 0,
            submissions: 0,
            views: 0,
            spent: 0,
            publishedContests: 0,
            draftContests: 0,
            activeContests: 0,
            upcomingContests: 0,
            endedContests: 0,
            pendingApprovalContests: 0,
            approvedContests: 0,
            rejectedContests: 0,
            verifiedSubmissions: 0,
            paidSubmissions: 0,
            pendingSubmissions: 0,
            rejectedSubmissions: 0,
            totalLikes: 0,
            totalComments: 0,
          };
        }
        if (subCount > 0) acc[platform].contests++;
        acc[platform].submissions += subCount;
        acc[platform].views += views;
        acc[platform].totalLikes += likes;
        acc[platform].totalComments += comments;
        if (mod === "published") acc[platform].publishedContests++;
        else if (mod === "draft") acc[platform].draftContests++;
        else if (mod === "pending_approval")
          acc[platform].pendingApprovalContests++;
        else if (mod === "approved") acc[platform].approvedContests++;
        else if (mod === "rejected") acc[platform].rejectedContests++;
        if (mod === "published") {
          if (life === "upcoming") acc[platform].upcomingContests++;
          else if (life === "active") acc[platform].activeContests++;
          else if (life === "ended") acc[platform].endedContests++;
        }
        const hasActivity = subCount > 0;
        if (hasActivity) {
          acc[platform].spent += getContestSpent(contest);
        }
        return acc;
      },
      {} as Record<string, PlatformStat>,
    );
    // Per-platform submission status counts: use filtered set when status filter is active
    if (submissionStatus && submissionStatus !== "all") {
      for (const contest of contestsFilteredByPlatform) {
        const platform = normalizePlatformKey(contest);
        if (platform === "twitter") continue;
        if (!platformStats[platform]) continue;
        for (const sub of contest.submissions || []) {
          const st = (sub as { status?: string }).status ?? "";
          const stLower = st.toString().toLowerCase();
          if (stLower === "verified")
            platformStats[platform].verifiedSubmissions++;
          else if (stLower === "paid")
            platformStats[platform].paidSubmissions++;
          else if (stLower === "pending")
            platformStats[platform].pendingSubmissions++;
          else if (stLower === "rejected")
            platformStats[platform].rejectedSubmissions++;
        }
      }
      tweetsList.forEach(
        (row: { contest_id?: string; moderation_status?: string }) => {
          const cid = row.contest_id;
          const contest = contestsFilteredByPlatform.find((c) => c.id === cid);
          if (!contest || normalizePlatformKey(contest) !== "twitter") return;
          const st = (row.moderation_status ?? "pending")
            .toString()
            .toLowerCase();
          if (!platformStats.twitter) return;
          if (st === "verified") platformStats.twitter.verifiedSubmissions++;
          else if (st === "paid") platformStats.twitter.paidSubmissions++;
          else if (st === "pending") platformStats.twitter.pendingSubmissions++;
          else if (st === "rejected")
            platformStats.twitter.rejectedSubmissions++;
        },
      );
    } else {
      (allSubmissionsUnfiltered || []).forEach(
        (s: { status?: string; contest_id?: string }) => {
          const cid = s.contest_id;
          const contest = contestsFilteredByPlatform.find((c) => c.id === cid);
          if (!contest) return;
          const platform = normalizePlatformKey(contest);
          const st = (s.status ?? "").toString().toLowerCase();
          if (!platformStats[platform]) return;
          if (st === "verified") platformStats[platform].verifiedSubmissions++;
          else if (st === "paid") platformStats[platform].paidSubmissions++;
          else if (st === "pending")
            platformStats[platform].pendingSubmissions++;
          else if (st === "rejected")
            platformStats[platform].rejectedSubmissions++;
        },
      );
      twitterTweetsAll.forEach((row) => {
        const cid = row.contest_id;
        const contest = contestsFilteredByPlatform.find((c) => c.id === cid);
        if (!contest || normalizePlatformKey(contest) !== "twitter") return;
        const st = (row.moderation_status ?? "pending")
          .toString()
          .toLowerCase();
        if (!platformStats.twitter) return;
        if (st === "verified") platformStats.twitter.verifiedSubmissions++;
        else if (st === "paid") platformStats.twitter.paidSubmissions++;
        else if (st === "pending") platformStats.twitter.pendingSubmissions++;
        else if (st === "rejected") platformStats.twitter.rejectedSubmissions++;
      });
    }

    // Monthly trends (last 12 months); include Twitter from twitter_* tables
    const monthlyData = contestsFilteredByPlatform.reduce(
      (acc, contest) => {
        const month = new Date(contest.created_at).toISOString().slice(0, 7);
        const platform = normalizePlatformKey(contest);
        const subCount = getContestSubmissionCount(contest, platform);
        const views = getContestViews(contest, platform);
        if (!acc[month]) {
          acc[month] = { contests: 0, submissions: 0, views: 0, spent: 0 };
        }
        if (subCount > 0) {
          acc[month].contests++;
          acc[month].submissions += subCount;
          acc[month].views += views;
          acc[month].spent += getContestSpent(contest);
        }
        return acc;
      },
      {} as Record<
        string,
        { contests: number; submissions: number; views: number; spent: number }
      >,
    );

    // Find top performing contest (include Twitter views from leaderboard)
    const topContest = contestsFilteredByPlatform.reduce((top, contest) => {
      const platform = normalizePlatformKey(contest);
      const contestViews = getContestViews(contest, platform);
      const topViews = top
        ? getContestViews(top, normalizePlatformKey(top))
        : 0;
      return contestViews > topViews ? contest : top;
    }, contestsFilteredByPlatform[0] || null);

    // Contest type breakdown; include Twitter from twitter_* tables
    const contestTypeStats = contestsFilteredByPlatform.reduce(
      (acc, contest) => {
        const type = contest.contest_type || "unknown";
        const platform = normalizePlatformKey(contest);
        const subCount = getContestSubmissionCount(contest, platform);
        const views = getContestViews(contest, platform);
        if (!acc[type]) {
          acc[type] = { count: 0, submissions: 0, views: 0, spent: 0 };
        }
        if (subCount > 0) {
          acc[type].count++;
          acc[type].submissions += subCount;
          acc[type].views += views;
          acc[type].spent += getContestSpent(contest);
        }
        return acc;
      },
      {} as Record<
        string,
        { count: number; submissions: number; views: number; spent: number }
      >,
    );

    const response = {
      overview: {
        totalContests,
        totalSubmissions,
        totalViews,
        totalSpent,
        avgCostPerView: Math.round(avgCostPerView * 100) / 100, // Round to 2 decimal places
        avgCostPerSubmission: Math.round(avgCostPerSubmission * 100) / 100,
        avgSubmissionsPerContest:
          Math.round(avgSubmissionsPerContest * 100) / 100,
        publishedContests,
        draftContests,
        activeContests: lifecycleCounts.active,
        upcomingContests: lifecycleCounts.upcoming,
        endedContests: lifecycleCounts.ended,
        pendingApprovalContests,
        approvedContests,
        rejectedContests,
        verifiedSubmissions,
        paidSubmissions,
        pendingSubmissions,
        rejectedSubmissions,
        totalLikes,
        totalComments,
        topContest: topContest
          ? {
              id: topContest.id,
              title: topContest.title,
              views: getContestViews(
                topContest,
                normalizePlatformKey(topContest),
              ),
              submissions:
                normalizePlatformKey(topContest) === "twitter"
                  ? (twitterTweetCountByContest[topContest.id] ??
                    topContest.live_submission_count ??
                    0)
                  : (topContest.live_submission_count ??
                    topContest.submissions?.length ??
                    0),
            }
          : null,
      },
      platformStats,
      monthlyData,
      contestTypeStats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Analytics overview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
