import type { CreatorExportColumnId } from "@/lib/creator-leaderboard-export-columns";
import { CREATOR_EXPORT_COLUMN_LABELS } from "@/lib/creator-leaderboard-export-columns";
import {
  isDualRewardsContestType,
  isMilestoneContestType,
} from "@/lib/contest-type";
import { applyPayoutAdjustment } from "@/lib/payout-adjustment";
import { adjustBonusCents } from "@/lib/payout-rules";
import type { MilestoneMostVerifiedBonusCreatorRow } from "@/lib/milestone-contest-expected-spend";
import { centsToDollars } from "@/lib/currency-utils";
import { formatLocalDateTime } from "@/lib/utils";
import {
  formatInstagramInsightsForExport,
  instagramInsightsColumnHeaderSuffix,
  type InstagramInsightsExportSelection,
} from "@/lib/instagram-analytics-export";
import type { InstagramProfileSnapshot } from "@/lib/platform-social-archive";

const EMPTY_CELL = "\u2014";

function formatMetricValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return EMPTY_CELL;
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function formatWatchTime(milliseconds: number): string {
  if (!milliseconds || milliseconds === 0) return "0s";
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
  return `${seconds}s`;
}

function formatMoneyFromCents(cents: number): string {
  if (!cents || cents <= 0) return EMPTY_CELL;
  return `$${centsToDollars(cents).toFixed(2)}`;
}

function formatCreatorStatus(group: Record<string, unknown>): string {
  const counts = (group.statusCounts || {}) as Record<string, number>;
  const parts: string[] = [];
  if (counts.verified) parts.push(`Verified: ${counts.verified}`);
  if (counts.paid) parts.push(`Paid: ${counts.paid}`);
  if (counts.pending) parts.push(`Pending: ${counts.pending}`);
  if (counts.rejected) parts.push(`Rejected: ${counts.rejected}`);
  const mod = String(group.creator_moderation_status || "");
  if (mod && mod !== "pending" && parts.length === 0) {
    parts.push(mod);
  }
  return parts.length > 0 ? parts.join("; ") : EMPTY_CELL;
}

function formatInsightsCounts(group: Record<string, unknown>): string {
  const c = (group.insightsCounts || {}) as Record<string, number>;
  const parts: string[] = [];
  if (c.ok) parts.push(`Fetched successfully: ${c.ok}`);
  if (c.temporary_failure) {
    parts.push(`Temporary failure: ${c.temporary_failure}`);
  }
  if (c.permanent_failure) {
    parts.push(`Permanent failure: ${c.permanent_failure}`);
  }
  if (c.never) parts.push(`Never refreshed: ${c.never}`);
  return parts.length > 0 ? parts.join("\n") : EMPTY_CELL;
}

function extractMilestoneOrderFromLabel(label: string): number | null {
  const match = label.match(/Milestone\s+(\d+)/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export type CreatorDualCents = {
  totalCents: number;
  cpmCents: number;
  milestoneCents: number;
};

export type CreatorExportContext = {
  contestType?: string | null;
  payoutAdjustmentPct: number;
  showAdjustedReward: boolean;
  dualAdjustCpm: boolean;
  dualAdjustMilestone: boolean;
  cappedCpmMap: Map<string, number>;
  dualMilestoneMap: Map<string, number>;
  milestoneLabelMap: Map<string, string>;
  /** Sums per-submission dual granted breakdown (matches creator-wise table). */
  getDualGrantedForCreator?: (
    group: Record<string, unknown>,
  ) => CreatorDualCents;
  milestoneMostVerifiedBonusByCreator?: Map<
    string,
    MilestoneMostVerifiedBonusCreatorRow
  >;
  shouldAdjustMostVerifiedMilestoneBonus?: boolean;
  instagramInsightsSelection?: InstagramInsightsExportSelection | null;
  instagramArchiveByCreatorId?: Record<string, unknown> | null;
  instagramProfileByCreatorId?: Record<
    string,
    InstagramProfileSnapshot | null
  > | null;
};

function mvCreatorKey(group: Record<string, unknown>): string {
  const creator = (group.creator || {}) as { id?: string };
  return String(creator.id ?? "").trim();
}

function getMvBonusRow(
  group: Record<string, unknown>,
  ctx: CreatorExportContext,
): MilestoneMostVerifiedBonusCreatorRow | undefined {
  return ctx.milestoneMostVerifiedBonusByCreator?.get(mvCreatorKey(group));
}

function formatMvBonusCents(cents: number): string {
  return cents > 0 ? formatMoneyFromCents(cents) : EMPTY_CELL;
}

function sumDualExpectedForCreator(
  group: Record<string, unknown>,
  ctx: CreatorExportContext,
): CreatorDualCents {
  const subs = (group.submissions || []) as Array<{ id: string }>;
  let cpm = 0;
  let milestone = 0;
  for (const sub of subs) {
    cpm += ctx.cappedCpmMap.get(sub.id) ?? 0;
    milestone += ctx.dualMilestoneMap.get(sub.id) ?? 0;
  }
  return { totalCents: cpm + milestone, cpmCents: cpm, milestoneCents: milestone };
}

function sumDualAdjustedForCreator(
  group: Record<string, unknown>,
  ctx: CreatorExportContext,
): CreatorDualCents {
  const expected = sumDualExpectedForCreator(group, ctx);
  const cpmCents = ctx.dualAdjustCpm
    ? applyPayoutAdjustment(expected.cpmCents, ctx.payoutAdjustmentPct)
    : expected.cpmCents;
  const milestoneCents = ctx.dualAdjustMilestone
    ? applyPayoutAdjustment(expected.milestoneCents, ctx.payoutAdjustmentPct)
    : expected.milestoneCents;
  return {
    totalCents: cpmCents + milestoneCents,
    cpmCents,
    milestoneCents,
  };
}

function formatMilestoneCell(
  group: Record<string, unknown>,
  ctx: CreatorExportContext,
): string {
  const counts = new Map<number, number>();
  const subs = (group.submissions || []) as Array<{ id: string }>;
  for (const sub of subs) {
    const label = ctx.milestoneLabelMap.get(sub.id) ?? EMPTY_CELL;
    if (label === EMPTY_CELL) continue;
    const order = extractMilestoneOrderFromLabel(label);
    if (order == null) continue;
    counts.set(order, (counts.get(order) || 0) + 1);
  }
  if (counts.size === 0) return EMPTY_CELL;
  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([order, count]) => `Milestone ${order} (${count} sub)`)
    .join(", ");
}

export function buildCreatorExportCellValue(
  columnId: CreatorExportColumnId,
  group: Record<string, unknown>,
  rank: number,
  ctx: CreatorExportContext,
): string {
  const metrics = (group.metrics || {}) as Record<string, unknown>;
  const earnings = (group.earnings || {}) as {
    expected?: number;
    granted?: number;
  };
  const bonus = (group.bonus || {}) as { expected?: number; granted?: number };
  const creator = (group.creator || {}) as Record<string, unknown>;
  const primarySub = ((group.submissions || []) as Record<string, unknown>[])[0];
  const dualExpected = sumDualExpectedForCreator(group, ctx);
  const dualGranted = ctx.getDualGrantedForCreator?.(group) ?? {
    totalCents: Number(earnings.granted) || 0,
    cpmCents: 0,
    milestoneCents: 0,
  };

  switch (columnId) {
    case "rank":
      return String(rank);
    case "creator_name":
      return String(
        primarySub?.creator_display_name ||
          creator.full_name ||
          creator.username ||
          EMPTY_CELL,
      );
    case "creator_username":
      return String(
        (primarySub as Record<string, unknown>)?.user_username ||
          creator.username ||
          primarySub?.creator_username ||
          EMPTY_CELL,
      );
    case "total_submissions":
      return formatMetricValue(group.totalCount ?? 0);
    case "status_summary":
      return formatCreatorStatus(group);
    case "total_points": {
      const base = Number(metrics.base_points) || 0;
      const manual = Number(metrics.manual_points_adjustment) || 0;
      return formatMetricValue(base + manual);
    }
    case "base_points":
      return formatMetricValue(metrics.base_points ?? 0);
    case "manual_points":
      return formatMetricValue(metrics.tweet_manual_points_adjustment ?? 0);
    case "likes":
      return formatMetricValue(metrics.likes ?? 0);
    case "replies":
      return formatMetricValue(metrics.comments ?? 0);
    case "retweets":
      return formatMetricValue(metrics.retweets ?? 0);
    case "quote_reposts":
      return formatMetricValue(metrics.quote_reposts ?? 0);
    case "impressions":
      return formatMetricValue(metrics.impressions ?? 0);
    case "creator_manual_points":
      return formatMetricValue(metrics.creator_manual_points_adjustment ?? 0);
    case "manual_points_reason":
      return String(
        metrics.manual_points_reason || group.creator_rejection_reason || EMPTY_CELL,
      );
    case "views":
      return formatMetricValue(metrics.views ?? 0);
    case "comments":
      return formatMetricValue(metrics.comments ?? 0);
    case "shares":
      return formatMetricValue(metrics.shares ?? 0);
    case "saves":
      return formatMetricValue(metrics.saves ?? 0);
    case "reach":
      return formatMetricValue(metrics.reach ?? 0);
    case "interactions":
      return formatMetricValue(metrics.interactions ?? 0);
    case "avg_watch_time": {
      const total = Number(group.totalCount) || 0;
      const ms = Number(metrics.avg_watch_time_ms) || 0;
      return total > 0 && ms > 0
        ? formatWatchTime(Math.round(ms / total))
        : EMPTY_CELL;
    }
    case "total_watch_time":
      return formatWatchTime(Number(metrics.total_watch_time_ms) || 0);
    case "total_engagement": {
      const eng =
        (Number(metrics.likes) || 0) +
        (Number(metrics.comments) || 0) +
        (Number(metrics.shares) || 0);
      return formatMetricValue(eng);
    }
    case "engagement_rate": {
      const views = Number(metrics.views) || 0;
      const eng =
        (Number(metrics.likes) || 0) +
        (Number(metrics.comments) || 0) +
        (Number(metrics.shares) || 0);
      return views > 0
        ? `${Math.round((eng / views) * 10000) / 100}%`
        : EMPTY_CELL;
    }
    case "insights_status":
      return formatInsightsCounts(group);
    case "instagram_insights": {
      const creator = (group.creator || {}) as { id?: string };
      const creatorId = String(creator.id ?? "").trim();
      const archive =
        (creatorId && ctx.instagramArchiveByCreatorId?.[creatorId]) ??
        group.instagram_archive ??
        null;
      const text = formatInstagramInsightsForExport(
        archive,
        ctx.instagramInsightsSelection,
        creatorId
          ? (ctx.instagramProfileByCreatorId?.[creatorId] ?? null)
          : null,
      );
      return text || EMPTY_CELL;
    }
    case "expected_reward": {
      const cents = Number(earnings.expected) || 0;
      return formatMoneyFromCents(cents);
    }
    case "total_expected_reward":
      return formatMoneyFromCents(dualExpected.totalCents);
    case "expected_reward_cpm": {
      let cpm = dualExpected.cpmCents;
      if (ctx.dualAdjustCpm && ctx.showAdjustedReward) {
        /* pre-adjustment column */
      }
      return formatMoneyFromCents(cpm);
    }
    case "expected_reward_milestone":
      return formatMoneyFromCents(dualExpected.milestoneCents);
    case "adjusted_reward": {
      const cents = Number(earnings.expected) || 0;
      if (!ctx.showAdjustedReward || cents <= 0) return EMPTY_CELL;
      return formatMoneyFromCents(
        applyPayoutAdjustment(cents, ctx.payoutAdjustmentPct),
      );
    }
    case "total_adjusted_reward": {
      if (!ctx.dualAdjustCpm && !ctx.dualAdjustMilestone) return EMPTY_CELL;
      const adjusted = sumDualAdjustedForCreator(group, ctx);
      return formatMoneyFromCents(adjusted.totalCents);
    }
    case "adjusted_reward_cpm": {
      if (!ctx.dualAdjustCpm) return EMPTY_CELL;
      const adjusted = sumDualAdjustedForCreator(group, ctx);
      return formatMoneyFromCents(adjusted.cpmCents);
    }
    case "adjusted_reward_milestone": {
      if (!ctx.dualAdjustMilestone) return EMPTY_CELL;
      const adjusted = sumDualAdjustedForCreator(group, ctx);
      return formatMoneyFromCents(adjusted.milestoneCents);
    }
    case "reward_granted":
      return formatMoneyFromCents(Number(earnings.granted) || 0);
    case "total_reward_granted":
      return formatMoneyFromCents(
        dualGranted.totalCents || Number(earnings.granted) || 0,
      );
    case "reward_granted_cpm":
      return formatMoneyFromCents(dualGranted.cpmCents);
    case "reward_granted_milestone":
      return formatMoneyFromCents(dualGranted.milestoneCents);
    case "milestone":
      return formatMilestoneCell(group, ctx);
    case "bonus_expected":
      return formatMoneyFromCents(Number(bonus.expected) || 0);
    case "bonus_granted":
      return formatMoneyFromCents(Number(bonus.granted) || 0);
    case "mv_views_bonus_expected": {
      const row = getMvBonusRow(group, ctx);
      return formatMvBonusCents(row?.viewsExpectedCents ?? 0);
    }
    case "mv_views_bonus_adjusted": {
      const row = getMvBonusRow(group, ctx);
      const expected = row?.viewsExpectedCents ?? 0;
      if (expected <= 0) return EMPTY_CELL;
      return formatMvBonusCents(
        adjustBonusCents(expected, {
          shouldAdjustBonus: Boolean(ctx.shouldAdjustMostVerifiedMilestoneBonus),
          percentage: ctx.payoutAdjustmentPct,
        }),
      );
    }
    case "mv_views_bonus_granted": {
      const row = getMvBonusRow(group, ctx);
      return formatMvBonusCents(row?.viewsPaidCents ?? 0);
    }
    case "mv_reels_bonus_expected": {
      const row = getMvBonusRow(group, ctx);
      return formatMvBonusCents(row?.expectedCents ?? 0);
    }
    case "mv_reels_bonus_adjusted": {
      const row = getMvBonusRow(group, ctx);
      const expected = row?.expectedCents ?? 0;
      if (expected <= 0) return EMPTY_CELL;
      return formatMvBonusCents(
        adjustBonusCents(expected, {
          shouldAdjustBonus: Boolean(ctx.shouldAdjustMostVerifiedMilestoneBonus),
          percentage: ctx.payoutAdjustmentPct,
        }),
      );
    }
    case "mv_reels_bonus_granted": {
      const row = getMvBonusRow(group, ctx);
      return formatMvBonusCents(row?.paidCents ?? 0);
    }
    case "first_submitted":
      return group.firstSubmittedAt
        ? formatLocalDateTime(String(group.firstSubmittedAt))
        : EMPTY_CELL;
    case "rejection_reason":
      return String(group.creator_rejection_reason || EMPTY_CELL);
    default:
      return EMPTY_CELL;
  }
}

export function buildCreatorLeaderboardExportMatrix(
  groups: Record<string, unknown>[],
  columnIds: CreatorExportColumnId[],
  ctx: CreatorExportContext,
): { headers: string[]; rows: string[][] } {
  const headers = columnIds.map((id) => {
    const base = CREATOR_EXPORT_COLUMN_LABELS[id];
    if (id === "instagram_insights" && ctx.instagramInsightsSelection) {
      return `${base}${instagramInsightsColumnHeaderSuffix(ctx.instagramInsightsSelection)}`;
    }
    return base;
  });
  const rows = groups.map((group, index) =>
    columnIds.map((col) =>
      buildCreatorExportCellValue(col, group, index + 1, ctx),
    ),
  );
  return { headers, rows };
}
