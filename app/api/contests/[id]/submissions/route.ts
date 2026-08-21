import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  CONTEST_DETAIL_SUBMISSIONS_PAGE_SIZE,
  loadContestDetailSubmissionCounts,
  loadContestDetailSubmissionsPage,
} from "@/lib/contest-detail-submissions";

export const dynamic = "force-dynamic";

async function authorizeContestAccess(
  contestId: string,
  userId: string,
): Promise<
  | {
      ok: true;
      contest: {
        id: string;
        advertiser_id: string;
        platform: string | null;
        contest_format: string | null;
        contest_type: string | null;
        contest_based_details: Record<string, unknown> | null;
      };
    }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();
  const { data: contest, error } = await supabase
    .from("contests")
    .select(
      "id, advertiser_id, platform, contest_format, contest_type, contest_based_details",
    )
    .eq("id", contestId)
    .single();

  if (error || !contest) {
    return { ok: false, status: 404, error: "Contest not found" };
  }

  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin && contest.advertiser_id !== userId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return {
    ok: true,
    contest: {
      ...contest,
      contest_based_details:
        (contest.contest_based_details as Record<string, unknown> | null) ??
        null,
    },
  };
}

function parsePaginationParams(url: URL): {
  limit: number;
  offset: number;
} | null {
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");
  const limit = limitRaw
    ? Number.parseInt(limitRaw, 10)
    : CONTEST_DETAIL_SUBMISSIONS_PAGE_SIZE;
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;
  if (
    !Number.isFinite(limit) ||
    !Number.isFinite(offset) ||
    limit < 1 ||
    limit > 200 ||
    offset < 0
  ) {
    return null;
  }
  return { limit, offset };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contestId } = await params;
    const auth = await authorizeContestAccess(contestId, user.id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(request.url);
    const probeOnly = url.searchParams.get("probe") === "1";
    if (probeOnly) {
      const counts = await loadContestDetailSubmissionCounts(
        supabase,
        contestId,
        auth.contest,
      );
      return NextResponse.json({
        count: counts.total,
        empty: counts.total === 0,
        counts,
      });
    }

    const pagination = parsePaginationParams(url);
    if (!pagination) {
      return NextResponse.json(
        { error: "Invalid limit or offset" },
        { status: 400 },
      );
    }

    let creatorModerationData: Record<string, any> | undefined;
    const isTwitter =
      (auth.contest.platform?.toLowerCase() === "twitter" ||
        auth.contest.platform?.toLowerCase() === "x") &&
      auth.contest.contest_format === "text_image";
    if (isTwitter) {
      const { data: leaderboardData } = await supabase
        .from("twitter_campaign_leaderboard")
        .select(
          "creator_id, moderation_status, rejection_reason, manual_points_adjustment, manual_points_reason, total_points, total_eligible_tweets, total_likes, total_replies, total_retweets, total_quote_reposts, total_impressions, current_rank, paid_at, earnings, paid_rank",
        )
        .eq("contest_id", contestId);
      if (leaderboardData?.length) {
        creatorModerationData = {};
        for (const entry of leaderboardData) {
          if (entry.creator_id) {
            creatorModerationData[entry.creator_id] = entry;
          }
        }
      }
    }

    const page = await loadContestDetailSubmissionsPage(
      supabase,
      contestId,
      auth.contest,
      {
        limit: pagination.limit,
        offset: pagination.offset,
        creatorModerationData,
      },
    );

    if (page.errorMessage) {
      return NextResponse.json(
        { error: page.errorMessage },
        { status: 500 },
      );
    }

    return NextResponse.json({
      submissions: page.submissions,
      count: page.total,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      hasMore: page.hasMore,
      counts: page.counts,
    });
  } catch (e) {
    console.error("[contests/submissions GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load" },
      { status: 500 },
    );
  }
}
