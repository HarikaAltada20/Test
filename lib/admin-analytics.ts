import { computeEffectiveCpmUsd } from "@/lib/report-export-metrics";
import {
  getPoolBudgetCentsFromDetails,
  type ContestBasedDetailsForPool,
} from "@/lib/contest-type";

export type AdminAnalyticsPlatform = "youtube" | "tiktok" | "instagram";

export const ADMIN_ANALYTICS_PLATFORMS: AdminAnalyticsPlatform[] = [
  "youtube",
  "tiktok",
  "instagram",
];

export type AdminAnalyticsContestType =
  | "leaderboard"
  | "cpm"
  | "milestone"
  | "dual_rewards";

export const ADMIN_ANALYTICS_CONTEST_TYPES: AdminAnalyticsContestType[] = [
  "leaderboard",
  "cpm",
  "milestone",
  "dual_rewards",
];

export const ADMIN_ANALYTICS_CONTEST_TYPE_LABELS: Record<
  AdminAnalyticsContestType,
  string
> = {
  leaderboard: "Leaderboard",
  cpm: "CPM",
  milestone: "Milestone",
  dual_rewards: "Dual Rewards",
};

export function isAdminAnalyticsContestType(
  value: string,
): value is AdminAnalyticsContestType {
  return (ADMIN_ANALYTICS_CONTEST_TYPES as string[]).includes(value);
}

export type AdminAnalyticsContest = {
  id: string;
  title: string | null;
  platform: string | null;
  contest_type: string | null;
  contest_based_details: unknown;
  payment_details: unknown;
  moderation_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  advertiser_id?: string | null;
  advertiser_profiles?:
    | { company_name?: string | null }
    | { company_name?: string | null }[]
    | null;
};

export type AdminAnalyticsAdvertiserOption = {
  id: string;
  name: string;
};

export function getContestAdvertiserCompanyName(
  contest: Pick<AdminAnalyticsContest, "advertiser_profiles">,
): string | null {
  const profile = Array.isArray(contest.advertiser_profiles)
    ? contest.advertiser_profiles[0]
    : contest.advertiser_profiles;
  const name = profile?.company_name?.trim();
  return name || null;
}

/** Prefer company name, then user full name, then email. */
export function formatAdvertiserDisplayName(input: {
  company_name?: string | null;
  full_name?: string | null;
  email?: string | null;
}): string {
  return (
    input.company_name?.trim() ||
    input.full_name?.trim() ||
    input.email?.trim() ||
    "Unknown advertiser"
  );
}

export function getContestAdvertiserName(
  contest: Pick<AdminAnalyticsContest, "advertiser_profiles">,
  user?: { full_name?: string | null; email?: string | null } | null,
): string {
  return formatAdvertiserDisplayName({
    company_name: getContestAdvertiserCompanyName(contest),
    full_name: user?.full_name,
    email: user?.email,
  });
}

export type AdminAnalyticsSubmission = {
  id: string;
  contest_id: string;
  created_at: string;
  status: string | null;
  platform: string | null;
  views: number | null;
  earnings?: number | null;
  bonus_amount?: number | null;
  other_stats?: Record<string, unknown> | null;
};

export type AdminAnalyticsSeriesPoint = {
  date: string;
  label: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  pendingViews: number;
  verifiedViews: number;
  paidViews: number;
  rejectedViews: number;
  notRejectedViews: number;
  verifiedPaidViews: number;
};

export type AdminAnalyticsBaseStatus =
  | "pending"
  | "verified"
  | "paid"
  | "rejected";

export type AdminAnalyticsStatusFilterId = AdminAnalyticsBaseStatus;

export type AdminAnalyticsStatusCardId =
  | AdminAnalyticsBaseStatus
  | "not_rejected"
  | "verified_paid";

export const ADMIN_ANALYTICS_BASE_STATUSES: AdminAnalyticsBaseStatus[] = [
  "pending",
  "verified",
  "paid",
  "rejected",
];

/** Status options shown in the view-status filter dropdown (bases only). */
export const ADMIN_ANALYTICS_STATUS_FILTERS: {
  id: AdminAnalyticsStatusFilterId;
  label: string;
  bases: AdminAnalyticsBaseStatus[];
}[] = [
  { id: "pending", label: "Pending Views", bases: ["pending"] },
  { id: "verified", label: "Verified Views", bases: ["verified"] },
  { id: "paid", label: "Paid Views", bases: ["paid"] },
  { id: "rejected", label: "Rejected Views", bases: ["rejected"] },
];

/** Status metric cards (includes composites; not all appear in the filter dropdown). */
export const ADMIN_ANALYTICS_STATUS_CARDS: {
  id: AdminAnalyticsStatusCardId;
  label: string;
}[] = [
  { id: "pending", label: "Pending Views" },
  { id: "verified", label: "Verified Views" },
  { id: "paid", label: "Paid Views" },
  { id: "rejected", label: "Rejected Views" },
  { id: "not_rejected", label: "Non Rejected Views" },
  { id: "verified_paid", label: "Verified + Paid Views" },
];

export type AdminAnalyticsViewsByStatus = {
  all: number;
  pending: number;
  verified: number;
  paid: number;
  rejected: number;
  notRejected: number;
  verifiedPaid: number;
};

export type AdminAnalyticsSummary = {
  views: number;
  filteredViews: number;
  likes: number;
  comments: number;
  shares: number;
  totalPayoutsCents: number;
  effectiveCpm: number | null;
  totalSubmissions: number;
  approvedSubmissions: number;
  approvalRate: number;
};

export function normalizeSubmissionStatus(
  status: string | null | undefined,
): AdminAnalyticsBaseStatus | "unknown" {
  const s = (status ?? "").toLowerCase();
  if (s === "pending" || s === "verified" || s === "paid" || s === "rejected") {
    return s;
  }
  // Treat legacy "approved" as verified
  if (s === "approved") return "verified";
  return "unknown";
}

export function expandStatusFilterIds(
  selected: AdminAnalyticsStatusFilterId[],
): AdminAnalyticsBaseStatus[] {
  const set = new Set<AdminAnalyticsBaseStatus>();
  for (const id of selected) {
    const def = ADMIN_ANALYTICS_STATUS_FILTERS.find((f) => f.id === id);
    if (!def) continue;
    for (const base of def.bases) set.add(base);
  }
  return ADMIN_ANALYTICS_BASE_STATUSES.filter((s) => set.has(s));
}

export function isStatusFilterFullySelected(
  id: AdminAnalyticsStatusFilterId,
  selectedBases: AdminAnalyticsBaseStatus[],
): boolean {
  const def = ADMIN_ANALYTICS_STATUS_FILTERS.find((f) => f.id === id);
  if (!def) return false;
  const set = new Set(selectedBases);
  return def.bases.every((b) => set.has(b));
}

/** Creator-facing campaign budget in cents (not advertiser funding charge). */
export function getContestBudgetCents(contest: AdminAnalyticsContest): number {
  const details = contest.contest_based_details as
    | (ContestBasedDetailsForPool & {
        leaderboard_contest?: {
          total_prize?: number | null;
          total_budget?: number | null;
        };
      })
    | null;

  if (contest.contest_type === "leaderboard") {
    const prize = details?.leaderboard_contest?.total_prize;
    if (typeof prize === "number" && prize > 0) return prize;
    const lbBudget = details?.leaderboard_contest?.total_budget;
    if (typeof lbBudget === "number" && lbBudget > 0) return lbBudget;
    return 0;
  }

  return getPoolBudgetCentsFromDetails(contest.contest_type, details);
}

/** True when the campaign window overlaps [from, to], or has no dates (include). */
export function contestOverlapsDateRange(
  contest: Pick<AdminAnalyticsContest, "start_date" | "end_date">,
  from: Date,
  to: Date,
): boolean {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const startMs = contest.start_date
    ? new Date(contest.start_date).getTime()
    : NaN;
  const endMs = contest.end_date ? new Date(contest.end_date).getTime() : NaN;

  const hasStart = Number.isFinite(startMs);
  const hasEnd = Number.isFinite(endMs);

  if (!hasStart && !hasEnd) return true;
  if (hasStart && hasEnd) return startMs <= toMs && endMs >= fromMs;
  if (hasStart) return startMs <= toMs;
  return endMs >= fromMs;
}

export function normalizeAnalyticsPlatform(
  raw: string | null | undefined,
  contestBasedDetails?: unknown,
): AdminAnalyticsPlatform | "twitter" | "unknown" {
  const p = (raw ?? "").toString().trim().toLowerCase();
  if (p === "x" || p === "twitter") return "twitter";
  if (p === "tiktok" || p === "tik_tok" || p === "tik-tok") return "tiktok";
  if (p === "youtube" || p === "instagram") return p;
  const details = contestBasedDetails as
    | { twitter_campaign?: unknown }
    | null
    | undefined;
  if (details?.twitter_campaign != null) return "twitter";
  return "unknown";
}

/** Admin-approved campaigns (approved or published — excludes draft/pending/rejected). */
export function isApprovedAnalyticsContest(
  contest: Pick<AdminAnalyticsContest, "moderation_status">,
): boolean {
  const status = (contest.moderation_status ?? "").toLowerCase();
  return status === "approved" || status === "published";
}

/** Video platforms only — Twitter/X campaigns are excluded from admin analytics. */
export function isAdminAnalyticsPlatform(
  platform: string,
): platform is AdminAnalyticsPlatform {
  return (ADMIN_ANALYTICS_PLATFORMS as string[]).includes(platform);
}

function nestedStat(
  stats: Record<string, unknown> | null | undefined,
  platform: string,
  keys: string[],
): number {
  if (!stats) return 0;
  const nested =
    (stats[platform] as Record<string, unknown> | undefined) ?? stats;
  for (const key of keys) {
    const value = Number(nested?.[key] ?? 0);
    if (Number.isFinite(value) && value > 0) return value;
  }
  // Also check root-level keys
  for (const key of keys) {
    const value = Number(stats[key] ?? 0);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

export function getSubmissionMetricBundle(
  sub: AdminAnalyticsSubmission,
  contestPlatform?: string | null,
  contestBasedDetails?: unknown,
): { views: number; likes: number; comments: number; shares: number } {
  const platform = normalizeAnalyticsPlatform(
    sub.platform || contestPlatform,
    contestBasedDetails,
  );
  const stats = sub.other_stats ?? {};
  const directViews = Number(sub.views ?? 0);

  let views = directViews;
  if (platform === "instagram") {
    const igViews = nestedStat(stats, "instagram", ["views", "view_count"]);
    const reach = nestedStat(stats, "instagram", ["reach"]);
    if (Math.max(directViews, igViews) === 0 && reach > 0) views = reach;
    else views = Math.max(directViews, igViews);
  } else if (platform === "tiktok") {
    const fromStats = nestedStat(stats, "tiktok", ["view_count", "views"]);
    views = fromStats > 0 ? fromStats : Math.max(0, directViews);
  } else if (platform === "youtube") {
    const ytViews = nestedStat(stats, "youtube", ["views", "view_count"]);
    views = ytViews > 0 ? ytViews : Math.max(0, directViews);
  }

  return {
    views: Math.max(0, views),
    likes: nestedStat(stats, platform, ["likes", "like_count"]),
    comments: nestedStat(stats, platform, [
      "comments",
      "comment_count",
      "replies",
    ]),
    shares: nestedStat(stats, platform, ["shares", "share_count", "retweets"]),
  };
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(key: string): string {
  const d = new Date(`${key}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function isApprovedStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "verified" || s === "paid";
}

/** One GROUP BY row from admin_analytics_overview_daily (or equivalent). */
export type AdminAnalyticsDailyAggregateRow = {
  day_key: string;
  contest_id: string;
  status: string;
  submission_count: number;
  views_sum: number;
  likes_sum: number;
  comments_sum: number;
  shares_sum: number;
  payout_cents_sum: number;
  approved_count: number;
};

type AdminAnalyticsAggregateResult = {
  summary: AdminAnalyticsSummary;
  series: AdminAnalyticsSeriesPoint[];
  campaigns: { id: string; title: string }[];
  viewsByStatus: AdminAnalyticsViewsByStatus;
};

function matchingAnalyticsContests(input: {
  contests: AdminAnalyticsContest[];
  from: Date;
  to: Date;
  platforms: AdminAnalyticsPlatform[];
  contestTypes: AdminAnalyticsContestType[];
  contestIds: string[] | null;
  advertiserIds?: string[] | null;
}): AdminAnalyticsContest[] {
  const platformSet = new Set(input.platforms);
  const contestTypeSet = new Set(input.contestTypes);
  const contestIdFilter =
    input.contestIds == null ? null : new Set(input.contestIds);
  const advertiserIdFilter =
    input.advertiserIds == null ? null : new Set(input.advertiserIds);

  return input.contests.filter((c) => {
    if (contestIdFilter && !contestIdFilter.has(c.id)) return false;
    if (
      advertiserIdFilter &&
      (!c.advertiser_id || !advertiserIdFilter.has(c.advertiser_id))
    ) {
      return false;
    }
    if (!isApprovedAnalyticsContest(c)) return false;
    if (!contestOverlapsDateRange(c, input.from, input.to)) return false;
    const type = (c.contest_type ?? "").toLowerCase();
    if (!isAdminAnalyticsContestType(type) || !contestTypeSet.has(type)) {
      return false;
    }
    const p = normalizeAnalyticsPlatform(c.platform, c.contest_based_details);
    if (!isAdminAnalyticsPlatform(p)) return false;
    return platformSet.has(p);
  });
}

function buildCumulativeSeries(
  from: Date,
  to: Date,
  daily: Map<
    string,
    {
      views: number;
      likes: number;
      comments: number;
      shares: number;
      pendingViews: number;
      verifiedViews: number;
      paidViews: number;
      rejectedViews: number;
    }
  >,
): AdminAnalyticsSeriesPoint[] {
  const emptyDaily = () => ({
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    pendingViews: 0,
    verifiedViews: 0,
    paidViews: 0,
    rejectedViews: 0,
  });

  // Pre-fill days in range so the chart is continuous
  {
    const cursor = new Date(from);
    cursor.setUTCHours(12, 0, 0, 0);
    const end = new Date(to);
    end.setUTCHours(12, 0, 0, 0);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      if (!daily.has(key)) daily.set(key, emptyDaily());
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const sortedKeys = Array.from(daily.keys()).sort();
  let cumViews = 0;
  let cumLikes = 0;
  let cumComments = 0;
  let cumShares = 0;
  let cumPending = 0;
  let cumVerified = 0;
  let cumPaid = 0;
  let cumRejected = 0;
  return sortedKeys.map((key) => {
    const day = daily.get(key)!;
    cumViews += day.views;
    cumLikes += day.likes;
    cumComments += day.comments;
    cumShares += day.shares;
    cumPending += day.pendingViews;
    cumVerified += day.verifiedViews;
    cumPaid += day.paidViews;
    cumRejected += day.rejectedViews;
    return {
      date: key,
      label: formatDayLabel(key),
      views: cumViews,
      likes: cumLikes,
      comments: cumComments,
      shares: cumShares,
      pendingViews: cumPending,
      verifiedViews: cumVerified,
      paidViews: cumPaid,
      rejectedViews: cumRejected,
      notRejectedViews: cumPending + cumVerified + cumPaid,
      verifiedPaidViews: cumVerified + cumPaid,
    };
  });
}

/**
 * Fast path: build analytics from SQL daily GROUP BY rows
 * (admin_analytics_overview_daily) — no per-submission rows in Node.
 */
export function aggregateAdminAnalyticsFromDailyRows(input: {
  contests: AdminAnalyticsContest[];
  dailyRows: AdminAnalyticsDailyAggregateRow[];
  from: Date;
  to: Date;
  platforms: AdminAnalyticsPlatform[];
  contestTypes: AdminAnalyticsContestType[];
  contestIds: string[] | null;
  advertiserIds?: string[] | null;
  statuses: AdminAnalyticsBaseStatus[];
}): AdminAnalyticsAggregateResult {
  const statusSet = new Set(input.statuses);
  const matchingContests = matchingAnalyticsContests(input);
  const matchingContestIds = new Set(matchingContests.map((c) => c.id));

  const viewsByStatus: AdminAnalyticsViewsByStatus = {
    all: 0,
    pending: 0,
    verified: 0,
    paid: 0,
    rejected: 0,
    notRejected: 0,
    verifiedPaid: 0,
  };

  type DailyBucket = {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    pendingViews: number;
    verifiedViews: number;
    paidViews: number;
    rejectedViews: number;
  };

  const emptyDaily = (): DailyBucket => ({
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    pendingViews: 0,
    verifiedViews: 0,
    paidViews: 0,
    rejectedViews: 0,
  });

  const daily = new Map<string, DailyBucket>();
  let filteredViews = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let totalSubmissions = 0;
  let approvedSubmissions = 0;
  let totalPayoutsCents = 0;

  for (const row of input.dailyRows) {
    if (!matchingContestIds.has(row.contest_id)) continue;
    const day = String(row.day_key).slice(0, 10);
    if (!day) continue;

    const st = normalizeSubmissionStatus(row.status);
    const views = Math.max(0, Number(row.views_sum) || 0);
    const rowLikes = Math.max(0, Number(row.likes_sum) || 0);
    const rowComments = Math.max(0, Number(row.comments_sum) || 0);
    const rowShares = Math.max(0, Number(row.shares_sum) || 0);
    const count = Math.max(0, Number(row.submission_count) || 0);
    const approved = Math.max(0, Number(row.approved_count) || 0);
    const payouts = Math.max(0, Number(row.payout_cents_sum) || 0);

    viewsByStatus.all += views;
    if (st === "pending") viewsByStatus.pending += views;
    else if (st === "verified") viewsByStatus.verified += views;
    else if (st === "paid") viewsByStatus.paid += views;
    else if (st === "rejected") viewsByStatus.rejected += views;

    totalPayoutsCents += payouts;

    const bucket = daily.get(day) ?? emptyDaily();
    if (st === "pending") bucket.pendingViews += views;
    else if (st === "verified") bucket.verifiedViews += views;
    else if (st === "paid") bucket.paidViews += views;
    else if (st === "rejected") bucket.rejectedViews += views;

    if (st !== "unknown" && statusSet.has(st)) {
      filteredViews += views;
      likes += rowLikes;
      comments += rowComments;
      shares += rowShares;
      totalSubmissions += count;
      approvedSubmissions += approved;
      bucket.views += views;
      bucket.likes += rowLikes;
      bucket.comments += rowComments;
      bucket.shares += rowShares;
    }
    daily.set(day, bucket);
  }

  viewsByStatus.notRejected =
    viewsByStatus.pending + viewsByStatus.verified + viewsByStatus.paid;
  viewsByStatus.verifiedPaid = viewsByStatus.verified + viewsByStatus.paid;

  const series = buildCumulativeSeries(input.from, input.to, daily);
  const effectiveCpm = computeEffectiveCpmUsd(totalPayoutsCents, filteredViews);
  const approvalRate =
    totalSubmissions > 0
      ? Math.round((approvedSubmissions / totalSubmissions) * 100)
      : 0;

  const campaigns = matchingContests
    .map((c) => ({
      id: c.id,
      title: (c.title || "Untitled campaign").trim() || "Untitled campaign",
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    summary: {
      views: viewsByStatus.all,
      filteredViews,
      likes,
      comments,
      shares,
      totalPayoutsCents,
      effectiveCpm,
      totalSubmissions,
      approvedSubmissions,
      approvalRate,
    },
    series,
    campaigns,
    viewsByStatus,
  };
}

export function aggregateAdminAnalytics(input: {
  contests: AdminAnalyticsContest[];
  submissions: AdminAnalyticsSubmission[];
  from: Date;
  to: Date;
  platforms: AdminAnalyticsPlatform[];
  contestTypes: AdminAnalyticsContestType[];
  contestIds: string[] | null;
  advertiserIds?: string[] | null;
  statuses: AdminAnalyticsBaseStatus[];
}): AdminAnalyticsAggregateResult {
  const platformSet = new Set(input.platforms);
  const contestTypeSet = new Set(input.contestTypes);
  const statusSet = new Set(input.statuses);
  const contestIdFilter =
    input.contestIds == null ? null : new Set(input.contestIds);
  const advertiserIdFilter =
    input.advertiserIds == null ? null : new Set(input.advertiserIds);

  const contestById = new Map(input.contests.map((c) => [c.id, c] as const));

  const matchingContests = input.contests.filter((c) => {
    if (contestIdFilter && !contestIdFilter.has(c.id)) return false;
    if (
      advertiserIdFilter &&
      (!c.advertiser_id || !advertiserIdFilter.has(c.advertiser_id))
    ) {
      return false;
    }
    if (!isApprovedAnalyticsContest(c)) return false;
    if (!contestOverlapsDateRange(c, input.from, input.to)) return false;
    const type = (c.contest_type ?? "").toLowerCase();
    if (!isAdminAnalyticsContestType(type) || !contestTypeSet.has(type)) {
      return false;
    }
    const p = normalizeAnalyticsPlatform(c.platform, c.contest_based_details);
    if (!isAdminAnalyticsPlatform(p)) return false;
    return platformSet.has(p);
  });

  const matchingContestIds = new Set(matchingContests.map((c) => c.id));
  const fromMs = input.from.getTime();
  const toMs = input.to.getTime();

  const scopedSubs = input.submissions.filter((sub) => {
    if (!matchingContestIds.has(sub.contest_id)) return false;
    const t = new Date(sub.created_at).getTime();
    if (Number.isNaN(t) || t < fromMs || t > toMs) return false;
    const contest = contestById.get(sub.contest_id);
    const p = normalizeAnalyticsPlatform(
      sub.platform || contest?.platform,
      contest?.contest_based_details,
    );
    if (!isAdminAnalyticsPlatform(p)) return false;
    return platformSet.has(p);
  });

  const viewsByStatus: AdminAnalyticsViewsByStatus = {
    all: 0,
    pending: 0,
    verified: 0,
    paid: 0,
    rejected: 0,
    notRejected: 0,
    verifiedPaid: 0,
  };

  for (const sub of scopedSubs) {
    const contest = contestById.get(sub.contest_id);
    const metrics = getSubmissionMetricBundle(
      sub,
      contest?.platform,
      contest?.contest_based_details,
    );
    const st = normalizeSubmissionStatus(sub.status);
    viewsByStatus.all += metrics.views;
    if (st === "pending") viewsByStatus.pending += metrics.views;
    else if (st === "verified") viewsByStatus.verified += metrics.views;
    else if (st === "paid") viewsByStatus.paid += metrics.views;
    else if (st === "rejected") viewsByStatus.rejected += metrics.views;
  }
  viewsByStatus.notRejected =
    viewsByStatus.pending + viewsByStatus.verified + viewsByStatus.paid;
  viewsByStatus.verifiedPaid = viewsByStatus.verified + viewsByStatus.paid;

  const filteredSubs = scopedSubs.filter((sub) => {
    const st = normalizeSubmissionStatus(sub.status);
    if (st === "unknown") return false;
    return statusSet.has(st);
  });

  let filteredViews = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let approvedSubmissions = 0;
  let totalPayoutsFromEarnings = 0;

  type DailyBucket = {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    pendingViews: number;
    verifiedViews: number;
    paidViews: number;
    rejectedViews: number;
  };

  const emptyDaily = (): DailyBucket => ({
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    pendingViews: 0,
    verifiedViews: 0,
    paidViews: 0,
    rejectedViews: 0,
  });

  const daily = new Map<string, DailyBucket>();

  // Pre-fill days in range so the chart is continuous
  {
    const cursor = new Date(input.from);
    cursor.setUTCHours(12, 0, 0, 0);
    const end = new Date(input.to);
    end.setUTCHours(12, 0, 0, 0);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      daily.set(key, emptyDaily());
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  // Status breakdown series uses all scoped submissions (not status-filtered)
  for (const sub of scopedSubs) {
    const contest = contestById.get(sub.contest_id);
    const metrics = getSubmissionMetricBundle(
      sub,
      contest?.platform,
      contest?.contest_based_details,
    );
    const st = normalizeSubmissionStatus(sub.status);
    const key = dayKey(sub.created_at);
    if (!key) continue;
    const bucket = daily.get(key) ?? emptyDaily();
    if (st === "pending") bucket.pendingViews += metrics.views;
    else if (st === "verified") bucket.verifiedViews += metrics.views;
    else if (st === "paid") bucket.paidViews += metrics.views;
    else if (st === "rejected") bucket.rejectedViews += metrics.views;
    daily.set(key, bucket);

    // Total payouts: all paid earnings in range (not status-filtered)
    const paid =
      (sub.status ?? "").toLowerCase() === "paid" ||
      Number(sub.earnings || 0) > 0;
    if (paid) {
      totalPayoutsFromEarnings +=
        Number(sub.earnings || 0) + Number(sub.bonus_amount || 0);
    }
  }

  for (const sub of filteredSubs) {
    const contest = contestById.get(sub.contest_id);
    const metrics = getSubmissionMetricBundle(
      sub,
      contest?.platform,
      contest?.contest_based_details,
    );
    filteredViews += metrics.views;
    likes += metrics.likes;
    comments += metrics.comments;
    shares += metrics.shares;
    if (isApprovedStatus(sub.status)) approvedSubmissions += 1;

    const key = dayKey(sub.created_at);
    if (!key) continue;
    const bucket = daily.get(key) ?? emptyDaily();
    bucket.views += metrics.views;
    bucket.likes += metrics.likes;
    bucket.comments += metrics.comments;
    bucket.shares += metrics.shares;
    daily.set(key, bucket);
  }

  // Total Payouts (Gross): paid earnings + bonus in range (independent of status filter)
  const totalPayoutsCents = totalPayoutsFromEarnings;

  // Effective CPM = total payouts / views from selected statuses
  const effectiveCpm = computeEffectiveCpmUsd(
    totalPayoutsCents,
    filteredViews,
  );

  const totalSubmissions = filteredSubs.length;
  const approvalRate =
    totalSubmissions > 0
      ? Math.round((approvedSubmissions / totalSubmissions) * 100)
      : 0;

  // Cumulative series
  const sortedKeys = Array.from(daily.keys()).sort();
  let cumViews = 0;
  let cumLikes = 0;
  let cumComments = 0;
  let cumShares = 0;
  let cumPending = 0;
  let cumVerified = 0;
  let cumPaid = 0;
  let cumRejected = 0;
  const series: AdminAnalyticsSeriesPoint[] = sortedKeys.map((key) => {
    const day = daily.get(key)!;
    cumViews += day.views;
    cumLikes += day.likes;
    cumComments += day.comments;
    cumShares += day.shares;
    cumPending += day.pendingViews;
    cumVerified += day.verifiedViews;
    cumPaid += day.paidViews;
    cumRejected += day.rejectedViews;
    return {
      date: key,
      label: formatDayLabel(key),
      views: cumViews,
      likes: cumLikes,
      comments: cumComments,
      shares: cumShares,
      pendingViews: cumPending,
      verifiedViews: cumVerified,
      paidViews: cumPaid,
      rejectedViews: cumRejected,
      notRejectedViews: cumPending + cumVerified + cumPaid,
      verifiedPaidViews: cumVerified + cumPaid,
    };
  });

  const campaigns = matchingContests
    .map((c) => ({
      id: c.id,
      title: (c.title || "Untitled campaign").trim() || "Untitled campaign",
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    summary: {
      views: viewsByStatus.all,
      filteredViews,
      likes,
      comments,
      shares,
      totalPayoutsCents,
      effectiveCpm,
      totalSubmissions,
      approvedSubmissions,
      approvalRate,
    },
    series,
    campaigns,
    viewsByStatus,
  };
}

export function formatCpmDisplay(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(value >= 1 ? 2 : 3)}`;
}
