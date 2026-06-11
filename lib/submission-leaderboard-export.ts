import type { SubmissionExportColumnId } from "@/lib/submission-leaderboard-export-columns";
import { SUBMISSION_EXPORT_COLUMN_LABELS } from "@/lib/submission-leaderboard-export-columns";
import {
  isCpmContestType,
  isDualRewardsContestType,
  isMilestoneContestType,
} from "@/lib/contest-type";
import { applyPayoutAdjustment } from "@/lib/payout-adjustment";
import { centsToDollars } from "@/lib/currency-utils";
import { formatLocalDateTime } from "@/lib/utils";
import { getFullRejectionDetails } from "@/lib/submission-metadata";
import {
  formatInstagramInsightsForExport,
  instagramInsightsColumnHeaderSuffix,
  type InstagramInsightsExportSelection,
} from "@/lib/instagram-analytics-export";
import type { InstagramProfileSnapshot } from "@/lib/platform-social-archive";
import { formatYouTubeAnalyticsForExport } from "@/lib/youtube-analytics-export";
import type { ExportReportBranding } from "@/lib/report-export-branding";
import type { ReportSubmissionFilter } from "@/lib/report-export-branding";
import {
  buildCreatorWiseSectionTitle,
  buildSubmissionsWiseSectionTitle,
} from "@/lib/report-export-branding";
import {
  buildCreatorProfileUrl,
  resolveExportContentUrl,
} from "@/lib/report-export-links";
import type { ReportCoverMetrics } from "@/lib/report-export-metrics";
import ExcelJS from "exceljs";
import {
  buildDataSheet,
  buildSummarySheet,
  downloadExcelBuffer,
  writeExcelWorkbook,
} from "@/lib/report-export-excel";
import {
  addPdfFooters,
  createPortraitPdfDoc,
  createPremiumPageTracker,
  markPremiumPage,
  renderPdfDataTable,
  renderPdfSectionDividerPage,
} from "@/lib/report-export-pdf";

export type LeaderboardExportFormat = "csv" | "xlsx" | "pdf";

export type LeaderboardExportOptions = {
  contestTitle?: string;
  exportedAt?: string;
  branding?: ExportReportBranding;
  metrics?: ReportCoverMetrics;
  approvedCount?: number;
  dataSheetName?: string;
  submissionSortLabel?: string;
  submissionFilter?: ReportSubmissionFilter;
  cellLinks?: (string | null)[][];
  platform?: string;
  rewardContext?: RewardExportContext;
};

/** Placeholder for empty cells in Excel/PDF; omitted in CSV (Excel mojibake fix). */
const EMPTY_CELL = "\u2014";

const YT_TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  SHORTS: "Shorts",
  YT_SEARCH: "YouTube Search",
  RELATED_VIDEO: "Related",
  YT_CHANNEL: "Channel",
  SUBSCRIBER: "Subscriber",
  EXT_URL: "External",
  NO_LINK_OTHER: "Direct",
  YT_OTHER_PAGE: "Other YT",
  PLAYLIST: "Playlist",
  NOTIFICATION: "Notifications",
  END_SCREEN: "End Screen",
  HASHTAGS: "Hashtags",
  SOUND_PAGE: "Sound",
  NO_LINK_EMBEDDED: "Embedded",
};

export type PlatformMetrics = Record<string, unknown>;

export type SubmissionDualCents = {
  totalCents: number;
  cpmCents: number;
  milestoneCents: number;
};

export type RewardExportContext = {
  contestType?: string | null;
  platform: string;
  contestFormat?: string | null;
  payoutAdjustmentPct: number;
  showAdjustedReward: boolean;
  dualAdjustCpm: boolean;
  dualAdjustMilestone: boolean;
  creatorRankingMap: Map<string, number>;
  leaderboardPrizes?: Array<{ position: number; amount: number }>;
  cappedCpmExpectedMap: Map<string, number>;
  dualMilestoneExpectedMap: Map<string, number>;
  milestoneExpectedMap: Map<string, number>;
  milestoneLabelMap: Map<string, string>;
  flatFeeBonusExpectedMap: Map<string, number>;
  getDualGrantedForSubmission?: (
    submission: Record<string, unknown>,
    rank: number,
  ) => SubmissionDualCents;
  ytCanSeeCore?: boolean;
  ytCanSeeTraffic?: boolean;
  ytCanSeeDemographics?: boolean;
  instagramInsightsSelection?: InstagramInsightsExportSelection | null;
  /** Fresh instagram_archive from DB (export); keyed by creator_id. */
  instagramArchiveByCreatorId?: Record<string, unknown> | null;
  /** Live profile fields from instagram_account (no tokens); keyed by creator_id. */
  instagramProfileByCreatorId?: Record<
    string,
    InstagramProfileSnapshot | null
  > | null;
};

function computeDualExpectedForSubmission(
  submission: Record<string, unknown>,
  ctx: RewardExportContext,
): SubmissionDualCents {
  const id = String(submission.id);
  const cpm = ctx.cappedCpmExpectedMap.get(id) ?? 0;
  const milestone =
    ctx.dualMilestoneExpectedMap.get(id) ??
    ctx.milestoneExpectedMap.get(id) ??
    0;
  return {
    totalCents: cpm + milestone,
    cpmCents: cpm,
    milestoneCents: milestone,
  };
}

function computeDualAdjustedForSubmission(
  submission: Record<string, unknown>,
  ctx: RewardExportContext,
): SubmissionDualCents {
  const expected = computeDualExpectedForSubmission(submission, ctx);
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
  return `$${centsToDollars(cents).toFixed(2)}`;
}

function insightsStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "ok":
      return "Fetched successfully";
    case "temporary_failure":
      return "Temporary failure";
    case "permanent_failure":
      return "Permanent failure";
    case null:
    case undefined:
      return "Never refreshed";
    default:
      return String(status);
  }
}

function topTrafficSourceLabel(
  trafficSources: Record<string, number> | null | undefined,
): string {
  if (!trafficSources || typeof trafficSources !== "object") return EMPTY_CELL;
  const entries = Object.entries(trafficSources);
  if (entries.length === 0) return EMPTY_CELL;
  const top = entries.reduce(
    (best, [k, v]) => (v > best.pct ? { key: k, pct: v } : best),
    { key: entries[0][0], pct: entries[0][1] },
  );
  const label = YT_TRAFFIC_SOURCE_LABELS[top.key] || top.key;
  return `${label} ${top.pct.toFixed(1)}%`;
}

function computeExpectedRewardCents(
  submission: Record<string, unknown>,
  rank: number,
  ctx: RewardExportContext,
): number {
  const contestType = ctx.contestType;
  if (contestType === "leaderboard" && ctx.leaderboardPrizes?.length) {
    const platform = ctx.platform.toLowerCase();
    const isTwitterLeaderboard =
      (platform === "twitter" || platform === "x") &&
      ctx.contestFormat === "text_image";
    const currentRank = isTwitterLeaderboard
      ? ctx.creatorRankingMap.get(String(submission.creator_id || "")) || 0
      : rank;
    if (currentRank > 0) {
      const prize = ctx.leaderboardPrizes.find(
        (p) => p.position === currentRank,
      );
      if (prize) return Number(prize.amount) || 0;
    }
    return 0;
  }

  if (
    isCpmContestType(contestType) ||
    isMilestoneContestType(contestType) ||
    isDualRewardsContestType(contestType)
  ) {
    const id = String(submission.id);
    const milestoneCents = isDualRewardsContestType(contestType)
      ? (ctx.dualMilestoneExpectedMap.get(id) ??
        ctx.milestoneExpectedMap.get(id) ??
        0)
      : (ctx.milestoneExpectedMap.get(id) ?? 0);
    const cpmCents = ctx.cappedCpmExpectedMap.get(id) ?? 0;
    return cpmCents + milestoneCents;
  }

  return 0;
}

function submissionStatusLabel(submission: Record<string, unknown>): string {
  const isTwitter = submission.is_twitter_tweet === true;
  const raw = isTwitter
    ? String(submission.moderation_status || submission.status || "pending")
    : String(submission.status || "pending");
  return raw;
}

export function buildSubmissionExportCellValue(
  columnId: SubmissionExportColumnId,
  submission: Record<string, unknown>,
  rank: number,
  metrics: PlatformMetrics,
  ctx: RewardExportContext,
): string {
  switch (columnId) {
    case "rank":
      return String(rank);
    case "creator_name": {
      const creator = submission.creator as
        | { full_name?: string | null }
        | undefined;
      return String(
        submission.creator_display_name || creator?.full_name || EMPTY_CELL,
      );
    }
    case "creator_username": {
      const creator = submission.creator as
        | { username?: string | null }
        | undefined;
      return String(
        submission.creator_username ||
          submission.user_username ||
          creator?.username ||
          EMPTY_CELL,
      );
    }
    case "content_link": {
      const resolved = resolveExportContentUrl(
        String(submission.content_link || ""),
        ctx.platform,
        submission.video_id as string | null | undefined,
      );
      return resolved ?? String(submission.content_link || EMPTY_CELL);
    }
    case "video_title":
      return String(submission.video_title || EMPTY_CELL);
    case "tweet_excerpt": {
      const stats = (submission.other_stats || {}) as Record<string, unknown>;
      const text = String(
        stats.tweet_text ?? stats.text ?? stats.full_text ?? submission.video_title ?? "",
      ).trim();
      if (!text) return EMPTY_CELL;
      return text;
    }
    case "total_points": {
      const stats = (submission.other_stats || {}) as Record<string, unknown>;
      const pts = stats.points;
      if (pts != null) return formatMetricValue(pts);
      const base = Number(stats.base_points) || 0;
      const manual = Number(submission.manual_points_adjustment) || 0;
      return formatMetricValue(base + manual);
    }
    case "base_points":
      return formatMetricValue(
        (submission.other_stats as Record<string, unknown>)?.base_points ?? 0,
      );
    case "manual_points":
      return formatMetricValue(submission.manual_points_adjustment ?? 0);
    case "manual_points_reason":
      return String(submission.manual_points_reason || EMPTY_CELL);
    case "replies":
      return formatMetricValue(
        (submission.other_stats as Record<string, unknown>)?.replies ?? 0,
      );
    case "retweets":
      return formatMetricValue(
        (submission.other_stats as Record<string, unknown>)?.retweets ?? 0,
      );
    case "quote_reposts":
      return formatMetricValue(
        (submission.other_stats as Record<string, unknown>)?.quote_reposts ?? 0,
      );
    case "impressions":
      return formatMetricValue(
        (submission.other_stats as Record<string, unknown>)?.impressions ??
          metrics.impressions ??
          0,
      );
    case "views":
      return formatMetricValue(metrics.views);
    case "likes":
      return formatMetricValue(metrics.likes);
    case "comments":
      return formatMetricValue(metrics.comments);
    case "dislikes":
      return formatMetricValue(metrics.dislikes);
    case "shares":
      return formatMetricValue(metrics.shares);
    case "avg_view_pct": {
      const pct = Number(metrics.avg_view_percentage);
      return pct > 0 ? `${pct.toFixed(1)}%` : EMPTY_CELL;
    }
    case "watch_time": {
      const mins = Number(metrics.estimated_minutes_watched);
      return mins > 0
        ? formatWatchTime(mins * 60 * 1000)
        : formatWatchTime(Number(metrics.total_watch_time_ms) || 0);
    }
    case "avg_duration": {
      const sec = Number(metrics.avg_view_duration_seconds);
      return sec > 0 ? `${sec}s` : EMPTY_CELL;
    }
    case "engaged_views":
      return formatMetricValue(metrics.engaged_views);
    case "subs_gained": {
      const n = metrics.subscribers_gained;
      if (n == null) return EMPTY_CELL;
      const num = Number(n);
      return num > 0 ? `+${num}` : String(num);
    }
    case "bot_score": {
      if (metrics.bot_score == null) return EMPTY_CELL;
      const flags = (metrics.bot_flags as string[] | undefined)?.length ?? 0;
      return `${metrics.bot_score}/100 (${flags} flags)`;
    }
    case "top_traffic_source":
      return topTrafficSourceLabel(
        metrics.traffic_sources as Record<string, number> | undefined,
      );
    case "youtube_analytics": {
      const text = formatYouTubeAnalyticsForExport(submission, metrics, {
        showCore: ctx.ytCanSeeCore !== false,
        showTraffic: ctx.ytCanSeeTraffic !== false,
        showDemographics: Boolean(ctx.ytCanSeeDemographics),
      });
      return text || EMPTY_CELL;
    }
    case "insights_status":
      return insightsStatusLabel(
        submission.insights_status as string | null | undefined,
      );
    case "instagram_insights": {
      const creator = submission.creator as
        | { id?: string; instagram_archive?: unknown }
        | undefined;
      const creatorId = String(
        submission.creator_id ?? creator?.id ?? "",
      ).trim();
      const archive =
        (creatorId && ctx.instagramArchiveByCreatorId?.[creatorId]) ??
        submission.creator_instagram_archive ??
        creator?.instagram_archive ??
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
    case "saves":
      return formatMetricValue(metrics.saves);
    case "reach":
      return formatMetricValue(metrics.reach);
    case "interactions":
      return formatMetricValue(metrics.total_interactions);
    case "avg_watch_time":
      return formatWatchTime(Number(metrics.avg_watch_time_ms) || 0);
    case "total_watch_time":
      return formatWatchTime(Number(metrics.total_watch_time_ms) || 0);
    case "total_interactions":
      return formatMetricValue(metrics.total_interactions);
    case "engagement_rate": {
      const rate = Number(metrics.engagement_rate);
      return rate > 0 ? `${rate}%` : EMPTY_CELL;
    }
    case "expected_reward": {
      const cents = computeExpectedRewardCents(submission, rank, ctx);
      return cents > 0 ? formatMoneyFromCents(cents) : EMPTY_CELL;
    }
    case "total_expected_reward": {
      const d = computeDualExpectedForSubmission(submission, ctx);
      return formatMoneyFromCents(d.totalCents);
    }
    case "expected_reward_cpm": {
      const d = computeDualExpectedForSubmission(submission, ctx);
      return formatMoneyFromCents(d.cpmCents);
    }
    case "expected_reward_milestone": {
      const d = computeDualExpectedForSubmission(submission, ctx);
      return formatMoneyFromCents(d.milestoneCents);
    }
    case "total_adjusted_reward": {
      if (!ctx.dualAdjustCpm && !ctx.dualAdjustMilestone) return EMPTY_CELL;
      const d = computeDualAdjustedForSubmission(submission, ctx);
      return formatMoneyFromCents(d.totalCents);
    }
    case "adjusted_reward_cpm": {
      if (!ctx.dualAdjustCpm) return EMPTY_CELL;
      const d = computeDualAdjustedForSubmission(submission, ctx);
      return formatMoneyFromCents(d.cpmCents);
    }
    case "adjusted_reward_milestone": {
      if (!ctx.dualAdjustMilestone) return EMPTY_CELL;
      const d = computeDualAdjustedForSubmission(submission, ctx);
      return formatMoneyFromCents(d.milestoneCents);
    }
    case "milestone": {
      const label = ctx.milestoneLabelMap.get(String(submission.id));
      return label && label !== EMPTY_CELL ? label : EMPTY_CELL;
    }
    case "total_reward_granted": {
      const g =
        ctx.getDualGrantedForSubmission?.(submission, rank) ??
        ({
          totalCents: Number(submission.earnings) || 0,
          cpmCents: 0,
          milestoneCents: 0,
        } as SubmissionDualCents);
      return formatMoneyFromCents(g.totalCents);
    }
    case "reward_granted_cpm": {
      const g = ctx.getDualGrantedForSubmission?.(submission, rank);
      return formatMoneyFromCents(g?.cpmCents ?? 0);
    }
    case "reward_granted_milestone": {
      const g = ctx.getDualGrantedForSubmission?.(submission, rank);
      return formatMoneyFromCents(g?.milestoneCents ?? 0);
    }
    case "adjusted_reward": {
      const cents = computeExpectedRewardCents(submission, rank, ctx);
      if (!ctx.showAdjustedReward || cents <= 0) return EMPTY_CELL;
      const adjusted = applyPayoutAdjustment(cents, ctx.payoutAdjustmentPct);
      return formatMoneyFromCents(adjusted);
    }
    case "reward_granted": {
      if (submission.status === "paid") {
        const earnings = Number(submission.earnings) || 0;
        if (earnings > 0) return formatMoneyFromCents(earnings);
        const platform = ctx.platform.toLowerCase();
        const isTwitterLeaderboard =
          (platform === "twitter" || platform === "x") &&
          ctx.contestFormat === "text_image" &&
          ctx.contestType === "leaderboard";
        if (isTwitterLeaderboard) {
          const creatorRank = ctx.creatorRankingMap.get(
            String(submission.creator_id || ""),
          );
          if (creatorRank && ctx.leaderboardPrizes?.length) {
            const prize = ctx.leaderboardPrizes.find(
              (p) => p.position === creatorRank,
            );
            if (prize) return formatMoneyFromCents(Number(prize.amount));
          }
        }
        return "Paid";
      }
      const pending = Number(submission.earnings) || 0;
      return pending > 0 ? formatMoneyFromCents(pending) : EMPTY_CELL;
    }
    case "bonus_expected": {
      const cents = ctx.flatFeeBonusExpectedMap.get(String(submission.id)) ?? 0;
      return cents > 0 ? formatMoneyFromCents(cents) : EMPTY_CELL;
    }
    case "bonus_granted": {
      const bonus = Number(submission.bonus_amount) || 0;
      if (submission.bonus_paid && bonus > 0) {
        return formatMoneyFromCents(bonus);
      }
      return EMPTY_CELL;
    }
    case "status":
      return submissionStatusLabel(submission);
    case "submitted":
      return submission.created_at
        ? formatLocalDateTime(String(submission.created_at))
        : EMPTY_CELL;
    case "rejection_reason": {
      const details = getFullRejectionDetails(submission.metadata);
      if (details) {
        const parts = [details.reason];
        if (details.additionalNotes) parts.push(details.additionalNotes);
        return parts.join(" - ");
      }
      return String(submission.creator_rejection_reason || EMPTY_CELL);
    }
    default:
      return EMPTY_CELL;
  }
}

export function buildLeaderboardExportMatrix(
  submissions: Record<string, unknown>[],
  columnIds: SubmissionExportColumnId[],
  getMetrics: (submission: Record<string, unknown>) => PlatformMetrics,
  rewardCtx: RewardExportContext,
): { headers: string[]; rows: string[][]; cellLinks: (string | null)[][] } {
  const headers = columnIds.map((id) => {
    const base = SUBMISSION_EXPORT_COLUMN_LABELS[id];
    if (id === "instagram_insights" && rewardCtx.instagramInsightsSelection) {
      return `${base}${instagramInsightsColumnHeaderSuffix(rewardCtx.instagramInsightsSelection)}`;
    }
    return base;
  });
  const rows = submissions.map((submission, index) => {
    const rank = index + 1;
    const metrics = getMetrics(submission);
    return columnIds.map((col) =>
      buildSubmissionExportCellValue(col, submission, rank, metrics, rewardCtx),
    );
  });
  const cellLinks = submissions.map((submission, index) => {
    const rank = index + 1;
    const metrics = getMetrics(submission);
    return columnIds.map((col) => {
      const display = buildSubmissionExportCellValue(
        col,
        submission,
        rank,
        metrics,
        rewardCtx,
      );
      if (col === "content_link") {
        return resolveExportContentUrl(
          String(submission.content_link || ""),
          rewardCtx.platform,
          submission.video_id as string | null | undefined,
        );
      }
      if (col === "creator_username") {
        return buildCreatorProfileUrl(display, rewardCtx.platform);
      }
      return null;
    });
  });
  return { headers, rows, cellLinks };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeCsvCell(value: string): string {
  if (value === EMPTY_CELL) return "";
  return value.replace(/\u2014/g, "-");
}

function csvEscape(cell: string): string {
  const s = sanitizeCsvCell(cell);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const PDF_UNICODE_FONT_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/roboto@3.012/hinted/Roboto-Regular.ttf";

/** Strip characters jsPDF standard fonts cannot render (fallback path). */
function toLatinPdfFallback(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\t\n\r\x20-\xFF]/g, "");
}

/** Normalize cell text for PDF (keep Unicode when custom font is loaded). */
function normalizePdfText(text: string, preserveLineBreaks = false): string {
  let s = sanitizeCsvCell(text)
    .replace(/\u2014/g, "-")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/gu, "");
  if (preserveLineBreaks) {
    return s
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }
  return s.replace(/\s+/g, " ").trim();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Roboto supports international names; default Helvetica shows mojibake. */
async function registerPdfUnicodeFont(
  doc: {
    addFileToVFS: (fileName: string, fileContent: string) => void;
    addFont: (
      postScriptName: string,
      id: string,
      fontStyle: string,
      fontWeight?: string | number,
    ) => string;
    setFont: (fontName: string, fontStyle?: string) => void;
  },
): Promise<string> {
  try {
    const res = await fetch(PDF_UNICODE_FONT_URL);
    if (!res.ok) return "helvetica";
    const base64 = arrayBufferToBase64(await res.arrayBuffer());
    doc.addFileToVFS("Roboto-Regular.ttf", base64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.setFont("Roboto", "normal");
    return "Roboto";
  } catch {
    return "helvetica";
  }
}

/** Prevent single-character vertical stacks when many columns are exported to PDF. */
function preparePdfBodyCell(
  cell: string,
  maxLen: number,
  useUnicodeFont: boolean,
  preserveLineBreaks = false,
): string {
  let s = normalizePdfText(cell, preserveLineBreaks);
  if (!useUnicodeFont) s = toLatinPdfFallback(s);
  if (!s) return "";
  if (preserveLineBreaks && maxLen >= 4000) return s;
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

function isTweetExportColumn(header: string): boolean {
  return /^tweet$/i.test(header.trim());
}

/** Break long tweet text into lines for Excel (wrap text is not set in community xlsx). */
function wrapTextAtWords(text: string, maxLineLen = 48): string {
  const s = text.trim();
  if (!s || s.length <= maxLineLen) return s;
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxLineLen) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (word.length > maxLineLen) {
      for (let i = 0; i < word.length; i += maxLineLen) {
        lines.push(word.slice(i, i + maxLineLen));
      }
      line = "";
    } else {
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

/** Relative width weight so all columns share exactly one page width. */
function estimatePdfColumnWeight(header: string): number {
  const h = header.toLowerCase();
  if (/^rank$/.test(h.trim())) return 0.85;
  if (
    /analytics|traffic sources|demographics|top countries|instagram insights/i.test(
      h,
    )
  ) {
    return 2.4;
  }
  if (isTweetExportColumn(h)) return 2.3;
  if (/link|url|content/.test(h)) return 1.6;
  if (/title|excerpt/.test(h)) return 1.9;
  if (/reason|summary/.test(h)) return 1.7;
  if (/insights status/.test(h)) return 1.35;
  if (/milestone/.test(h)) return 1.5;
  if (/reward|bonus|granted|expected|adjusted/.test(h)) return 1.25;
  if (/submitted|date|time|watch/.test(h)) return 1.15;
  if (/status/.test(h)) return 0.95;
  if (/username|creator/.test(h) && !/manual|points/.test(h)) return 1.1;
  if (
    /views|likes|comments|shares|saves|reach|points|impressions|engagement|retweets|replies|submissions/.test(
      h,
    )
  ) {
    return 0.9;
  }
  return 1;
}

function isPdfNumericColumn(header: string): boolean {
  const hl = header.toLowerCase();
  return (
    /^rank$/.test(hl.trim()) ||
    (/views|likes|comments|shares|points|impressions|rate|score|amount|submissions|reach|saves|retweets|replies|engagement/.test(
      hl,
    ) &&
      !/reason|title|link|name|username|summary|milestone|excerpt|creator/.test(
        hl,
      )) ||
    (/reward|bonus|granted|expected|adjusted/.test(hl) &&
      !/reason|summary/.test(hl))
  );
}

/** Fit every column on a single landscape page width (rows may span pages vertically). */
function buildPdfColumnStyles(
  headers: string[],
  tableWidth: number,
): Record<
  number,
  { cellWidth: number; overflow: "linebreak"; halign: "left" | "right" | "center" }
> {
  const weights = headers.map((h) => estimatePdfColumnWeight(h));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const styles: Record<
    number,
    { cellWidth: number; overflow: "linebreak"; halign: "left" | "right" | "center" }
  > = {};

  headers.forEach((header, colIndex) => {
    styles[colIndex] = {
      cellWidth: (weights[colIndex]! / weightSum) * tableWidth,
      overflow: "linebreak",
      halign: isPdfNumericColumn(header) ? "right" : "left",
    };
  });

  return styles;
}

/** Wider landscape page when many columns — all columns still on one page width. */
function getPdfLandscapeLayout(columnCount: number): {
  pageFormat: string | [number, number];
  pageWidth: number;
  tableWidth: number;
  marginX: number;
} {
  const marginX = 28;
  const minColWidthPt =
    columnCount > 28 ? 54 : columnCount > 20 ? 62 : columnCount > 12 ? 70 : 80;
  const neededPageWidth = columnCount * minColWidthPt + marginX * 2;

  // Landscape page widths (pt): A4 842, A3 1191, A2 1684, A1 2384, A0 3370
  let pageWidth = 842;
  let pageFormat: string | [number, number] = "a4";

  if (neededPageWidth <= 842) {
    // A3 landscape for 5+ columns — more readable Creator / URL / Title columns
    if (columnCount <= 4) {
      pageWidth = 842;
      pageFormat = "a4";
    } else {
      pageWidth = 1191;
      pageFormat = "a3";
    }
  } else if (neededPageWidth <= 1191) {
    pageWidth = 1191;
    pageFormat = "a3";
  } else if (neededPageWidth <= 1684) {
    pageWidth = 1684;
    pageFormat = "a2";
  } else if (neededPageWidth <= 2384) {
    pageWidth = 2384;
    pageFormat = "a1";
  } else {
    pageWidth = Math.min(neededPageWidth, 3400);
    pageFormat = [pageWidth, 595];
  }

  return {
    pageFormat,
    pageWidth,
    tableWidth: pageWidth - marginX * 2,
    marginX,
  };
}

function pickPdfFontSize(columnCount: number, pageWidth: number): number {
  const colWidth = (pageWidth - 56) / Math.max(columnCount, 1);
  if (colWidth >= 90) return 9;
  if (colWidth >= 72) return 8;
  if (columnCount > 28) return 6;
  if (columnCount > 22) return 6.5;
  if (columnCount > 16) return 7;
  if (columnCount > 10) return 7.5;
  return 8;
}

function pickPdfCellPadding(columnCount: number): number {
  if (columnCount > 22) return 2;
  if (columnCount > 14) return 3;
  return 4;
}

function pickPdfCellMaxLen(
  columnCount: number,
  header: string,
  colWidthPt: number,
): number {
  const wide = colWidthPt >= 100;
  const medium = colWidthPt >= 70;
  if (
    /youtube_analytics|^analytics$|traffic sources|demographics|top countries|instagram insights/i.test(
      header,
    )
  ) {
    return 8000;
  }
  if (/link|url|content/i.test(header)) {
    if (wide) return 200;
    if (medium) return 120;
    if (columnCount > 20) return 56;
    return 80;
  }
  if (/insights status/i.test(header)) {
    return 500;
  }
  if (isTweetExportColumn(header)) {
    return 8000;
  }
  if (/title|excerpt|reason|summary|milestone/i.test(header)) {
    if (wide) return 240;
    if (medium) return 140;
    if (columnCount > 20) return 56;
    return 100;
  }
  if (/creator|username|name/i.test(header)) {
    if (wide) return 80;
    if (medium) return 56;
    if (columnCount > 20) return 40;
    return 64;
  }
  if (wide) return 48;
  if (medium) return 36;
  if (columnCount > 20) return 28;
  return 40;
}

/** Insert line breaks so PDF headers wrap instead of ellipsizing (…). */
function wrapPdfHeaderLabel(
  header: string,
  colWidthPt: number,
  fontSizePt: number,
): string {
  const padding = 8;
  const approxCharWidth = Math.max(2.5, fontSizePt * 0.48);
  const charsPerLine = Math.max(
    3,
    Math.floor((colWidthPt - padding) / approxCharWidth),
  );
  if (header.length <= charsPerLine) return header;

  const words = header.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= charsPerLine) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (word.length > charsPerLine) {
      for (let i = 0; i < word.length; i += charsPerLine) {
        lines.push(word.slice(i, i + charsPerLine));
      }
      line = "";
    } else {
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

export async function downloadLeaderboardReport(
  format: LeaderboardExportFormat,
  filenameBase: string,
  headers: string[],
  rows: string[][],
  options?: LeaderboardExportOptions,
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const safeBase = filenameBase.replace(/[^\w\-]+/g, "_").slice(0, 80);
  const meta = options;
  const dataSheetName = options?.dataSheetName ?? "Data";

  if (format === "csv") {
    const lines: string[] = [];
    if (options?.branding) {
      lines.push(
        options.branding.reportTitle,
        `Prepared for,${csvEscape(options.branding.brandCompanyName)}`,
        `Campaign,${csvEscape(options.branding.contestTitle)}`,
        `Exported,${csvEscape(options.branding.exportedAt)}`,
        "",
      );
    } else if (meta?.contestTitle) {
      lines.push(meta.contestTitle, "");
    }
    lines.push(headers.map(csvEscape).join(","));
    lines.push(...rows.map((r) => r.map(csvEscape).join(",")));
    const blob = new Blob(["\uFEFF", lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    downloadBlob(blob, `${safeBase}-${date}.csv`);
    return;
  }

  if (format === "xlsx") {
    if (options?.branding && options?.metrics) {
      const workbook = new ExcelJS.Workbook();
      await buildSummarySheet(
        workbook,
        options.branding,
        options.metrics,
        options.approvedCount ?? 0,
      );
      buildDataSheet(workbook, dataSheetName, headers, rows, {
        cellLinks: options?.cellLinks,
        platform: options?.platform,
      });
      const buffer = await writeExcelWorkbook(workbook);
      downloadExcelBuffer(buffer, `${safeBase}-${date}.xlsx`);
      return;
    }

    const XLSX = await import("xlsx");
    const sheetData: string[][] = [];
    if (meta?.contestTitle) {
      sheetData.push([meta.contestTitle]);
      sheetData.push([]);
    }
    sheetData.push(headers, ...rows);
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = headers.map((h) => {
      if (
        /analytics|traffic sources|demographics|top countries|instagram insights/i.test(
          h,
        )
      ) {
        return { wch: 48 };
      }
      if (/insights status/i.test(h)) {
        return { wch: 28 };
      }
      if (isTweetExportColumn(h)) {
        return { wch: 72 };
      }
      if (/link|url|content|title|excerpt|reason/i.test(h)) {
        return { wch: 36 };
      }
      return { wch: 14 };
    });
    const tweetColIdx = headers.findIndex((h) => isTweetExportColumn(h));
    if (tweetColIdx >= 0) {
      const headerRowIndex = meta?.contestTitle ? 2 : 0;
      for (let r = 0; r < rows.length; r++) {
        const ref = XLSX.utils.encode_cell({
          r: headerRowIndex + 1 + r,
          c: tweetColIdx,
        });
        const cell = ws[ref];
        if (!cell) continue;
        const wrapped = wrapTextAtWords(String(cell.v ?? ""));
        if (wrapped !== cell.v) {
          cell.v = wrapped;
          cell.w = wrapped;
        }
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, dataSheetName.slice(0, 31));
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `${safeBase}-${date}.xlsx`);
    return;
  }

  if (options?.branding && options?.metrics) {
    const { doc, fonts } = await createPortraitPdfDoc();
    const premiumPages = createPremiumPageTracker();

    const submissionFilter = options.submissionFilter ?? "verified_or_paid";
    const sectionTitle =
      options.branding.reportType === "creator-wise"
        ? buildCreatorWiseSectionTitle(submissionFilter)
        : buildSubmissionsWiseSectionTitle(submissionFilter);
    const summaryLines =
      options.branding.reportType === "creator-wise"
        ? [
            `${rows.length.toLocaleString()} creators · aggregated metrics`,
            `${headers.length} columns`,
          ]
        : [
            `${rows.length.toLocaleString()} submissions · ${headers.length} columns`,
            options.submissionSortLabel ?? "Sorted by Views · High → Low",
          ];

    markPremiumPage(premiumPages, 1);
    await renderPdfSectionDividerPage(doc, 1, sectionTitle, summaryLines, fonts);

    await renderPdfDataTable(doc, headers, rows, 36, fonts, sectionTitle, {
      cellLinks: options?.cellLinks,
      platform: options?.platform ?? options?.rewardContext?.platform,
    });
    addPdfFooters(doc, fonts, premiumPages, { leadingPageCount: 1 });

    const bodyBytes = doc.output("arraybuffer") as ArrayBuffer;
    const { downloadPdfWithReactPrefix } = await import(
      "@/lib/report-export-pdf-cover-render"
    );
    await downloadPdfWithReactPrefix(
      bodyBytes,
      options.branding,
      options.metrics,
      `${safeBase}-${date}.pdf`,
    );
    return;
  }

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const colCount = headers.length;
  const layout = getPdfLandscapeLayout(colCount);
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: layout.pageFormat,
  });

  const pdfFont = await registerPdfUnicodeFont(doc);
  const useUnicodeFont = pdfFont === "Roboto";

  const marginX = layout.marginX;
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = layout.tableWidth;
  const avgColWidth = tableWidth / Math.max(colCount, 1);
  const fontSize = pickPdfFontSize(colCount, pageWidth);
  const cellPadding = pickPdfCellPadding(colCount);

  let startY = 36;
  if (meta?.contestTitle) {
    doc.setFont(pdfFont, "normal");
    doc.setFontSize(13);
    const titleText = useUnicodeFont
      ? normalizePdfText(meta.contestTitle)
      : toLatinPdfFallback(meta.contestTitle);
    doc.text(titleText, marginX, startY, {
      maxWidth: tableWidth,
    });
    startY += 16;
    if (meta.exportedAt) {
      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      doc.text(`Exported ${meta.exportedAt}`, marginX, startY);
      doc.setTextColor(0, 0, 0);
      startY += 12;
    }
    startY += 6;
  }

  const columnStyles = buildPdfColumnStyles(headers, tableWidth);
  const headFontSize = Math.max(5, fontSize);
  const pdfHeaders = headers.map((h, i) => {
    const colWidth = columnStyles[i]?.cellWidth ?? avgColWidth;
    return wrapPdfHeaderLabel(h, colWidth, headFontSize);
  });
  const pdfBody = rows.map((row) =>
    row.map((cell, i) => {
      const header = headers[i] ?? "";
      const colWidth =
        columnStyles[i]?.cellWidth ?? avgColWidth;
      const isAnalyticsCol =
        /analytics|traffic sources|demographics|top countries|instagram insights/i.test(
          header,
        );
      const isInsightsStatusCol = /insights status/i.test(header);
      const isTweetCol = isTweetExportColumn(header);
      return preparePdfBodyCell(
        cell,
        pickPdfCellMaxLen(colCount, header, colWidth),
        useUnicodeFont,
        isAnalyticsCol || isInsightsStatusCol || isTweetCol,
      );
    }),
  );

  autoTable(doc, {
    head: [pdfHeaders],
    body: pdfBody,
    startY,
    tableWidth,
    showHead: "everyPage",
    styles: {
      font: pdfFont,
      fontStyle: "normal",
      fontSize,
      cellPadding,
      overflow: "linebreak",
      valign: "top",
      lineWidth: 0.1,
      lineColor: [210, 210, 210],
    },
    headStyles: {
      font: pdfFont,
      fontStyle: "normal",
      fillColor: [79, 70, 229],
      textColor: 255,
      fontSize: headFontSize,
      halign: "center",
      valign: "middle",
      overflow: "linebreak",
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.section === "head") {
        data.cell.styles.overflow = "linebreak";
        data.cell.styles.valign = "middle";
        data.cell.styles.halign = "center";
      }
    },
    margin: { left: marginX, right: marginX, bottom: 32 },
    tableLineWidth: 0.1,
    tableLineColor: [210, 210, 210],
  });
  doc.save(`${safeBase}-${date}.pdf`);
}
