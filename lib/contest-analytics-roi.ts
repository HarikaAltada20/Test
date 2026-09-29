import { getCampaignBudgetCents } from "@/lib/contest-budget-tile-metrics";
import {
  contestTypeForPlatform,
  getPersistedPlatformChargeableCents,
  isVideoContestPlatform,
  parseVideoContestPlatforms,
  readPersistedPlatformCampaigns,
  resolveCpmContestConfigForPlatform,
  resolveContestPlatformCpmRates,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

export type AnalyticsRoiContest = {
  contest_type?: string | null;
  contest_based_details?: Record<string, unknown> | null;
  platform?: string | null;
  post_contest_status?: string | null;
};

export type AnalyticsRoiSubmission = {
  views?: number | null;
  platform?: string | null;
};

function detailsOf(
  contest: AnalyticsRoiContest,
): Record<string, unknown> | null {
  const details = contest.contest_based_details;
  return details && typeof details === "object" ? details : null;
}

export function resolveAnalyticsRoiContestType(
  contest: AnalyticsRoiContest,
  scopedPlatform?: string | null,
): string | null | undefined {
  return contestTypeForPlatform(
    detailsOf(contest),
    scopedPlatform,
    contest.contest_type,
  );
}

/** Campaign budget / prize pool in cents for the Analytics ROI cards. */
export function getAnalyticsCampaignBudgetCents(
  contest: AnalyticsRoiContest,
  scopedPlatform?: string | null,
): number {
  const details = detailsOf(contest);
  const campaigns = readPersistedPlatformCampaigns(details);

  if (
    scopedPlatform &&
    isVideoContestPlatform(scopedPlatform) &&
    campaigns[scopedPlatform]
  ) {
    return getPersistedPlatformChargeableCents(campaigns[scopedPlatform]!);
  }

  const type = resolveAnalyticsRoiContestType(contest, scopedPlatform);
  return getCampaignBudgetCents({
    contest_type: type ?? contest.contest_type,
    contest_based_details: details,
    platform: contest.platform,
  });
}

export function getAnalyticsInvestmentNote(
  contestType: string | null | undefined,
  payoutsProcessed: boolean,
): string {
  if (payoutsProcessed) return "Expected Reward";
  if (contestType === "leaderboard") return "Prize Pool";
  return "Total Paid";
}

/**
 * Configured platform CPM ($ / 1,000 views). Multi-platform "All" is
 * view-weighted; a single platform tab uses that platform's rate.
 */
export function computeViewWeightedPlatformCpmUsd(
  submissions: AnalyticsRoiSubmission[],
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv?: string | null,
  scopedPlatform?: string | null,
): number | null {
  if (scopedPlatform) {
    const cfg = resolveCpmContestConfigForPlatform(
      details,
      scopedPlatform,
      contestPlatformCsv,
    );
    if (cfg && cfg.cpm_rate_usd > 0) return cfg.cpm_rate_usd;
  }

  const rates = resolveContestPlatformCpmRates(details, contestPlatformCsv);
  if (rates.length === 0) return null;

  if (scopedPlatform) {
    const match = rates.find((row) => row.platform === scopedPlatform);
    if (match && match.rateUsd > 0) return match.rateUsd;
    return null;
  }

  if (rates.length === 1) {
    return rates[0]!.rateUsd > 0 ? rates[0]!.rateUsd : null;
  }

  const rateByPlatform = new Map<VideoContestPlatform, number>(
    rates.map((row) => [row.platform, row.rateUsd]),
  );
  let weighted = 0;
  let viewsWithRate = 0;
  for (const sub of submissions) {
    const platform = parseVideoContestPlatforms(sub.platform)[0];
    const rate = platform ? rateByPlatform.get(platform) : undefined;
    const views = Number(sub.views) || 0;
    if (rate == null || !(rate > 0) || views <= 0) continue;
    weighted += views * rate;
    viewsWithRate += views;
  }
  if (viewsWithRate > 0) return weighted / viewsWithRate;

  const positive = rates.filter((row) => row.rateUsd > 0);
  if (positive.length === 0) return null;
  return (
    positive.reduce((sum, row) => sum + row.rateUsd, 0) / positive.length
  );
}

export function formatAnalyticsCpmUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0.00";
  return `$${value.toFixed(3)}`;
}

export function resolveAnalyticsExpectedCpmDisplay(options: {
  submissions: AnalyticsRoiSubmission[];
  details: Record<string, unknown> | null | undefined;
  contestPlatformCsv?: string | null;
  scopedPlatform?: string | null;
  expectedPayoutCents: number;
  totalViews: number;
}): { value: string; note: string } {
  const platformCpm = computeViewWeightedPlatformCpmUsd(
    options.submissions,
    options.details,
    options.contestPlatformCsv,
    options.scopedPlatform,
  );
  if (platformCpm != null && platformCpm > 0) {
    return {
      value: formatAnalyticsCpmUsd(platformCpm),
      note:
        options.scopedPlatform ||
        resolveContestPlatformCpmRates(
          options.details,
          options.contestPlatformCsv,
        ).length <= 1
          ? "Platform CPM rate"
          : "View-weighted platform CPM rate",
    };
  }

  if (options.totalViews <= 0) {
    return { value: "$0.00", note: "Expected reward ÷ views × 1000" };
  }
  const fallback =
    (options.expectedPayoutCents / 100 / options.totalViews) * 1000;
  return {
    value: formatAnalyticsCpmUsd(fallback),
    note: "Expected reward ÷ views × 1000",
  };
}
