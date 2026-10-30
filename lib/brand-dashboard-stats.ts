import {
  getContestRecognizedSpendCents,
  getContestEndedPaidEstimateCents,
  type ContestForRecognizedSpend,
} from "@/lib/brand-recognized-spend";

export type BrandDashboardContest = ContestForRecognizedSpend & {
  created_at?: string | null;
  published_at?: string | null;
  post_campaign_last_synced_at?: string | null;
};

export type BrandDashboardDateFilter = {
  from: Date;
  to: Date;
} | null;

function inDateRange(
  iso: string | null | undefined,
  range: BrandDashboardDateFilter,
): boolean {
  if (!range) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= range.from.getTime() && t <= range.to.getTime();
}

/** Contest “went live” timestamp: published_at, else created_at. */
function liveAt(contest: BrandDashboardContest): string | null {
  return contest.published_at || contest.created_at || null;
}

export function computeBrandDashboardContestStats(
  contests: BrandDashboardContest[],
  dateFilter: BrandDashboardDateFilter,
  endedPaidByContestId?: Map<string, number>,
): {
  campaignsPublished: number;
  liveCampaigns: number;
  /** Live/upcoming = budget; ended = actual paid. */
  budgetSpendCents: number;
  /** Creator payouts on ended campaigns (creators are only paid after a campaign ends). */
  paidCents: number;
} {
  // Published campaigns that went live inside the window
  const published = contests.filter(
    (c) =>
      c.moderation_status === "published" && inDateRange(liveAt(c), dateFilter),
  );

  const liveCampaigns = published.filter((c) => c.status === "active").length;

  const budgetSpendCents = published.reduce((sum, c) => {
    const override = endedPaidByContestId?.get(c.id);
    return sum + getContestRecognizedSpendCents(c, override);
  }, 0);

  const paidCents = published.reduce((sum, c) => {
    if (c.status !== "ended") return sum;
    const override = endedPaidByContestId?.get(c.id);
    if (typeof override === "number") return sum + Math.max(0, override);
    return sum + getContestEndedPaidEstimateCents(c);
  }, 0);

  return {
    campaignsPublished: published.length,
    liveCampaigns,
    budgetSpendCents,
    paidCents,
  };
}
