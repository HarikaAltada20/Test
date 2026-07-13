import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  ADMIN_ANALYTICS_PLATFORMS,
  ADMIN_ANALYTICS_CONTEST_TYPES,
  aggregateAdminAnalytics,
  contestOverlapsDateRange,
  isAdminAnalyticsContestType,
  isAdminAnalyticsPlatform,
  isApprovedAnalyticsContest,
  normalizeAnalyticsPlatform,
  type AdminAnalyticsContest,
  type AdminAnalyticsContestType,
  type AdminAnalyticsPlatform,
  type AdminAnalyticsSubmission,
} from "@/lib/admin-analytics";

async function fetchAllContests(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<AdminAnalyticsContest[]> {
  const CHUNK = 1000;
  let all: AdminAnalyticsContest[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("contests")
      .select(
        "id, title, platform, contest_type, contest_based_details, payment_details, moderation_status, start_date, end_date",
      )
      .order("created_at", { ascending: false })
      .range(from, from + CHUNK - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all = all.concat(data as AdminAnalyticsContest[]);
    if (data.length < CHUNK) break;
    from += CHUNK;
  }
  return all;
}

async function fetchSubmissionsInRange(
  supabase: ReturnType<typeof createAdminClient>,
  contestIds: string[],
  fromIso: string,
  toIso: string,
): Promise<AdminAnalyticsSubmission[]> {
  if (contestIds.length === 0) return [];

  const CHUNK = 1000;
  const CONTEST_ID_CHUNK = 150;
  let all: AdminAnalyticsSubmission[] = [];

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    let rangeFrom = 0;
    while (true) {
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, contest_id, created_at, status, platform, views, earnings, bonus_amount, other_stats",
        )
        .in("contest_id", idChunk)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(rangeFrom, rangeFrom + CHUNK - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all = all.concat(data as AdminAnalyticsSubmission[]);
      if (data.length < CHUNK) break;
      rangeFrom += CHUNK;
    }
  }

  return all;
}

function parsePlatformsParam(raw: string | null): AdminAnalyticsPlatform[] {
  if (!raw || raw.trim() === "" || raw.trim().toLowerCase() === "all") {
    return [...ADMIN_ANALYTICS_PLATFORMS];
  }
  const parts = raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is AdminAnalyticsPlatform =>
      (ADMIN_ANALYTICS_PLATFORMS as string[]).includes(p),
    );
  return parts.length > 0 ? parts : [...ADMIN_ANALYTICS_PLATFORMS];
}

function parseContestTypesParam(
  raw: string | null,
): AdminAnalyticsContestType[] {
  if (!raw || raw.trim() === "" || raw.trim().toLowerCase() === "all") {
    return [...ADMIN_ANALYTICS_CONTEST_TYPES];
  }
  const parts = raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(isAdminAnalyticsContestType);
  return parts.length > 0 ? parts : [...ADMIN_ANALYTICS_CONTEST_TYPES];
}

export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const platforms = parsePlatformsParam(searchParams.get("platforms"));
    const contestTypes = parseContestTypesParam(searchParams.get("types"));
    const contestIdsRaw = searchParams.get("contestIds");
    const contestIds =
      contestIdsRaw && contestIdsRaw.trim()
        ? contestIdsRaw
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : null;

    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);

    const from = fromParam ? new Date(fromParam) : defaultFrom;
    const to = toParam ? new Date(toParam) : now;

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Invalid date range" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const contests = await fetchAllContests(supabase);

    const videoApprovedContests = contests.filter(
      (c) =>
        isApprovedAnalyticsContest(c) &&
        isAdminAnalyticsPlatform(
          normalizeAnalyticsPlatform(c.platform, c.contest_based_details),
        ),
    );

    const contestTypeSet = new Set(contestTypes);
    const platformSet = new Set(platforms);
    const contestsInRange = videoApprovedContests.filter((c) => {
      if (!contestOverlapsDateRange(c, from, to)) return false;
      const type = (c.contest_type ?? "").toLowerCase();
      if (!isAdminAnalyticsContestType(type) || !contestTypeSet.has(type)) {
        return false;
      }
      const p = normalizeAnalyticsPlatform(c.platform, c.contest_based_details);
      return isAdminAnalyticsPlatform(p) && platformSet.has(p);
    });

    const scopedContestIds =
      contestIds && contestIds.length > 0
        ? contestsInRange
            .filter((c) => contestIds.includes(c.id))
            .map((c) => c.id)
        : contestsInRange.map((c) => c.id);

    const submissions = await fetchSubmissionsInRange(
      supabase,
      scopedContestIds,
      from.toISOString(),
      to.toISOString(),
    );

    const aggregated = aggregateAdminAnalytics({
      contests: contestsInRange,
      submissions,
      from,
      to,
      platforms,
      contestTypes,
      contestIds,
    });

    // Campaign picker: approved/published video campaigns overlapping the range
    const allCampaigns = contestsInRange
      .map((c) => ({
        id: c.id,
        title: (c.title || "Untitled campaign").trim() || "Untitled campaign",
        platform: c.platform,
        contest_type: c.contest_type,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      platforms,
      types: contestTypes,
      summary: aggregated.summary,
      series: aggregated.series,
      campaigns: aggregated.campaigns,
      allCampaigns,
      selectedCampaignCount:
        contestIds && contestIds.length > 0
          ? contestIds.length
          : aggregated.campaigns.length,
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load analytics",
      },
      { status: 500 },
    );
  }
}
