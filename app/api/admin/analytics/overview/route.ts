import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  ADMIN_ANALYTICS_PLATFORMS,
  ADMIN_ANALYTICS_CONTEST_TYPES,
  ADMIN_ANALYTICS_BASE_STATUSES,
  aggregateAdminAnalytics,
  contestOverlapsDateRange,
  expandStatusFilterIds,
  getContestAdvertiserName,
  isAdminAnalyticsContestType,
  isAdminAnalyticsPlatform,
  isApprovedAnalyticsContest,
  normalizeAnalyticsPlatform,
  type AdminAnalyticsAdvertiserOption,
  type AdminAnalyticsBaseStatus,
  type AdminAnalyticsContest,
  type AdminAnalyticsContestType,
  type AdminAnalyticsPlatform,
  type AdminAnalyticsStatusFilterId,
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
        "id, title, platform, contest_type, contest_based_details, payment_details, moderation_status, start_date, end_date, advertiser_id, advertiser_profiles!advertiser_id(company_name)",
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

function parseStatusesParam(raw: string | null): AdminAnalyticsBaseStatus[] {
  if (raw?.trim().toLowerCase() === "__none__") {
    return [];
  }
  if (!raw || raw.trim() === "" || raw.trim().toLowerCase() === "all") {
    return [...ADMIN_ANALYTICS_BASE_STATUSES];
  }
  const parts = raw
    .split(",")
    .map((p) => p.trim().toLowerCase()) as AdminAnalyticsStatusFilterId[];
  return expandStatusFilterIds(
    parts.filter((p): p is AdminAnalyticsStatusFilterId =>
      (ADMIN_ANALYTICS_BASE_STATUSES as string[]).includes(p),
    ),
  );
}

/** null = all; [] = none; [...] = specific ids */
function parseIdListParam(raw: string | null): string[] | null {
  if (raw?.trim().toLowerCase() === "__none__") return [];
  if (!raw || !raw.trim()) return null;
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : null;
}

function parseContestTypesParam(
  raw: string | null,
): AdminAnalyticsContestType[] {
  if (raw?.trim().toLowerCase() === "__none__") {
    return [];
  }
  if (!raw || raw.trim() === "" || raw.trim().toLowerCase() === "all") {
    return [...ADMIN_ANALYTICS_CONTEST_TYPES];
  }
  const parts = raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(isAdminAnalyticsContestType);
  return parts;
}

async function fetchAdvertiserUsers(
  supabase: ReturnType<typeof createAdminClient>,
  advertiserIds: string[],
): Promise<Map<string, { full_name: string | null; email: string | null }>> {
  const map = new Map<
    string,
    { full_name: string | null; email: string | null }
  >();
  if (advertiserIds.length === 0) return map;

  const CHUNK = 150;
  for (let i = 0; i < advertiserIds.length; i += CHUNK) {
    const chunk = advertiserIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      map.set(row.id, {
        full_name: row.full_name ?? null,
        email: row.email ?? null,
      });
    }
  }
  return map;
}

function buildAdvertiserOptions(
  contests: AdminAnalyticsContest[],
  usersById: Map<string, { full_name: string | null; email: string | null }>,
): AdminAnalyticsAdvertiserOption[] {
  const byId = new Map<string, AdminAnalyticsAdvertiserOption>();
  for (const c of contests) {
    if (!c.advertiser_id || byId.has(c.advertiser_id)) continue;
    byId.set(c.advertiser_id, {
      id: c.advertiser_id,
      name: getContestAdvertiserName(c, usersById.get(c.advertiser_id)),
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
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
    const statuses = parseStatusesParam(searchParams.get("statuses"));
    const contestIds = parseIdListParam(searchParams.get("contestIds"));
    const advertiserIds = parseIdListParam(searchParams.get("advertiserIds"));

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

    const advertiserIdSet =
      advertiserIds == null ? null : new Set(advertiserIds);

    const contestsForScope = advertiserIdSet
      ? contestsInRange.filter(
          (c) => c.advertiser_id && advertiserIdSet.has(c.advertiser_id),
        )
      : contestsInRange;

    const scopedContestIds =
      contestIds == null
        ? contestsForScope.map((c) => c.id)
        : contestsForScope
            .filter((c) => contestIds.includes(c.id))
            .map((c) => c.id);

    const submissions = await fetchSubmissionsInRange(
      supabase,
      scopedContestIds,
      from.toISOString(),
      to.toISOString(),
    );

    const aggregated = aggregateAdminAnalytics({
      contests: contestsForScope,
      submissions,
      from,
      to,
      platforms,
      contestTypes,
      contestIds,
      advertiserIds,
      statuses,
    });

    // Advertisers with campaigns overlapping the current date/platform/type scope
    const advertiserIdsForLabels = [
      ...new Set(
        contestsInRange
          .map((c) => c.advertiser_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const advertiserUsers = await fetchAdvertiserUsers(
      supabase,
      advertiserIdsForLabels,
    );
    const allAdvertisers = buildAdvertiserOptions(
      contestsInRange,
      advertiserUsers,
    );

    // Campaign picker: scoped by selected advertisers (and date/platform/type)
    const allCampaigns = contestsForScope
      .map((c) => ({
        id: c.id,
        title: (c.title || "Untitled campaign").trim() || "Untitled campaign",
        platform: c.platform,
        contest_type: c.contest_type,
        advertiser_id: c.advertiser_id ?? null,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      platforms,
      types: contestTypes,
      statuses,
      advertiserIds: advertiserIds ?? [],
      summary: aggregated.summary,
      series: aggregated.series,
      viewsByStatus: aggregated.viewsByStatus,
      campaigns: aggregated.campaigns,
      allAdvertisers,
      allCampaigns,
      selectedCampaignCount:
        contestIds == null
          ? aggregated.campaigns.length
          : contestIds.length,
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
