import { getCpmRateFromContest } from "@/lib/report-export-context";
import { computeEffectiveCpmUsd } from "@/lib/report-export-metrics";
import {
  getPoolBudgetCentsFromDetails,
  isCpmContestType,
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
};

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
};

export type AdminAnalyticsSummary = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  totalPayoutsCents: number;
  effectiveCpm: number | null;
  originalCpm: number | null;
  cpmEfficient: boolean | null;
  totalSubmissions: number;
  approvedSubmissions: number;
  approvalRate: number;
};

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

export function aggregateAdminAnalytics(input: {
  contests: AdminAnalyticsContest[];
  submissions: AdminAnalyticsSubmission[];
  from: Date;
  to: Date;
  platforms: AdminAnalyticsPlatform[];
  contestTypes: AdminAnalyticsContestType[];
  contestIds: string[] | null;
}): {
  summary: AdminAnalyticsSummary;
  series: AdminAnalyticsSeriesPoint[];
  campaigns: { id: string; title: string }[];
} {
  const platformSet = new Set(input.platforms);
  const contestTypeSet = new Set(input.contestTypes);
  const contestIdFilter =
    input.contestIds && input.contestIds.length > 0
      ? new Set(input.contestIds)
      : null;

  const contestById = new Map(input.contests.map((c) => [c.id, c] as const));

  const matchingContests = input.contests.filter((c) => {
    if (contestIdFilter && !contestIdFilter.has(c.id)) return false;
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

  const filteredSubs = input.submissions.filter((sub) => {
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

  let views = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let approvedSubmissions = 0;
  let totalPayoutsFromEarnings = 0;

  const daily = new Map<
    string,
    { views: number; likes: number; comments: number; shares: number }
  >();

  // Pre-fill days in range so the chart is continuous
  {
    const cursor = new Date(input.from);
    cursor.setUTCHours(12, 0, 0, 0);
    const end = new Date(input.to);
    end.setUTCHours(12, 0, 0, 0);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      daily.set(key, { views: 0, likes: 0, comments: 0, shares: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const viewsByContest = new Map<string, number>();

  for (const sub of filteredSubs) {
    const contest = contestById.get(sub.contest_id);
    const metrics = getSubmissionMetricBundle(
      sub,
      contest?.platform,
      contest?.contest_based_details,
    );
    views += metrics.views;
    likes += metrics.likes;
    comments += metrics.comments;
    shares += metrics.shares;
    if (isApprovedStatus(sub.status)) approvedSubmissions += 1;

    const paid =
      (sub.status ?? "").toLowerCase() === "paid" ||
      Number(sub.earnings || 0) > 0;
    if (paid) {
      totalPayoutsFromEarnings +=
        Number(sub.earnings || 0) + Number(sub.bonus_amount || 0);
    }

    viewsByContest.set(
      sub.contest_id,
      (viewsByContest.get(sub.contest_id) || 0) + metrics.views,
    );

    const key = dayKey(sub.created_at);
    if (!key) continue;
    const bucket = daily.get(key) ?? {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    };
    bucket.views += metrics.views;
    bucket.likes += metrics.likes;
    bucket.comments += metrics.comments;
    bucket.shares += metrics.shares;
    daily.set(key, bucket);
  }

  // Total Payouts (Gross): sum of paid earnings + bonus for submissions
  // in the selected date range (not campaign budgets).
  const totalPayoutsCents = totalPayoutsFromEarnings;

  // View-weighted average of target CPM rates
  let weightedCpmNum = 0;
  let weightedCpmDen = 0;
  for (const c of matchingContests) {
    if (!isCpmContestType(c.contest_type)) continue;
    const rate = getCpmRateFromContest(c.contest_based_details);
    if (rate == null || rate <= 0) continue;
    const cViews = viewsByContest.get(c.id) || 0;
    if (cViews <= 0) continue;
    weightedCpmNum += rate * cViews;
    weightedCpmDen += cViews;
  }
  const originalCpm =
    weightedCpmDen > 0 ? weightedCpmNum / weightedCpmDen : null;
  const effectiveCpm = computeEffectiveCpmUsd(totalPayoutsCents, views);
  const cpmEfficient =
    originalCpm != null && effectiveCpm != null
      ? effectiveCpm <= originalCpm
      : null;

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
  const series: AdminAnalyticsSeriesPoint[] = sortedKeys.map((key) => {
    const day = daily.get(key)!;
    cumViews += day.views;
    cumLikes += day.likes;
    cumComments += day.comments;
    cumShares += day.shares;
    return {
      date: key,
      label: formatDayLabel(key),
      views: cumViews,
      likes: cumLikes,
      comments: cumComments,
      shares: cumShares,
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
      views,
      likes,
      comments,
      shares,
      totalPayoutsCents,
      effectiveCpm,
      originalCpm,
      cpmEfficient,
      totalSubmissions,
      approvedSubmissions,
      approvalRate,
    },
    series,
    campaigns,
  };
}

export function formatCpmDisplay(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(value >= 1 ? 2 : 3)}`;
}
