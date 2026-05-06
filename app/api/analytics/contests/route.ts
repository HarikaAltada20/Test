import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";

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
          brief_html,
          submissions (
            id,
            views,
            created_at,
            platform,
            creator_id,
            other_stats,
            status,
            earnings,
            creator:creator_id (
              username,
              creator_profiles (
                total_views,
                total_contests_participated,
                youtube_account,
                instagram_account
              )
            )
          )
        `,
        )
        .eq("id", contestId)
        .eq("advertiser_id", user.id)
        .single();

      if (!contest) {
        return NextResponse.json(
          { error: "Contest not found" },
          { status: 404 },
        );
      }

      // Calculate contest-specific metrics
      const totalViews =
        contest.submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) ||
        0;
      const totalSubmissions = contest.submissions?.length || 0;

      // Calculate total spent for this contest
      let totalSpent = 0;
      const details = contest.contest_based_details;
      if (
        contest.contest_type === "leaderboard" &&
        details?.leaderboard_contest?.total_prize
      ) {
        totalSpent = details.leaderboard_contest.total_prize;
      } else if (
        contest.contest_type === "cpm" &&
        details?.cpm_contest?.total_budget
      ) {
        totalSpent = details.cpm_contest.total_budget;
      } else if (contest.contest_type === "milestone") {
        totalSpent = getPoolBudgetCentsFromDetails("milestone", details);
      } else if (contest.contest_type === "dual_rewards") {
        totalSpent = getPoolBudgetCentsFromDetails("dual_rewards", details);
      }

      const avgViewsPerSubmission =
        totalSubmissions > 0 ? totalViews / totalSubmissions : 0;
      const costPerView = totalViews > 0 ? totalSpent / totalViews : 0;

      // Top performing submissions
      const topSubmissions =
        contest.submissions
          ?.sort((a, b) => (b.views || 0) - (a.views || 0))
          .slice(0, 10) || [];

      // Submission timeline (daily submissions)
      const submissionTimeline =
        contest.submissions?.reduce(
          (acc, sub) => {
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
        contest.submissions?.reduce(
          (acc, sub) => {
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
        contest.submissions?.map((sub) => sub.creator_id),
      ).size;
      const avgSubmissionsPerCreator =
        uniqueCreators > 0 ? totalSubmissions / uniqueCreators : 0;

      return NextResponse.json({
        contest: {
          ...contest,
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
          thumbnail_url
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

      let submissionsQuery = supabase
        .from("submissions")
        .select(
          "id, views, created_at, platform, contest_id, other_stats, status",
        )
        .in(
          "contest_id",
          contestsFiltered.map((c) => c.id),
        );
      if (notRejected) {
        submissionsQuery = submissionsQuery.neq("status", "rejected");
      } else if (submissionStatus && submissionStatus !== "all") {
        if (submissionStatus === "verifiedpaid") {
          submissionsQuery = submissionsQuery.in("status", [
            "verified",
            "paid",
          ]);
        } else {
          submissionsQuery = submissionsQuery.eq("status", submissionStatus);
        }
      }
      const { data: allSubmissions } = await submissionsQuery;

      const twitterContestIds = contestsFiltered
        .filter((c) => normalizePlatformKey(c) === "twitter")
        .map((c) => c.id);
      const twitterCountByContest: Record<string, number> = {};
      const twitterViewsByContest: Record<string, number> = {};
      const twitterLikesByContest: Record<string, number> = {};
      const twitterRepliesByContest: Record<string, number> = {};
      const twitterRetweetsByContest: Record<string, number> = {};
      const twitterQuoteRepostsByContest: Record<string, number> = {};
      if (twitterContestIds.length > 0) {
        let tweetsQuery = supabase
          .from("twitter_campaign_tweets")
          .select(
            "contest_id, impressions, likes, replies, retweets, quote_reposts",
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
            contest_id?: string;
            impressions?: number;
            likes?: number;
            replies?: number;
            retweets?: number;
            quote_reposts?: number;
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

          if (isTwitter) {
            totalSubmissions = twitterCountByContest[contest.id] || 0;
            totalViews = twitterViewsByContest[contest.id] || 0;
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
            submissions = subs.map(
              (s: {
                id: string;
                views?: number;
                created_at?: string;
                platform?: string;
                other_stats?: unknown;
                status?: string;
              }) => ({
                id: s.id,
                views: s.views || 0,
                created_at: s.created_at,
                platform: s.platform,
                other_stats: s.other_stats,
                status: s.status,
              }),
            );
          }

          let totalSpent = 0;
          const details = contest.contest_based_details;
          if (
            contest.contest_type === "leaderboard" &&
            details?.leaderboard_contest?.total_prize
          ) {
            totalSpent = details.leaderboard_contest.total_prize;
          } else if (
            contest.contest_type === "cpm" &&
            details?.cpm_contest?.total_budget
          ) {
            totalSpent = details.cpm_contest.total_budget;
          } else if (contest.contest_type === "milestone") {
            totalSpent = getPoolBudgetCentsFromDetails("milestone", details);
          } else if (contest.contest_type === "dual_rewards") {
            totalSpent = getPoolBudgetCentsFromDetails("dual_rewards", details);
          }

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
