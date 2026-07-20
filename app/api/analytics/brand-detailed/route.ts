import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";
import {
  parseBrandAnalyticsDateRange,
  parseBrandContestIdSet,
  parseBrandContestTypeSet,
  parseBrandAnalyticsSource,
  validateBrandAnalyticsDateRange,
} from "@/lib/brand-analytics-query";
import { fetchBrandPcSubmissionsAsAnalyticsRows } from "@/lib/brand-analytics-pc-submissions";

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
    const contestTypeSet = parseBrandContestTypeSet(searchParams);
    const contestIdSet = parseBrandContestIdSet(searchParams);
    const dateRange = parseBrandAnalyticsDateRange(searchParams);
    const dateValidation = validateBrandAnalyticsDateRange(dateRange);
    if (!dateValidation.ok) {
      return NextResponse.json({ error: dateValidation.error }, { status: 400 });
    }
    const { from: dateFrom, to: dateTo } = dateRange;
    const source = parseBrandAnalyticsSource(searchParams);
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

    // Get user type and verify advertiser access
    const { data: userData } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (userData?.user_type !== "advertiser") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Admin client to bypass RLS while still scoping strictly to this advertiser
    const supabaseAdmin = createAdminClient();

    // Fetch all contests for this brand
    const { data: allContests } = await supabaseAdmin
      .from("contests_with_status")
      .select(
        `
        id,
        advertiser_id,
        title,
        platform,
        contest_type,
        created_at,
        start_date,
        end_date,
        moderation_status,
        status,
        post_contest_status,
        payment_details,
        contest_based_details,
        live_submission_count
      `,
      )
      .eq("advertiser_id", user.id)
      .order("created_at", { ascending: false });

    // Fetch all submissions for this brand's contests using pagination
    // to bypass the default PostgREST row limit (100–1000 rows).
    // Use an inner join on contests to ensure RLS permits access for the advertiser.
    let allSubmissions: any[] = [];
    const PAGE_SIZE = 1000;
    let joinFetchError = false;
    let perContestFetched: Record<string, number> = {};
    const performPerContestFallback = async (contestsInput: any[]) => {
      const contestsWithCounts = (contestsInput || []).filter(
        (c: any) => c && c.id,
      );
      const fetched: Record<string, number> = {};
      const MAX_PER_CONTEST_FALLBACK = 50;
      const limited = contestsWithCounts.slice(0, MAX_PER_CONTEST_FALLBACK);
      for (const c of limited) {
        try {
          let perQuery = supabaseAdmin
            .from("submissions")
            .select("id,status,views,contest_id,created_at,platform,creator_id")
            .eq("contest_id", c.id)
            .gte("created_at", dateFrom.toISOString())
            .lte("created_at", dateTo.toISOString())
            .order("created_at", { ascending: false });
          if (submissionStatus && submissionStatus !== "all") {
            if (submissionStatus === "verifiedpaid") {
              perQuery = perQuery.in("status", ["verified", "paid"]);
            } else {
              perQuery = perQuery.eq("status", submissionStatus);
            }
          }
          const { data: subsByContest, error: perErr } = await perQuery;
          if (!perErr && subsByContest && subsByContest.length > 0) {
            allSubmissions.push(...(subsByContest as any[]));
            fetched[c.id as string] = subsByContest.length;
          } else if (perErr) {
            // swallow
          }
        } catch {}
      }
      return fetched;
    };

    if (source !== "pc_submissions") {
    for (let page = 0; ; page++) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let pageQuery = supabaseAdmin
        .from("submissions")
        .select(
          `
          id,
          views,
          likes,
          comments,
          shares,
          created_at,
          platform,
          creator_id,
          status,
          contest_id,
          contests!inner(advertiser_id)
        `,
        )
        .eq("contests.advertiser_id", user.id)
        .gte("created_at", dateFrom.toISOString())
        .lte("created_at", dateTo.toISOString())
        .range(from, to)
        .order("created_at", { ascending: false });

      if (notRejected) {
        pageQuery = pageQuery.neq("status", "rejected");
      } else if (submissionStatus && submissionStatus !== "all") {
        if (submissionStatus === "verifiedpaid") {
          pageQuery = pageQuery.in("status", ["verified", "paid"]);
        } else {
          pageQuery = pageQuery.eq("status", submissionStatus);
        }
      }

      const { data: pageData, error: pageErr } = await pageQuery;
      if (pageErr) {
        joinFetchError = true;
        break;
      }
      if (pageData && pageData.length > 0) {
        allSubmissions.push(...(pageData as any[]));
      }
      // If fewer rows than page size returned, we've reached the end
      if (!pageData || pageData.length < PAGE_SIZE) {
        break;
      }
    }
    // joinErr alias kept for fallback trigger below
    const joinErr = joinFetchError ? new Error("join fetch error") : null;

    // Fallback: if join returns no rows but contests exist, try explicit IN filter
    let subsSource: "join" | "fallback" = "join";
    if (allSubmissions.length === 0 && (allContests?.length || 0) > 0) {
      const contestIds = (allContests || []).map((c: any) => c.id);
      // Chunk the IN query to avoid overly long IN lists
      const CHUNK_SIZE = 200;
      const chunks: string[][] = [];
      for (let i = 0; i < contestIds.length; i += CHUNK_SIZE) {
        chunks.push(contestIds.slice(i, i + CHUNK_SIZE));
      }

      const aggregated: any[] = [];
      for (const ids of chunks) {
        // Paginate each chunk to avoid the PostgREST row cap
        for (let page = 0; ; page++) {
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;
          let chunkQuery = supabaseAdmin
            .from("submissions")
            .select(
              `
              id,
              views,
              likes,
              comments,
              shares,
              created_at,
              platform,
              creator_id,
              status,
              contest_id
            `,
            )
            .in("contest_id", ids)
            .gte("created_at", dateFrom.toISOString())
            .lte("created_at", dateTo.toISOString())
            .range(from, to)
            .order("created_at", { ascending: false });
          if (notRejected) {
            chunkQuery = chunkQuery.neq("status", "rejected");
          } else if (submissionStatus && submissionStatus !== "all") {
            if (submissionStatus === "verifiedpaid") {
              chunkQuery = chunkQuery.in("status", ["verified", "paid"]);
            } else {
              chunkQuery = chunkQuery.eq("status", submissionStatus);
            }
          }
          const { data: subsFallback } = await chunkQuery;
          if (subsFallback && subsFallback.length > 0) {
            aggregated.push(...subsFallback);
          }
          if (!subsFallback || subsFallback.length < PAGE_SIZE) {
            break;
          }
        }
      }

      allSubmissions = aggregated;
      subsSource = "fallback";
    }

    // Apply submission status filter to submissions (verified / paid / pending / rejected)
    if (notRejected) {
      allSubmissions =
        allSubmissions?.filter((sub: any) => {
          const status = (sub.status || "").toString().toLowerCase();
          return status !== "rejected";
        }) || [];
    } else if (submissionStatus && submissionStatus !== "all") {
      allSubmissions =
        allSubmissions?.filter((sub: any) => {
          const status = (sub.status || "").toString().toLowerCase();
          if (submissionStatus === "verifiedpaid") {
            return status === "verified" || status === "paid";
          }
          return status === submissionStatus;
        }) || [];
    }
    }

    // Apply contest type filter
    let contestsByType = (allContests || []).filter((c: any) =>
      contestTypeSet === null
        ? true
        : contestTypeSet.has((c.contest_type ?? "").toString().toLowerCase()),
    );
    if (contestIdSet !== null) {
      contestsByType = contestsByType.filter((c: any) => contestIdSet.has(c.id));
    }

    // If still no rows but counts indicate presence, do per-contest fallback now
    if (
      source !== "pc_submissions" &&
      allSubmissions.length === 0 &&
      (contestsByType?.length || 0) > 0
    ) {
      perContestFetched = await performPerContestFallback(
        contestsByType as any[],
      );
    }

    // Re-apply submission status filter after fallback (fallback fills allSubmissions without status filter)
    if (source !== "pc_submissions" && submissionStatus && submissionStatus !== "all") {
      allSubmissions =
        allSubmissions?.filter((sub: any) => {
          const status = (sub.status || "").toString().toLowerCase();
          if (submissionStatus === "verifiedpaid") {
            return status === "verified" || status === "paid";
          }
          return status === submissionStatus;
        }) || [];
    }

    // Normalize platform key (x -> twitter; tiktok variants; infer twitter from contest_based_details)
    const normalizePlatformKey = (c: any) => {
      const p = (c?.platform ?? "").toString().trim().toLowerCase();
      if (p === "x" || p === "twitter") return "twitter";
      if (p === "tiktok" || p === "tik_tok" || p === "tik-tok") return "tiktok";
      const details = c?.contest_based_details as
        | { twitter_campaign?: unknown }
        | undefined;
      if (details?.twitter_campaign != null) return "twitter";
      return p || "unknown";
    };

    // Apply platform filter (video + twitter both allowed => all selected)
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
    const contests =
      allowedPlatforms.length === 0
        ? []
        : contestsByType.filter((c: any) =>
            allowedPlatforms.includes(normalizePlatformKey(c)),
          );

    // Submissions only for platform-filtered contests
    const platformFilteredContestIds = new Set(contests.map((c: any) => c.id));

    if (source === "pc_submissions") {
      const videoContestIds = contests
        .filter((c: any) => normalizePlatformKey(c) !== "twitter")
        .map((c: any) => c.id);
      allSubmissions = await fetchBrandPcSubmissionsAsAnalyticsRows(
        supabaseAdmin,
        videoContestIds,
        {
          dateFrom,
          dateTo,
          notRejected,
          submissionStatus,
        },
      );
    }

    const allSubmissionsFiltered = (allSubmissions || []).filter((sub: any) =>
      platformFilteredContestIds.has(sub.contest_id),
    );

    // Attach submissions to contests
    const contestsWithSubmissions = contests.map((contest: any) => ({
      ...contest,
      submissions:
        allSubmissionsFiltered?.filter(
          (sub: any) => sub.contest_id === contest.id,
        ) || [],
    }));

    const twitterContestIds =
      source === "pc_submissions"
        ? []
        : contests
            .filter((c: any) => normalizePlatformKey(c) === "twitter")
            .map((c: any) => c.id);

    let twitterTotals = {
      submissions: 0,
      views: 0,
      likes: 0,
      replies: 0,
      retweets: 0,
      quote_reposts: 0,
      verified: 0,
      paid: 0,
      pending: 0,
      rejected: 0,
      verifiedViews: 0,
      paidViews: 0,
      pendingViews: 0,
      rejectedViews: 0,
      byContest: {} as Record<
        string,
        {
          submissions: number;
          views: number;
          likes: number;
          replies: number;
          retweets: number;
          quote_reposts: number;
        }
      >,
    };

    if (twitterContestIds.length > 0) {
      let tweetsQuery = supabaseAdmin
        .from("twitter_campaign_tweets")
        .select(
          "contest_id, impressions, likes, replies, retweets, quote_reposts, moderation_status, tweet_created_at",
        )
        .in("contest_id", twitterContestIds)
        .gte("tweet_created_at", dateFrom.toISOString())
        .lte("tweet_created_at", dateTo.toISOString());

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

      const { data: twitterTweets } = await tweetsQuery;

      const list = (twitterTweets as any[]) || [];
      list.forEach((row: any) => {
        const cid = row.contest_id;
        if (!cid) return;
        const imp = Number(row.impressions) || 0;
        const likes = Number(row.likes) || 0;
        const replies = Number(row.replies) || 0;
        const retweets = Number(row.retweets) || 0;
        const quoteReposts = Number(row.quote_reposts) || 0;
        const status = (row.moderation_status || "pending")
          .toString()
          .toLowerCase();

        twitterTotals.submissions += 1;
        twitterTotals.views += imp;
        twitterTotals.likes += likes;
        twitterTotals.replies += replies;
        twitterTotals.retweets += retweets;
        twitterTotals.quote_reposts += quoteReposts;

        if (status === "verified") {
          twitterTotals.verified += 1;
          twitterTotals.verifiedViews += imp;
        } else if (status === "paid") {
          twitterTotals.paid += 1;
          twitterTotals.paidViews += imp;
        } else if (status === "pending") {
          twitterTotals.pending += 1;
          twitterTotals.pendingViews += imp;
        } else if (status === "rejected") {
          twitterTotals.rejected += 1;
          twitterTotals.rejectedViews += imp;
        }

        if (!twitterTotals.byContest[cid]) {
          twitterTotals.byContest[cid] = {
            submissions: 0,
            views: 0,
            likes: 0,
            replies: 0,
            retweets: 0,
            quote_reposts: 0,
          };
        }
        twitterTotals.byContest[cid].submissions += 1;
        twitterTotals.byContest[cid].views += imp;
        twitterTotals.byContest[cid].likes += likes;
        twitterTotals.byContest[cid].replies += replies;
        twitterTotals.byContest[cid].retweets += retweets;
        twitterTotals.byContest[cid].quote_reposts += quoteReposts;
      });
    }

    // Calculate comprehensive metrics
    const totalContests = contests.length;
    const totalDraftContests = contests.filter(
      (c: any) => c.moderation_status === "draft",
    ).length;
    const totalPendingContests = contests.filter(
      (c: any) => c.moderation_status === "pending_approval",
    ).length;
    const totalApprovedContests = contests.filter(
      (c: any) => c.moderation_status === "approved",
    ).length;
    const totalPublishedContests = contests.filter(
      (c: any) => c.moderation_status === "published",
    ).length;
    const totalRejectedContests = contests.filter(
      (c: any) => c.moderation_status === "rejected",
    ).length;
    const totalActiveContests = contests.filter(
      (c: any) => c.moderation_status === "published" && c.status === "active",
    ).length;
    const totalUpcomingContests = contests.filter(
      (c: any) =>
        c.moderation_status === "published" && c.status === "upcoming",
    ).length;
    const totalEndedContests = contests.filter(
      (c: any) =>
        c.moderation_status === "published" &&
        c.status === "ended" &&
        c.post_contest_status !== "payouts_processed",
    ).length;
    const totalCompletedContests = contests.filter(
      (c: any) =>
        c.moderation_status === "published" &&
        c.status === "ended" &&
        c.post_contest_status === "payouts_processed",
    ).length;

    // Submission metrics (include Twitter tweets; use platform-filtered submissions)
    const totalSubmissions =
      (allSubmissionsFiltered?.length || 0) + twitterTotals.submissions;
    const verifiedSubmissions =
      (allSubmissionsFiltered?.filter((s: any) => s.status === "verified")
        .length || 0) + twitterTotals.verified;
    const paidSubmissions =
      (allSubmissionsFiltered?.filter((s: any) => s.status === "paid").length ||
        0) + twitterTotals.paid;
    const pendingSubmissions =
      (allSubmissionsFiltered?.filter((s: any) => s.status === "pending")
        .length || 0) + twitterTotals.pending;
    const rejectedSubmissions =
      (allSubmissionsFiltered?.filter((s: any) => s.status === "rejected")
        .length || 0) + twitterTotals.rejected;

    // View metrics (include Twitter impressions; use platform-filtered submissions)
    const totalViews =
      (allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) => sum + (sub.views || 0),
        0,
      ) || 0) + twitterTotals.views;
    const totalVerifiedViews =
      (allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "verified" ? sub.views || 0 : 0),
        0,
      ) || 0) + twitterTotals.verifiedViews;
    const totalPaidViews =
      (allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "paid" ? sub.views || 0 : 0),
        0,
      ) || 0) + twitterTotals.paidViews;
    const totalPendingViews =
      (allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "pending" ? sub.views || 0 : 0),
        0,
      ) || 0) + twitterTotals.pendingViews;
    const totalRejectedViews =
      (allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "rejected" ? sub.views || 0 : 0),
        0,
      ) || 0) + twitterTotals.rejectedViews;
    const totalExpectedViews =
      (allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) =>
          sum +
          (sub.status === "pending" ||
          sub.status === "verified" ||
          sub.status === "paid"
            ? sub.views || 0
            : 0),
        0,
      ) || 0) +
      twitterTotals.verifiedViews +
      twitterTotals.paidViews +
      twitterTotals.pendingViews;

    // View breakdown by status: YouTube/Instagram only (from platform-filtered submissions)
    const verifiedViewsYtIg =
      allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "verified" ? sub.views || 0 : 0),
        0,
      ) || 0;
    const paidViewsYtIg =
      allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "paid" ? sub.views || 0 : 0),
        0,
      ) || 0;
    const pendingViewsYtIg =
      allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "pending" ? sub.views || 0 : 0),
        0,
      ) || 0;
    const rejectedViewsYtIg =
      allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "rejected" ? sub.views || 0 : 0),
        0,
      ) || 0;
    const totalViewsYtIg =
      allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) => sum + (sub.views || 0),
        0,
      ) || 0;
    const expectedViewsYtIg =
      pendingViewsYtIg + verifiedViewsYtIg + paidViewsYtIg;

    const viewsByStatusYoutubeInstagram = {
      expected: expectedViewsYtIg,
      verified: verifiedViewsYtIg,
      pending: pendingViewsYtIg,
      rejected: rejectedViewsYtIg,
      paid: paidViewsYtIg,
      total: totalViewsYtIg,
    };

    const expectedViewsTwitter =
      twitterTotals.pendingViews +
      twitterTotals.verifiedViews +
      twitterTotals.paidViews;
    const viewsByStatusTwitter = {
      expected: expectedViewsTwitter,
      verified: twitterTotals.verifiedViews,
      pending: twitterTotals.pendingViews,
      rejected: twitterTotals.rejectedViews,
      paid: twitterTotals.paidViews,
      total: twitterTotals.views,
    };

    // Engagement metrics (include Twitter: replies->comments, retweets->shares; use platform-filtered submissions)
    const totalLikes =
      (allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) => sum + (sub.likes || 0),
        0,
      ) || 0) + twitterTotals.likes;
    const totalComments =
      (allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) => sum + (sub.comments || 0),
        0,
      ) || 0) + twitterTotals.replies;
    const totalShares =
      (allSubmissionsFiltered?.reduce(
        (sum: number, sub: any) => sum + (sub.shares || 0),
        0,
      ) || 0) + twitterTotals.retweets;

    // Financial metrics
    const parsePayment = (pd: any) => {
      if (!pd) return null;
      try {
        return typeof pd === "string" ? JSON.parse(pd) : pd;
      } catch {
        return pd;
      }
    };

    const totalMoneyPaid = contests.reduce((sum: number, c: any) => {
      const pd = parsePayment(c.payment_details);
      if (
        pd?.payment_status === "completed" &&
        typeof pd.total_amount_paid === "number"
      ) {
        return sum + pd.total_amount_paid;
      }
      return sum;
    }, 0);

    const totalProjectedSpent = contests.reduce((sum: number, c: any) => {
      const details = c?.contest_based_details || {};
      if (
        c.contest_type === "leaderboard" &&
        details?.leaderboard_contest?.total_prize
      ) {
        return sum + (details.leaderboard_contest.total_prize || 0);
      }
      if (c.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
        return sum + (details.cpm_contest.total_budget || 0);
      }
      if (c.contest_type === "milestone") {
        return sum + getPoolBudgetCentsFromDetails("milestone", details);
      }
      if (c.contest_type === "dual_rewards") {
        return sum + getPoolBudgetCentsFromDetails("dual_rewards", details);
      }
      return sum;
    }, 0);

    const moneyPaidUnpublished = contests.reduce((sum: number, c: any) => {
      const pd = parsePayment(c.payment_details);
      if (
        c.moderation_status !== "published" &&
        pd?.payment_status === "completed" &&
        typeof pd.total_amount_paid === "number"
      ) {
        return sum + pd.total_amount_paid;
      }
      return sum;
    }, 0);

    const moneyInDraftNotPaid = contests.reduce((sum: number, c: any) => {
      if (c.moderation_status !== "draft") return sum;
      const details = c?.contest_based_details || {};
      if (
        c.contest_type === "leaderboard" &&
        details?.leaderboard_contest?.total_prize
      ) {
        return sum + (details.leaderboard_contest.total_prize || 0);
      }
      if (c.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
        return sum + (details.cpm_contest.total_budget || 0);
      }
      if (c.contest_type === "milestone") {
        return sum + getPoolBudgetCentsFromDetails("milestone", details);
      }
      if (c.contest_type === "dual_rewards") {
        return sum + getPoolBudgetCentsFromDetails("dual_rewards", details);
      }
      return sum;
    }, 0);

    // Payment breakdown
    const paymentsBreakdown = contests.reduce(
      (acc: any, c: any) => {
        const pd = parsePayment(c.payment_details);
        if (pd?.payment_status === "completed") {
          const withCommission =
            typeof pd.total_amount_paid === "number" ? pd.total_amount_paid : 0;
          const commission =
            typeof pd.commission_amount === "number" ? pd.commission_amount : 0;
          let withoutCommission = 0;
          if (typeof pd.total_prize_pool === "number") {
            withoutCommission = pd.total_prize_pool;
          } else if (withCommission >= commission) {
            withoutCommission = withCommission - commission;
          }
          acc.withCommission += withCommission;
          acc.withoutCommission += withoutCommission;
          acc.commission += commission;
        }
        return acc;
      },
      { withCommission: 0, withoutCommission: 0, commission: 0 },
    );

    // Calculate performance metrics
    const avgCostPerView = totalViews > 0 ? totalMoneyPaid / totalViews : 0;
    const avgCostPerSubmission =
      totalSubmissions > 0 ? totalMoneyPaid / totalSubmissions : 0;
    const avgViewsPerSubmission =
      totalSubmissions > 0 ? totalViews / totalSubmissions : 0;
    const avgSubmissionsPerContest =
      totalContests > 0 ? totalSubmissions / totalContests : 0;
    const engagementRate =
      totalViews > 0
        ? ((totalLikes + totalComments + totalShares) / totalViews) * 100
        : 0;

    // Platform breakdown (include Twitter from twitter_campaign_tweets)
    const platformStats = contestsWithSubmissions.reduce(
      (acc: any, contest: any) => {
        const platform = normalizePlatformKey(contest);
        const key = platform === "x" ? "twitter" : platform;
        if (!acc[key]) {
          acc[key] = {
            contests: 0,
            submissions: 0,
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            quote_reposts: 0,
            spent: 0,
          };
        }

        if (platform === "twitter") {
          const tw = twitterTotals.byContest[contest.id];
          if (tw && tw.submissions > 0) {
            acc[key].contests++;
            acc[key].submissions += tw.submissions;
            acc[key].views += tw.views;
            acc[key].likes += tw.likes;
            acc[key].comments += tw.replies;
            acc[key].shares += tw.retweets;
            acc[key].quote_reposts =
              (acc[key].quote_reposts || 0) + tw.quote_reposts;
            const details = contest.contest_based_details;
            if (
              contest.contest_type === "leaderboard" &&
              details?.leaderboard_contest?.total_prize
            ) {
              acc[key].spent += details.leaderboard_contest.total_prize;
            } else if (
              contest.contest_type === "cpm" &&
              details?.cpm_contest?.total_budget
            ) {
              acc[key].spent += details.cpm_contest.total_budget;
          } else if (contest.contest_type === "milestone") {
            acc[key].spent += getPoolBudgetCentsFromDetails(
              "milestone",
              details,
            );
          } else if (contest.contest_type === "dual_rewards") {
            acc[key].spent += getPoolBudgetCentsFromDetails(
              "dual_rewards",
              details,
            );
            }
          }
        } else if (contest.submissions.length > 0) {
          acc[key].contests++;
          acc[key].submissions += contest.submissions.length;
          acc[key].views +=
            contest.submissions?.reduce(
              (sum: number, sub: any) => sum + (sub.views || 0),
              0,
            ) || 0;
          acc[key].likes +=
            contest.submissions?.reduce(
              (sum: number, sub: any) => sum + (sub.likes || 0),
              0,
            ) || 0;
          acc[key].comments +=
            contest.submissions?.reduce(
              (sum: number, sub: any) => sum + (sub.comments || 0),
              0,
            ) || 0;
          acc[key].shares +=
            contest.submissions?.reduce(
              (sum: number, sub: any) => sum + (sub.shares || 0),
              0,
            ) || 0;
          const details = contest.contest_based_details;
          let contestSpent = 0;
          if (
            contest.contest_type === "leaderboard" &&
            details?.leaderboard_contest?.total_prize
          ) {
            contestSpent = details.leaderboard_contest.total_prize;
          } else if (
            contest.contest_type === "cpm" &&
            details?.cpm_contest?.total_budget
          ) {
            contestSpent = details.cpm_contest.total_budget;
          } else if (contest.contest_type === "milestone") {
            contestSpent = getPoolBudgetCentsFromDetails("milestone", details);
          } else if (contest.contest_type === "dual_rewards") {
            contestSpent = getPoolBudgetCentsFromDetails(
              "dual_rewards",
              details,
            );
          }
          acc[key].spent += contestSpent;
        }
        return acc;
      },
      {},
    );

    // Contest type breakdown (include Twitter views from byContest)
    const contestTypeStats = contestsWithSubmissions.reduce(
      (acc: any, contest: any) => {
        const type = contest.contest_type || "unknown";
        if (!acc[type]) {
          acc[type] = { count: 0, submissions: 0, views: 0, spent: 0 };
        }
        const isTwitter = normalizePlatformKey(contest) === "twitter";
        const subCount = isTwitter
          ? twitterTotals.byContest[contest.id]?.submissions || 0
          : contest.submissions.length;
        const views = isTwitter
          ? twitterTotals.byContest[contest.id]?.views || 0
          : contest.submissions?.reduce(
              (sum: number, sub: any) => sum + (sub.views || 0),
              0,
            ) || 0;
        if (subCount > 0) {
          acc[type].count++;
          acc[type].submissions += subCount;
          acc[type].views += views;
          const details = contest.contest_based_details;
          if (
            contest.contest_type === "leaderboard" &&
            details?.leaderboard_contest?.total_prize
          ) {
            acc[type].spent += details.leaderboard_contest.total_prize;
          } else if (
            contest.contest_type === "cpm" &&
            details?.cpm_contest?.total_budget
          ) {
            acc[type].spent += details.cpm_contest.total_budget;
          } else if (contest.contest_type === "milestone") {
            acc[type].spent += getPoolBudgetCentsFromDetails(
              "milestone",
              details,
            );
          } else if (contest.contest_type === "dual_rewards") {
            acc[type].spent += getPoolBudgetCentsFromDetails(
              "dual_rewards",
              details,
            );
          }
        }
        return acc;
      },
      {},
    );

    // Find top performing contest (include Twitter impressions)
    const topContest = contestsWithSubmissions.reduce(
      (top: any, contest: any) => {
        const isTwitter = normalizePlatformKey(contest) === "twitter";
        const contestViews = isTwitter
          ? twitterTotals.byContest[contest.id]?.views || 0
          : contest.submissions?.reduce(
              (sum: number, sub: any) => sum + (sub.views || 0),
              0,
            ) || 0;
        const topViews = top
          ? normalizePlatformKey(top) === "twitter"
            ? twitterTotals.byContest[top.id]?.views || 0
            : top.submissions?.reduce(
                (sum: number, sub: any) => sum + (sub.views || 0),
                0,
              ) || 0
          : 0;
        return contestViews > topViews ? contest : top;
      },
      contestsWithSubmissions[0] || null,
    );

    // Recent contests (last 5) - include submissions for counts
    const recentContests = contestsWithSubmissions.slice(0, 5);

    const response: any = {
      dataSource: source,
      overview: {
        totalContests,
        totalDraftContests,
        totalPendingContests,
        totalApprovedContests,
        totalPublishedContests,
        totalRejectedContests,
        totalActiveContests,
        totalUpcomingContests,
        totalEndedContests,
        totalCompletedContests,
        totalSubmissions,
        verifiedSubmissions,
        paidSubmissions,
        pendingSubmissions,
        rejectedSubmissions,
        totalViews,
        totalVerifiedViews,
        totalPaidViews,
        totalPendingViews,
        totalRejectedViews,
        totalExpectedViews,
        viewsByStatusYoutubeInstagram,
        viewsByStatusTwitter,
        totalLikes,
        totalComments,
        totalShares,
        totalQuoteReposts: twitterTotals.quote_reposts,
        totalMoneyPaid,
        totalProjectedSpent,
        moneyPaidUnpublished,
        moneyInDraftNotPaid,
        paymentsBreakdown,
        avgCostPerView: Math.round(avgCostPerView * 100) / 100,
        avgCostPerSubmission: Math.round(avgCostPerSubmission * 100) / 100,
        avgViewsPerSubmission: Math.round(avgViewsPerSubmission * 100) / 100,
        avgSubmissionsPerContest:
          Math.round(avgSubmissionsPerContest * 100) / 100,
        engagementRate: Math.round(engagementRate * 100) / 100,
        topContest: topContest
          ? {
              id: topContest.id,
              title: topContest.title,
              views:
                normalizePlatformKey(topContest) === "twitter"
                  ? twitterTotals.byContest[topContest.id]?.views || 0
                  : topContest.submissions?.reduce(
                      (sum: number, sub: any) => sum + (sub.views || 0),
                      0,
                    ) || 0,
              submissions:
                normalizePlatformKey(topContest) === "twitter"
                  ? twitterTotals.byContest[topContest.id]?.submissions || 0
                  : topContest.submissions?.length || 0,
              platform: topContest.platform,
              contest_type: topContest.contest_type,
            }
          : null,
      },
      platformStats,
      contestTypeStats,
      recentContests: recentContests.map((contest: any) => {
        const isTwitter = normalizePlatformKey(contest) === "twitter";
        const submission_count = isTwitter
          ? twitterTotals.byContest[contest.id]?.submissions || 0
          : contest.submissions?.length || 0;
        return {
          id: contest.id,
          title: contest.title,
          platform: contest.platform,
          contest_type: contest.contest_type,
          moderation_status: contest.moderation_status,
          status: contest.status,
          created_at: contest.created_at,
          submission_count,
        };
      }),
      twitterStats: {
        submissions: twitterTotals.submissions,
        views: twitterTotals.views,
        likes: twitterTotals.likes,
        replies: twitterTotals.replies,
        retweets: twitterTotals.retweets,
        quote_reposts: twitterTotals.quote_reposts,
        verified: twitterTotals.verified,
        paid: twitterTotals.paid,
        pending: twitterTotals.pending,
        rejected: twitterTotals.rejected,
      },
    };

    // no debug payload/logging in production

    return NextResponse.json(response);
  } catch (error) {
    console.error("Brand detailed analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
