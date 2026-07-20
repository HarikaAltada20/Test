import {
  getSubmissionMetricBundle,
  normalizeAnalyticsPlatform,
  normalizeSubmissionStatus,
  type AdminAnalyticsBaseStatus,
} from "@/lib/admin-analytics";

export type BrandAnalyticsSeriesPoint = {
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
};

export type BrandAnalyticsGraphSummary = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

type BrandContest = {
  id: string;
  platform?: string | null;
  contest_type?: string | null;
  contest_based_details?: unknown;
};

type BrandSubmission = {
  id: string;
  contest_id: string;
  created_at: string;
  status: string | null;
  platform?: string | null;
  views?: number | null;
  other_stats?: Record<string, unknown> | null;
};

type BrandTwitterTweet = {
  contest_id?: string;
  tweet_created_at?: string | null;
  impressions?: number | null;
  likes?: number | null;
  replies?: number | null;
  moderation_status?: string | null;
};

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

function matchesStatusFilter(
  status: string | null | undefined,
  activeFilter: string,
): boolean {
  const normalized = normalizeSubmissionStatus(status);
  switch (activeFilter) {
    case "verified":
      return normalized === "verified";
    case "paid":
      return normalized === "paid";
    case "pending":
      return normalized === "pending";
    case "rejected":
      return normalized === "rejected";
    case "not_rejected":
      return normalized !== "rejected" && normalized !== "unknown";
    case "verifiedPaid":
      return normalized === "verified" || normalized === "paid";
    default:
      return normalized !== "unknown";
  }
}

function matchesTwitterStatus(
  status: string | null | undefined,
  activeFilter: string,
): boolean {
  const s = (status ?? "").toLowerCase();
  switch (activeFilter) {
    case "verified":
      return s === "verified";
    case "paid":
      return s === "paid";
    case "pending":
      return s === "pending";
    case "rejected":
      return s === "rejected";
    case "not_rejected":
      return s !== "rejected";
    case "verifiedPaid":
      return s === "verified" || s === "paid";
    default:
      return true;
  }
}

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

function emptyDaily(): DailyBucket {
  return {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    pendingViews: 0,
    verifiedViews: 0,
    paidViews: 0,
    rejectedViews: 0,
  };
}

export function buildBrandAnalyticsGraph(input: {
  contests: BrandContest[];
  submissions: BrandSubmission[];
  tweets?: BrandTwitterTweet[];
  from: Date;
  to: Date;
  activeFilter?: string;
  includeTwitter?: boolean;
}): { summary: BrandAnalyticsGraphSummary; series: BrandAnalyticsSeriesPoint[] } {
  const activeFilter = input.activeFilter ?? "all";
  const contestById = new Map(input.contests.map((c) => [c.id, c] as const));
  const fromMs = input.from.getTime();
  const toMs = input.to.getTime();
  const daily = new Map<string, DailyBucket>();

  const cursor = new Date(input.from);
  cursor.setUTCHours(12, 0, 0, 0);
  const end = new Date(input.to);
  end.setUTCHours(12, 0, 0, 0);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    daily.set(key, emptyDaily());
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const addStatusViews = (
    bucket: DailyBucket,
    status: AdminAnalyticsBaseStatus | "unknown",
    views: number,
  ) => {
    if (status === "pending") bucket.pendingViews += views;
    else if (status === "verified") bucket.verifiedViews += views;
    else if (status === "paid") bucket.paidViews += views;
    else if (status === "rejected") bucket.rejectedViews += views;
  };

  for (const sub of input.submissions) {
    if (!matchesStatusFilter(sub.status, activeFilter)) continue;
    const t = new Date(sub.created_at).getTime();
    if (Number.isNaN(t) || t < fromMs || t > toMs) continue;

    const contest = contestById.get(sub.contest_id);
    const metrics = getSubmissionMetricBundle(
      sub,
      contest?.platform,
      contest?.contest_based_details,
    );
    const key = dayKey(sub.created_at);
    if (!key) continue;

    const bucket = daily.get(key) ?? emptyDaily();
    bucket.views += metrics.views;
    bucket.likes += metrics.likes;
    bucket.comments += metrics.comments;
    bucket.shares += metrics.shares;
    addStatusViews(
      bucket,
      normalizeSubmissionStatus(sub.status),
      metrics.views,
    );
    daily.set(key, bucket);
  }

  if (input.includeTwitter && input.tweets?.length) {
    for (const tweet of input.tweets) {
      if (!tweet.contest_id || !tweet.tweet_created_at) continue;
      if (!matchesTwitterStatus(tweet.moderation_status, activeFilter)) continue;
      const t = new Date(tweet.tweet_created_at).getTime();
      if (Number.isNaN(t) || t < fromMs || t > toMs) continue;

      const views = Number(tweet.impressions ?? 0);
      const likes = Number(tweet.likes ?? 0);
      const comments = Number(tweet.replies ?? 0);
      const key = dayKey(tweet.tweet_created_at);
      if (!key) continue;

      const bucket = daily.get(key) ?? emptyDaily();
      bucket.views += views;
      bucket.likes += likes;
      bucket.comments += comments;
      addStatusViews(
        bucket,
        normalizeSubmissionStatus(tweet.moderation_status),
        views,
      );
      daily.set(key, bucket);
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

  const series: BrandAnalyticsSeriesPoint[] = sortedKeys.map((key) => {
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
    };
  });

  const last = series[series.length - 1];
  return {
    summary: {
      views: last?.views ?? 0,
      likes: last?.likes ?? 0,
      comments: last?.comments ?? 0,
      shares: last?.shares ?? 0,
    },
    series,
  };
}

export function normalizeBrandPlatformKey(contest: {
  platform?: string | null;
  contest_based_details?: unknown;
}): string {
  return normalizeAnalyticsPlatform(
    contest.platform,
    contest.contest_based_details,
  );
}
