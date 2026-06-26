import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";
import {
  mapTwitterTweetsToBudgetSubmissions,
  resolveBudgetTileMetrics,
  type BudgetTileSubmission,
} from "@/lib/contest-budget-tile-metrics";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    const contestTypeFilter = (searchParams.get("type") ?? "all")
      .trim()
      .toLowerCase() as
      | "all"
      | "leaderboard"
      | "cpm"
      | "milestone"
      | "dual_rewards";
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

    if (contestId) {
      // Get detailed analytics for a specific contest
      // Fetch contest metadata first (without nested submissions to avoid row cap)
      const { data: contest } = await supabase
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
          brief_html
        `,
        )
        .eq("id", contestId)
        .eq("advertiser_id", user.id)
        .single();

      // Fetch submissions separately with pagination to bypass PostgREST row cap
      const SINGLE_PAGE_SIZE = 1000;
      const allContestSubs: any[] = [];
      for (let page = 0; ; page++) {
        const from = page * SINGLE_PAGE_SIZE;
        const to = from + SINGLE_PAGE_SIZE - 1;
        const { data: subPage, error: subPageErr } = await supabase
          .from("submissions")
          .select(
            `id, views, created_at, platform, creator_id, other_stats, status, earnings,
             creator:creator_id (username, creator_profiles (total_views, total_contests_participated, youtube_account, instagram_account))`,
          )
          .eq("contest_id", contestId)
          .range(from, to)
          .order("created_at", { ascending: false });
        if (subPageErr) break;
        if (subPage && subPage.length > 0) allContestSubs.push(...subPage);
        if (!subPage || subPage.length < SINGLE_PAGE_SIZE) break;
      }
      // Merge submissions back into contest object
      const resolvedContest = contest ? { ...contest, submissions: allContestSubs } : null;

      if (!resolvedContest) {
        return NextResponse.json(
          { error: "Contest not found" },
          { status: 404 },
        );
      }
      const contestData = resolvedContest;

      // Calculate contest-specific metrics
      const totalViews =
        contestData.submissions?.reduce((sum: number, sub: any) => sum + (sub.views || 0), 0) ||
        0;
      const totalSubmissions = contestData.submissions?.length || 0;

      let totalSpent = 0;
      const details = contestData.contest_based_details;
      if (
        contestData.contest_type === "leaderboard" &&
        (details as any)?.leaderboard_contest?.total_prize
      ) {
        totalSpent = (details as any).leaderboard_contest.total_prize;
      } else if (
        contestData.contest_type === "cpm" &&
        (details as any)?.cpm_contest?.total_budget
      ) {
        totalSpent = (details as any).cpm_contest.total_budget;
      } else if (contestData.contest_type === "milestone") {
        totalSpent = getPoolBudgetCentsFromDetails("milestone", details);
      } else if (contestData.contest_type === "dual_rewards") {
        totalSpent = getPoolBudgetCentsFromDetails("dual_rewards", details);
      }

      const avgViewsPerSubmission =
        totalSubmissions > 0 ? totalViews / totalSubmissions : 0;
      const costPerView = totalViews > 0 ? totalSpent / totalViews : 0;

      // Top performing submissions
      const topSubmissions =
        contestData.submissions
          ?.slice()
          .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
          .slice(0, 10) || [];

      // Submission timeline (daily submissions)
      const submissionTimeline =
        contestData.submissions?.reduce(
          (acc: Record<string, number>, sub: any) => {
            const date = new Date(sub.created_at).toISOString().split("T")[0];
            if (!acc[date]) {
              acc[date] = 0;
            }
            acc[date]++;
            return acc;
          },
          {} as Record<string, number>,
        ) || {};

      // Platform breakdown for this contest
      const platformBreakdown =
        contestData.submissions?.reduce(
          (acc: Record<string, { count: number; views: number }>, sub: any) => {
            const platform = sub.platform || "unknown";
            if (!acc[platform]) {
              acc[platform] = { count: 0, views: 0 };
            }
            acc[platform].count++;
            acc[platform].views += sub.views || 0;
            return acc;
          },
          {} as Record<string, { count: number; views: number }>,
        ) || {};

      // Creator participation stats
      const uniqueCreators = new Set(
        contestData.submissions?.map((sub: any) => sub.creator_id),
      ).size;
      const avgSubmissionsPerCreator =
        uniqueCreators > 0 ? totalSubmissions / uniqueCreators : 0;

      return NextResponse.json({
        contest: {
          ...contestData,
          metrics: {
            totalViews,
            totalSubmissions,
            totalSpent,
            avgViewsPerSubmission:
              Math.round(avgViewsPerSubmission * 100) / 100,
            costPerView: Math.round(costPerView * 100) / 100,
            uniqueCreators,
            avgSubmissionsPerCreator:
              Math.round(avgSubmissionsPerCreator * 100) / 100,
          },
          topSubmissions,
          submissionTimeline,
          platformBreakdown,
        },
      });
    } else {
      // Get list of all contests with basic metrics (include Twitter from twitter_campaign_tweets)
      const statusParam = searchParams.get("status");
      const submissionStatus = statusParam?.trim().toLowerCase() || null;
      const notRejected = searchParams.get("notRejected") === "true";

      const { data: contests } = await supabase
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
          post_contest_status,
          moderation_status,
          thumbnail_url,
          max_earnings_per_creator
        `,
        )
        .eq("advertiser_id", user.id)
        .order("created_at", { ascending: false });

      if (!contests) {
        return NextResponse.json(
          { error: "Failed to fetch contests" },
          { status: 500 },
        );
      }

      const contestsFilteredByType =
        contestTypeFilter === "all"
          ? contests
          : contests.filter(
              (contest) =>
                (contest as { contest_type?: string }).contest_type ===
                contestTypeFilter,
            );

      const normalizePlatformKey = (c: {
        platform?: string | null;
        contest_based_details?: unknown;
      }) => {
        const p = (c.platform ?? "").toString().trim().toLowerCase();
        if (p === "x" || p === "twitter") return "twitter";
        if (p === "tiktok" || p === "tik_tok" || p === "tik-tok")
          return "tiktok";
        const details = c.contest_based_details as
          | { twitter_campaign?: unknown }
          | null
          | undefined;
        if (details?.twitter_campaign != null) return "twitter";
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
      const contestsFiltered =
        allowedPlatforms.length === 0
          ? []
          : contestsFilteredByType.filter((c) =>
              allowedPlatforms.includes(normalizePlatformKey(c)),
            );

      // Fetch all submissions with pagination to bypass PostgREST default row cap
      const LIST_PAGE_SIZE = 1000;
      const allSubmissions: any[] = [];
      const contestIdsToFetch = contestsFiltered.map((c) => c.id);

      if (contestIdsToFetch.length > 0) {
        for (let page = 0; ; page++) {
          const from = page * LIST_PAGE_SIZE;
          const to = from + LIST_PAGE_SIZE - 1;
          let pageQuery = supabase
            .from("submissions")
            .select(
              "id, views, created_at, platform, contest_id, other_stats, status, creator_id, paid, earnings, bonus_paid, bonus_amount, paid_at",
            )
            .in("contest_id", contestIdsToFetch)
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
          const { data: pageData } = await pageQuery;
          if (pageData && pageData.length > 0) allSubmissions.push(...pageData);
          if (!pageData || pageData.length < LIST_PAGE_SIZE) break;
        }
      }

      const twitterContestIds = contestsFiltered
        .filter((c) => normalizePlatformKey(c) === "twitter")
        .map((c) => c.id);
      const twitterCountByContest: Record<string, number> = {};
      const twitterViewsByContest: Record<string, number> = {};
      const twitterLikesByContest: Record<string, number> = {};
      const twitterRepliesByContest: Record<string, number> = {};
      const twitterRetweetsByContest: Record<string, number> = {};
      const twitterQuoteRepostsByContest: Record<string, number> = {};
      const twitterTweetsByContest: Record<string, ReturnType<typeof mapTwitterTweetsToBudgetSubmissions>> = {};
      if (twitterContestIds.length > 0) {
        let tweetsQuery = supabase
          .from("twitter_campaign_tweets")
          .select(
            "id, contest_id, creator_id, tweet_created_at, created_at, moderation_status, points, manual_points_adjustment, earnings, impressions, likes, replies, retweets, quote_reposts, is_eligible, deleted_at",
          )
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
        const { data: tweets } = await tweetsQuery;
        const list = tweets || [];
        list.forEach(
          (row: {
            id?: string;
            contest_id?: string;
            creator_id?: string | null;
            tweet_created_at?: string | null;
            created_at?: string | null;
            moderation_status?: string | null;
            points?: number | null;
            manual_points_adjustment?: number | null;
            earnings?: number | null;
            impressions?: number;
            likes?: number;
            replies?: number;
            retweets?: number;
            quote_reposts?: number;
            is_eligible?: boolean | null;
            deleted_at?: string | null;
          }) => {
            const cid = row.contest_id;
            if (cid) {
              twitterCountByContest[cid] =
                (twitterCountByContest[cid] || 0) + 1;
              twitterViewsByContest[cid] =
                (twitterViewsByContest[cid] || 0) +
                (Number(row.impressions) || 0);
              twitterLikesByContest[cid] =
                (twitterLikesByContest[cid] || 0) + (Number(row.likes) || 0);
              twitterRepliesByContest[cid] =
                (twitterRepliesByContest[cid] || 0) +
                (Number(row.replies) || 0);
              twitterRetweetsByContest[cid] =
                (twitterRetweetsByContest[cid] || 0) +
                (Number(row.retweets) || 0);
              twitterQuoteRepostsByContest[cid] =
                (twitterQuoteRepostsByContest[cid] || 0) +
                (Number(row.quote_reposts) || 0);

              if (!twitterTweetsByContest[cid]) {
                twitterTweetsByContest[cid] = [];
              }
              twitterTweetsByContest[cid].push(
                ...mapTwitterTweetsToBudgetSubmissions([
                  {
                    id: row.id || `tweet-${twitterTweetsByContest[cid].length}`,
                    creator_id: row.creator_id,
                    tweet_created_at: row.tweet_created_at,
                    created_at: row.created_at,
                    moderation_status: row.moderation_status,
                    points: row.points,
                    manual_points_adjustment: row.manual_points_adjustment,
                    earnings: row.earnings,
                    impressions: row.impressions,
                    is_eligible: row.is_eligible,
                    deleted_at: row.deleted_at,
                  },
                ]),
              );
            }
          },
        );
      }

      const contestsWithMetrics = contestsFiltered
        .map((contest) => {
          const isTwitter = normalizePlatformKey(contest) === "twitter";
          let totalViews: number;
          let totalSubmissions: number;
          let submissions: {
            id: string;
            views: number;
            created_at?: string;
            platform?: string;
            other_stats?: unknown;
            status?: string;
          }[];

          let budgetSubmissions: BudgetTileSubmission[];

          if (isTwitter) {
            totalSubmissions = twitterCountByContest[contest.id] || 0;
            totalViews = twitterViewsByContest[contest.id] || 0;
            budgetSubmissions = twitterTweetsByContest[contest.id] || [];
            const twitterMetrics =
              totalSubmissions > 0
                ? {
                    likes: twitterLikesByContest[contest.id] || 0,
                    replies: twitterRepliesByContest[contest.id] || 0,
                    retweets: twitterRetweetsByContest[contest.id] || 0,
                    quote_reposts:
                      twitterQuoteRepostsByContest[contest.id] || 0,
                    impressions: totalViews,
                  }
                : undefined;
            submissions =
              totalSubmissions > 0
                ? [
                    {
                      id: "twitter-aggregate",
                      views: totalViews,
                      other_stats: {
                        twitter: twitterMetrics,
                        x: twitterMetrics,
                      },
                    },
                  ]
                : [];
          } else {
            const subs =
              allSubmissions?.filter((s) => s.contest_id === contest.id) || [];
            totalSubmissions = subs.length;
            totalViews = subs.reduce((sum, s) => sum + (s.views || 0), 0);
            budgetSubmissions = subs.map(
              (s: {
                id: string;
                views?: number;
                created_at?: string;
                platform?: string;
                other_stats?: unknown;
                status?: string;
                creator_id?: string;
                paid?: boolean;
                earnings?: number | null;
                bonus_paid?: boolean;
                bonus_amount?: number | null;
                paid_at?: string | null;
              }) => ({
                id: s.id,
                creator_id: s.creator_id || "",
                views: s.views || 0,
                created_at: s.created_at || new Date(0).toISOString(),
                platform: s.platform,
                other_stats: s.other_stats,
                status: s.status,
                paid: s.paid ?? false,
                earnings: s.earnings ?? null,
                bonus_paid: s.bonus_paid ?? false,
                bonus_amount: s.bonus_amount ?? undefined,
                paid_at: s.paid_at,
              }),
            );
            submissions = budgetSubmissions.map((s) => ({
              id: s.id || "",
              views: s.views || 0,
              created_at: s.created_at,
              platform: s.platform,
              other_stats: s.other_stats,
              status: s.status,
            }));
          }

          const budgetTile = resolveBudgetTileMetrics(
            {
              contest_type: contest.contest_type,
              post_contest_status: contest.post_contest_status,
              max_earnings_per_creator: contest.max_earnings_per_creator,
              contest_based_details: contest.contest_based_details as Record<
                string,
                unknown
              > | null,
            },
            budgetSubmissions,
          );

          const totalSpent = budgetTile?.numeratorCents ?? 0;

          const avgViewsPerSubmission =
            totalSubmissions > 0 ? totalViews / totalSubmissions : 0;
          const costPerView = totalViews > 0 ? totalSpent / totalViews : 0;
          const roi =
            totalViews > 0 && totalSpent > 0
              ? (totalViews / totalSpent) * 100
              : 0;

          const out: Record<string, unknown> = {
            ...contest,
            submissions,
            live_submission_count: totalSubmissions,
            budgetTile,
            metrics: {
              totalViews,
              totalSubmissions,
              totalSpent,
              avgViewsPerSubmission:
                Math.round(avgViewsPerSubmission * 100) / 100,
              costPerView: Math.round(costPerView * 100) / 100,
              roi: Math.round(roi * 100) / 100,
            },
          };
          if (isTwitter && totalSubmissions > 0) {
            out.twitter_metrics = {
              likes: twitterLikesByContest[contest.id] || 0,
              replies: twitterRepliesByContest[contest.id] || 0,
              retweets: twitterRetweetsByContest[contest.id] || 0,
              quote_reposts: twitterQuoteRepostsByContest[contest.id] || 0,
              impressions: totalViews,
            };
          }
          return out;
        })
        .filter((c) => (c.metrics as ContestMetrics).totalSubmissions > 0);

      // Calculate summary statistics
      type ContestMetrics = {
        totalViews: number;
        totalSubmissions: number;
        totalSpent: number;
      };
      const totalContests = contestsWithMetrics.length;
      const totalViews = contestsWithMetrics.reduce(
        (sum, contest) => sum + (contest.metrics as ContestMetrics).totalViews,
        0,
      );
      const totalSubmissions = contestsWithMetrics.reduce(
        (sum, contest) =>
          sum + (contest.metrics as ContestMetrics).totalSubmissions,
        0,
      );
      const totalSpent = contestsWithMetrics.reduce(
        (sum, contest) => sum + (contest.metrics as ContestMetrics).totalSpent,
        0,
      );
      const avgCostPerView = totalViews > 0 ? totalSpent / totalViews : 0;

      // Performance comparison
      const avgPerformance = {
        avgViewsPerContest: totalContests > 0 ? totalViews / totalContests : 0,
        avgSubmissionsPerContest:
          totalContests > 0 ? totalSubmissions / totalContests : 0,
        avgSpentPerContest: totalContests > 0 ? totalSpent / totalContests : 0,
        avgCostPerView: Math.round(avgCostPerView * 100) / 100,
      };

      return NextResponse.json({
        contests: contestsWithMetrics,
        summary: {
          totalContests,
          totalViews,
          totalSubmissions,
          totalSpent,
          ...avgPerformance,
        },
      });
    }
  } catch (error) {
    console.error("Analytics contests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
