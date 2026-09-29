import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";
import { parseBrandAnalyticsContext } from "@/lib/brand-analytics-context";
import {
  parseBrandAnalyticsDateRange,
  parseBrandAnalyticsSource,
  validateBrandAnalyticsDateRange,
} from "@/lib/brand-analytics-query";
import { getCachedBrandAnalyticsBundle } from "@/lib/brand-analytics-cache";
import { buildBrandContestsResponse } from "@/lib/brand-analytics-response";
import { brandAnalyticsClientErrorMessage } from "@/lib/brand-analytics-errors";
import {
  attachCreatorsToSubmissionRows,
  fetchBrandPcSubmissionsAsAnalyticsRows,
} from "@/lib/brand-analytics-pc-submissions";

/** Drop OAuth tokens from nested creator social account blobs. */
function redactCreatorSocialAccounts<T extends Record<string, unknown>>(
  submissions: T[],
): T[] {
  return submissions.map((sub) => {
    const creator = sub.creator as
      | {
          username?: string;
          creator_profiles?: Record<string, unknown> | Record<string, unknown>[];
        }
      | null
      | undefined;
    if (!creator?.creator_profiles) return sub;

    const profiles = Array.isArray(creator.creator_profiles)
      ? creator.creator_profiles
      : [creator.creator_profiles];

    const redactedProfiles = profiles.map((profile) => {
      const yt = profile.youtube_account as Record<string, unknown> | null | undefined;
      const ig = profile.instagram_account as Record<string, unknown> | null | undefined;
      return {
        ...profile,
        youtube_account: yt
          ? {
              channelId: yt.channelId ?? null,
              channelTitle: yt.channelTitle ?? null,
            }
          : null,
        instagram_account: ig
          ? {
              id: ig.id ?? null,
              username: ig.username ?? null,
            }
          : null,
      };
    });

    return {
      ...sub,
      creator: {
        ...creator,
        creator_profiles: Array.isArray(creator.creator_profiles)
          ? redactedProfiles
          : redactedProfiles[0],
      },
    };
  });
}

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

    if (contestId) {
      const dateRange = parseBrandAnalyticsDateRange(searchParams);
      const dateValidation = validateBrandAnalyticsDateRange(dateRange);
      if (!dateValidation.ok) {
        return NextResponse.json({ error: dateValidation.error }, { status: 400 });
      }
      const { from: dateFrom, to: dateTo } = dateRange;
      const dataSource = parseBrandAnalyticsSource(searchParams);
      const isPc = dataSource === "pc_submissions";

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

      // Live path reads `submissions`; PC path reads overlay metrics so totals match
      // the Campaigns list when `source=pc_submissions`.
      let allContestSubs: Record<string, unknown>[] = [];
      if (isPc) {
        const admin = createAdminClient();
        const pcRows = await fetchBrandPcSubmissionsAsAnalyticsRows(
          admin,
          [contestId],
          { dateFrom, dateTo },
        );
        allContestSubs = await attachCreatorsToSubmissionRows(admin, pcRows);
      } else {
        const SINGLE_PAGE_SIZE = 1000;
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
            .gte("created_at", dateFrom.toISOString())
            .lte("created_at", dateTo.toISOString())
            .range(from, to)
            .order("created_at", { ascending: false });
          if (subPageErr) break;
          if (subPage && subPage.length > 0) {
            allContestSubs.push(...(subPage as Record<string, unknown>[]));
          }
          if (!subPage || subPage.length < SINGLE_PAGE_SIZE) break;
        }
      }

      allContestSubs = redactCreatorSocialAccounts(allContestSubs);

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
      const parsed = parseBrandAnalyticsContext(
        user.id,
        new URL(request.url).searchParams,
      );
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      const bundle = await getCachedBrandAnalyticsBundle(parsed.ctx);
      const admin = createAdminClient();
      return NextResponse.json(
        await buildBrandContestsResponse(bundle, admin),
      );
    }
  } catch (error) {
    console.error("Analytics contests error:", error);
    return NextResponse.json(
      { error: brandAnalyticsClientErrorMessage(error) },
      { status: 500 },
    );
  }
}
