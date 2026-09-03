/**
 * Multi-platform video campaigns: one contest can allow YouTube, Instagram,
 * and/or TikTok, each with its own campaign type, payout, brief, and rules.
 *
 * Persistence:
 * - contests.platform = "youtube,instagram" (comma-separated, first is primary)
 * - contest_based_details.platform_campaigns[platform] = per-platform config
 * - Top-level contest_type / brief / rules / payout mirror the primary platform
 *   so existing readers stay compatible.
 */

import {
  DEFAULT_TOTAL_PRIZE_POOL,
  DEFAULT_WINNER_AMOUNTS,
  DEFAULT_WINNER_COUNT,
  MIN_CPM_RATE,
  MIN_PRIZE_PER_WINNER,
} from "@/constants/subscriptionPlans";
import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";

export const VIDEO_CONTEST_PLATFORMS = [
  "youtube",
  "instagram",
  "tiktok",
] as const;

export type VideoContestPlatform = (typeof VIDEO_CONTEST_PLATFORMS)[number];

export type VideoContestType =
  | "leaderboard"
  | "cpm"
  | "milestone"
  | "dual_rewards";

export type VideoContentType = "ugc" | "clipping" | "other" | "";

export const VIDEO_PLATFORM_LABELS: Record<VideoContestPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
};

export const ALL_PLATFORM_TAB = "all" as const;
export type PlatformTabValue = VideoContestPlatform | typeof ALL_PLATFORM_TAB;

export const PLATFORM_SECTION_KEYS = [
  "campaignType",
  "contentType",
  "brief",
  "rules",
  "prize",
  "resources",
  "inspiration",
] as const;

export type PlatformSectionKey = (typeof PLATFORM_SECTION_KEYS)[number];

export function platformsForTab(
  tab: PlatformTabValue,
  selected: VideoContestPlatform[],
): VideoContestPlatform[] {
  if (tab === ALL_PLATFORM_TAB) return [...selected];
  return selected.includes(tab) ? [tab] : selected.slice(0, 1);
}

export function createDefaultSectionPlatforms(): Record<
  PlatformSectionKey,
  PlatformTabValue
> {
  return {
    campaignType: ALL_PLATFORM_TAB,
    contentType: ALL_PLATFORM_TAB,
    brief: ALL_PLATFORM_TAB,
    rules: ALL_PLATFORM_TAB,
    prize: ALL_PLATFORM_TAB,
    resources: ALL_PLATFORM_TAB,
    inspiration: ALL_PLATFORM_TAB,
  };
}

export function createDefaultAllSectionLive(): Record<
  PlatformSectionKey,
  boolean
> {
  return {
    campaignType: true,
    contentType: true,
    brief: true,
    rules: true,
    prize: true,
    resources: true,
    inspiration: true,
  };
}

export function formatPlatformList(platforms: VideoContestPlatform[]): string {
  const labels = platforms.map((p) => VIDEO_PLATFORM_LABELS[p]);
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function platformSectionHint(
  tab: PlatformTabValue,
  selected: VideoContestPlatform[],
  allLive = true,
): string {
  if (selected.length < 2) return "";
  const list = formatPlatformList(selected);
  if (tab === ALL_PLATFORM_TAB) {
    if (!allLive) {
      return `Selected platforms currently differ. Edit here to apply this to ${list}.`;
    }
    return `This applies to ${list}. You do not need to fill each platform separately.`;
  }
  const others = selected.filter((p) => p !== tab);
  return `Editing ${VIDEO_PLATFORM_LABELS[tab]} only. Fill ${formatPlatformList(others)} as well, or switch to All to apply this to every selected platform.`;
}

export type PlatformMilestoneRow = {
  id: string;
  target_views: number | string;
  payout_dollars: number | string;
  winner_limit: number | string;
};

export type PlatformResourceItem = {
  url: string;
  description: string;
  type: "internal" | "external";
};

export type PlatformInspirationLink = {
  url: string;
  description: string;
};

export type PlatformCampaignSnapshot = {
  contestType: VideoContestType;
  contentType: VideoContentType;
  brief: string;
  briefHtml: string;
  briefJson: unknown;
  rulesHtml: string;
  rulesJson: unknown;
  winnerCount: number;
  winnerAmounts: number[];
  totalPrizePool: number;
  flatFeeBonus: number | string;
  flatFeeBonusCap: number | string;
  cpmRate: number | string;
  minViews: number | string;
  maxViews: number | string;
  totalBudget: number | string;
  termsConditions: string;
  milestoneRows: PlatformMilestoneRow[];
  milestoneBonusEnabled: boolean;
  milestoneBonusTopViewsMin: number | "";
  milestoneBonusTopViewsPayout: string;
  milestoneBonusTopViewsMinReels: number | "";
  milestoneBonusTopReelsMin: number | "";
  milestoneBonusTopReelsMinViews: number | "";
  milestoneBonusTopReelsPayout: string;
  resources: PlatformResourceItem[];
  inspirationLinks: PlatformInspirationLink[];
};

export type PersistedPlatformCampaign = {
  contest_type: VideoContestType;
  content_type?: string | null;
  brief_html?: string;
  brief_json?: unknown;
  rules_html?: string;
  rules_json?: unknown;
  leaderboard_contest?: {
    prizes: Array<{ position: number; amount: number }>;
    total_prize: number;
    winner_count: number;
    flat_fee_bonus?: number;
    total_budget?: number;
  };
  cpm_contest?: {
    cpm_rate_usd: number;
    total_budget?: number;
    terms_conditions?: string;
    min_views?: number | null;
    max_views?: number | null;
    flat_fee_bonus?: number;
    flat_fee_bonus_cap?: number;
    budget_spent?: number;
  };
  milestone_contest?: {
    milestones: Array<{
      order: number;
      target_views: number;
      payout_cents: number;
      winner_limit: number | null;
    }>;
    total_budget_cents?: number;
    bonus?: Record<string, unknown>;
  };
  total_budget_cents?: number;
  resources?: PlatformResourceItem[];
  inspiration_links?: PlatformInspirationLink[];
};

export type PlatformCampaignsMap = Partial<
  Record<VideoContestPlatform, PersistedPlatformCampaign>
>;

export function isVideoContestPlatform(
  value: string | null | undefined,
): value is VideoContestPlatform {
  return (
    value === "youtube" || value === "instagram" || value === "tiktok"
  );
}

export function parseVideoContestPlatforms(
  platform: string | null | undefined,
): VideoContestPlatform[] {
  const raw = (platform ?? "").toLowerCase().trim();
  if (!raw) return [];

  const tokens = raw
    .split(/[,+/|&]+|\band\b/)
    .map((t) => t.trim())
    .filter(Boolean);

  const ordered: VideoContestPlatform[] = [];
  for (const token of tokens) {
    const match = VIDEO_CONTEST_PLATFORMS.find(
      (p) => token === p || token.startsWith(p) || token.includes(p),
    );
    if (match && !ordered.includes(match)) ordered.push(match);
  }
  return ordered;
}

export function serializeVideoContestPlatforms(
  platforms: VideoContestPlatform[],
): string {
  const unique: VideoContestPlatform[] = [];
  for (const p of platforms) {
    if (isVideoContestPlatform(p) && !unique.includes(p)) unique.push(p);
  }
  return unique.join(",");
}

export function isMultiPlatformVideoContest(
  platform: string | null | undefined,
): boolean {
  return parseVideoContestPlatforms(platform).length > 1;
}

export function createDefaultMilestoneRow(): PlatformMilestoneRow {
  return {
    id: `m-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    target_views: "",
    payout_dollars: "",
    winner_limit: "",
  };
}

export function createDefaultPlatformCampaignSnapshot(): PlatformCampaignSnapshot {
  return {
    contestType: "leaderboard",
    contentType: "",
    brief: "",
    briefHtml: "",
    briefJson: null,
    rulesHtml: "",
    rulesJson: null,
    winnerCount: DEFAULT_WINNER_COUNT,
    winnerAmounts: [...DEFAULT_WINNER_AMOUNTS],
    totalPrizePool: DEFAULT_TOTAL_PRIZE_POOL,
    flatFeeBonus: "",
    flatFeeBonusCap: "",
    cpmRate: "",
    minViews: "",
    maxViews: "",
    totalBudget: "",
    termsConditions: "",
    milestoneRows: [createDefaultMilestoneRow()],
    milestoneBonusEnabled: false,
    milestoneBonusTopViewsMin: "",
    milestoneBonusTopViewsPayout: "",
    milestoneBonusTopViewsMinReels: "",
    milestoneBonusTopReelsMin: "",
    milestoneBonusTopReelsMinViews: "",
    milestoneBonusTopReelsPayout: "",
    resources: [],
    inspirationLinks: [],
  };
}

export function clonePlatformCampaignSnapshot(
  snapshot: PlatformCampaignSnapshot,
): PlatformCampaignSnapshot {
  return {
    ...snapshot,
    winnerAmounts: [...snapshot.winnerAmounts],
    milestoneRows: snapshot.milestoneRows.map((row) => ({ ...row })),
    briefJson:
      snapshot.briefJson && typeof snapshot.briefJson === "object"
        ? JSON.parse(JSON.stringify(snapshot.briefJson))
        : snapshot.briefJson,
    rulesJson:
      snapshot.rulesJson && typeof snapshot.rulesJson === "object"
        ? JSON.parse(JSON.stringify(snapshot.rulesJson))
        : snapshot.rulesJson,
    resources: (snapshot.resources ?? []).map((item) => ({ ...item })),
    inspirationLinks: (snapshot.inspirationLinks ?? []).map((item) => ({
      ...item,
    })),
  };
}

export function patchSnapshotSection(
  target: PlatformCampaignSnapshot,
  section: PlatformSectionKey,
  source: PlatformCampaignSnapshot,
): PlatformCampaignSnapshot {
  const next = clonePlatformCampaignSnapshot(target);
  switch (section) {
    case "campaignType":
      next.contestType = source.contestType;
      break;
    case "contentType":
      next.contentType = source.contentType;
      break;
    case "brief":
      next.brief = source.brief;
      next.briefHtml = source.briefHtml;
      next.briefJson = source.briefJson;
      break;
    case "rules":
      next.rulesHtml = source.rulesHtml;
      next.rulesJson = source.rulesJson;
      break;
    case "prize":
      next.winnerCount = source.winnerCount;
      next.winnerAmounts = [...source.winnerAmounts];
      next.totalPrizePool = source.totalPrizePool;
      next.flatFeeBonus = source.flatFeeBonus;
      next.flatFeeBonusCap = source.flatFeeBonusCap;
      next.cpmRate = source.cpmRate;
      next.minViews = source.minViews;
      next.maxViews = source.maxViews;
      next.totalBudget = source.totalBudget;
      next.termsConditions = source.termsConditions;
      next.milestoneRows = source.milestoneRows.map((row) => ({ ...row }));
      next.milestoneBonusEnabled = source.milestoneBonusEnabled;
      next.milestoneBonusTopViewsMin = source.milestoneBonusTopViewsMin;
      next.milestoneBonusTopViewsPayout = source.milestoneBonusTopViewsPayout;
      next.milestoneBonusTopViewsMinReels = source.milestoneBonusTopViewsMinReels;
      next.milestoneBonusTopReelsMin = source.milestoneBonusTopReelsMin;
      next.milestoneBonusTopReelsMinViews = source.milestoneBonusTopReelsMinViews;
      next.milestoneBonusTopReelsPayout = source.milestoneBonusTopReelsPayout;
      break;
    case "resources":
      next.resources = (source.resources ?? []).map((item) => ({ ...item }));
      break;
    case "inspiration":
      next.inspirationLinks = (source.inspirationLinks ?? []).map((item) => ({
        ...item,
      }));
      break;
  }
  return next;
}

export function areSectionValuesEqual(
  section: PlatformSectionKey,
  left: PlatformCampaignSnapshot,
  right: PlatformCampaignSnapshot,
): boolean {
  switch (section) {
    case "campaignType":
      return left.contestType === right.contestType;
    case "contentType":
      return left.contentType === right.contentType;
    case "brief":
      return (left.briefHtml || left.brief) === (right.briefHtml || right.brief);
    case "rules":
      return left.rulesHtml === right.rulesHtml;
    case "prize":
      return (
        left.contestType === right.contestType &&
        left.winnerCount === right.winnerCount &&
        left.totalPrizePool === right.totalPrizePool &&
        JSON.stringify(left.winnerAmounts) === JSON.stringify(right.winnerAmounts) &&
        String(left.flatFeeBonus) === String(right.flatFeeBonus) &&
        String(left.flatFeeBonusCap) === String(right.flatFeeBonusCap) &&
        String(left.cpmRate) === String(right.cpmRate) &&
        String(left.minViews) === String(right.minViews) &&
        String(left.maxViews) === String(right.maxViews) &&
        String(left.totalBudget) === String(right.totalBudget) &&
        left.termsConditions === right.termsConditions &&
        JSON.stringify(left.milestoneRows) === JSON.stringify(right.milestoneRows)
      );
    case "resources":
      return JSON.stringify(left.resources ?? []) === JSON.stringify(right.resources ?? []);
    case "inspiration":
      return (
        JSON.stringify(left.inspirationLinks ?? []) ===
        JSON.stringify(right.inspirationLinks ?? [])
      );
  }
}

export function isPlatformSectionComplete(
  section: PlatformSectionKey,
  platform: VideoContestPlatform,
  snapshot: PlatformCampaignSnapshot | undefined,
): boolean {
  if (!snapshot) return section === "campaignType" || section === "contentType";
  if (section === "campaignType" || section === "contentType") return true;
  if (section === "brief") {
    return !isHtmlContentEmpty(snapshot.briefHtml || snapshot.brief);
  }
  if (section === "rules") {
    return !isHtmlContentEmpty(snapshot.rulesHtml);
  }
  if (section === "resources") {
    return (snapshot.resources ?? []).length > 0;
  }
  if (section === "inspiration") {
    return (snapshot.inspirationLinks ?? []).some((link) => link.url?.trim());
  }
  return validatePlatformCampaignSnapshot(platform, snapshot, {
    requirePayout: true,
  }) === null;
}

export function sectionCompletionByTab(
  section: PlatformSectionKey,
  selected: VideoContestPlatform[],
  map: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>,
): Partial<Record<PlatformTabValue, boolean>> {
  const completeByTab: Partial<Record<PlatformTabValue, boolean>> = {};
  for (const platform of selected) {
    completeByTab[platform] = isPlatformSectionComplete(
      section,
      platform,
      map[platform],
    );
  }
  completeByTab[ALL_PLATFORM_TAB] = selected.every(
    (platform) => completeByTab[platform],
  );
  return completeByTab;
}

export function buildFlushedPlatformCampaigns(
  selected: VideoContestPlatform[],
  tabs: Record<PlatformSectionKey, PlatformTabValue>,
  current: PlatformCampaignSnapshot,
  existingMap: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>,
  allLive: Record<PlatformSectionKey, boolean> = createDefaultAllSectionLive(),
): Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>> {
  const next: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>> =
    { ...existingMap };
  for (const section of PLATFORM_SECTION_KEYS) {
    if (tabs[section] === ALL_PLATFORM_TAB && allLive[section] === false) {
      continue;
    }
    const targets = platformsForTab(tabs[section], selected);
    for (const p of targets) {
      const existing = next[p] ?? createDefaultPlatformCampaignSnapshot();
      next[p] = patchSnapshotSection(existing, section, current);
    }
  }
  return next;
}

function dollarsToCents(value: number | string | ""): number {
  const n = parseFloat(String(value ?? ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function buildMilestoneBonus(
  snapshot: PlatformCampaignSnapshot,
): Record<string, unknown> | undefined {
  if (!snapshot.milestoneBonusEnabled) return undefined;
  const bonus: Record<string, unknown> = { enabled: true };
  if (
    snapshot.milestoneBonusTopViewsMin !== "" &&
    snapshot.milestoneBonusTopViewsPayout
  ) {
    const mostVerifiedViews: Record<string, unknown> = {
      min_total_views: Number(snapshot.milestoneBonusTopViewsMin),
      payout_cents: dollarsToCents(snapshot.milestoneBonusTopViewsPayout),
    };
    if (snapshot.milestoneBonusTopViewsMinReels !== "") {
      mostVerifiedViews.min_verified_reels = Number(
        snapshot.milestoneBonusTopViewsMinReels,
      );
    }
    bonus.most_verified_views = mostVerifiedViews;
  }
  if (
    snapshot.milestoneBonusTopReelsMin !== "" &&
    snapshot.milestoneBonusTopReelsPayout
  ) {
    const mostVerifiedReels: Record<string, unknown> = {
      min_verified_reels: Number(snapshot.milestoneBonusTopReelsMin),
      payout_cents: dollarsToCents(snapshot.milestoneBonusTopReelsPayout),
    };
    if (snapshot.milestoneBonusTopReelsMinViews !== "") {
      mostVerifiedReels.min_total_views = Number(
        snapshot.milestoneBonusTopReelsMinViews,
      );
    }
    bonus.most_verified_reels = mostVerifiedReels;
  }
  return bonus;
}

export function snapshotToPersistedPlatformCampaign(
  snapshot: PlatformCampaignSnapshot,
): PersistedPlatformCampaign {
  const contestType = snapshot.contestType;
  const persisted: PersistedPlatformCampaign = {
    contest_type: contestType,
    content_type: snapshot.contentType || null,
    brief_html: snapshot.briefHtml || snapshot.brief || "",
    brief_json: snapshot.briefJson ?? null,
    rules_html: snapshot.rulesHtml || "",
    rules_json: snapshot.rulesJson ?? null,
    resources: (snapshot.resources ?? []).map((item) => ({ ...item })),
    inspiration_links: (snapshot.inspirationLinks ?? []).map((item) => ({
      ...item,
    })),
  };

  const includeMilestone =
    contestType === "milestone" || contestType === "dual_rewards";
  const includeCpm = contestType === "cpm" || contestType === "dual_rewards";
  const poolCents = dollarsToCents(snapshot.totalBudget);

  if (contestType === "leaderboard") {
    const prizes = Array.from({ length: snapshot.winnerCount }, (_, i) => ({
      position: i + 1,
      amount: snapshot.winnerAmounts[i] || 0,
    }));
    const flatFeeBonusCents = dollarsToCents(snapshot.flatFeeBonus);
    persisted.leaderboard_contest = {
      prizes,
      total_prize: snapshot.totalPrizePool,
      winner_count: snapshot.winnerCount,
      ...(flatFeeBonusCents > 0 ? { flat_fee_bonus: flatFeeBonusCents } : {}),
      ...(poolCents > 0 ? { total_budget: poolCents } : {}),
    };
    return persisted;
  }

  if (includeMilestone) {
    const milestones = snapshot.milestoneRows
      .map((row) => {
        const targetViews = parseInt(String(row.target_views), 10);
        const payoutCents = dollarsToCents(row.payout_dollars);
        const winnerLimitRaw =
          row.winner_limit === ""
            ? null
            : parseInt(String(row.winner_limit), 10);
        return {
          target_views: Number.isFinite(targetViews) ? targetViews : 0,
          payout_cents: payoutCents,
          winner_limit:
            winnerLimitRaw !== null && Number.isFinite(winnerLimitRaw)
              ? winnerLimitRaw
              : null,
        };
      })
      .filter((m) => m.target_views > 0)
      .map((m, idx) => ({ ...m, order: idx + 1 }));

    const bonus = buildMilestoneBonus(snapshot);
    persisted.milestone_contest = {
      milestones,
      ...(contestType !== "dual_rewards" && poolCents > 0
        ? { total_budget_cents: poolCents }
        : {}),
      ...(bonus ? { bonus } : {}),
    };
    if (contestType === "dual_rewards" && poolCents > 0) {
      persisted.total_budget_cents = poolCents;
    }
  }

  if (includeCpm) {
    const flatFeeBonusCents =
      contestType !== "dual_rewards" ? dollarsToCents(snapshot.flatFeeBonus) : 0;
    const flatFeeBonusCapCents =
      contestType !== "dual_rewards"
        ? dollarsToCents(snapshot.flatFeeBonusCap)
        : 0;
    const minViews =
      snapshot.minViews !== "" && snapshot.minViews != null
        ? parseInt(String(snapshot.minViews), 10)
        : null;
    const maxViews =
      snapshot.maxViews !== "" && snapshot.maxViews != null
        ? parseInt(String(snapshot.maxViews), 10)
        : null;

    persisted.cpm_contest = {
      cpm_rate_usd: parseFloat(String(snapshot.cpmRate)) || 0,
      ...(contestType !== "dual_rewards" && poolCents > 0
        ? { total_budget: poolCents }
        : {}),
      terms_conditions: snapshot.termsConditions || "",
      min_views: Number.isFinite(minViews as number) ? minViews : null,
      max_views: Number.isFinite(maxViews as number) ? maxViews : null,
      ...(flatFeeBonusCents > 0 ? { flat_fee_bonus: flatFeeBonusCents } : {}),
      ...(flatFeeBonusCapCents > 0
        ? { flat_fee_bonus_cap: flatFeeBonusCapCents }
        : {}),
    };
  }

  return persisted;
}

function hydrateMilestoneRows(
  milestones: PersistedPlatformCampaign["milestone_contest"] extends infer T
    ? T extends { milestones?: infer M }
      ? M
      : never
    : never,
): PlatformMilestoneRow[] {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return [createDefaultMilestoneRow()];
  }
  return milestones.map((m) => ({
    id: createDefaultMilestoneRow().id,
    target_views: typeof m.target_views === "number" ? m.target_views : "",
    payout_dollars:
      typeof m.payout_cents === "number" ? (m.payout_cents / 100).toString() : "",
    winner_limit:
      m.winner_limit === null || m.winner_limit === undefined
        ? ""
        : m.winner_limit,
  }));
}

export function persistedPlatformCampaignToSnapshot(
  persisted: PersistedPlatformCampaign,
): PlatformCampaignSnapshot {
  const snapshot = createDefaultPlatformCampaignSnapshot();
  snapshot.contestType = persisted.contest_type || "leaderboard";
  const contentType = persisted.content_type;
  snapshot.contentType =
    contentType === "ugc" || contentType === "clipping" || contentType === "other"
      ? contentType
      : "";
  snapshot.briefHtml = persisted.brief_html || "";
  snapshot.brief = persisted.brief_html || "";
  snapshot.briefJson = persisted.brief_json ?? null;
  snapshot.rulesHtml = persisted.rules_html || "";
  snapshot.rulesJson = persisted.rules_json ?? null;
  snapshot.resources = Array.isArray(persisted.resources)
    ? persisted.resources.map((item) => ({ ...item }))
    : [];
  snapshot.inspirationLinks = Array.isArray(persisted.inspiration_links)
    ? persisted.inspiration_links.map((item) => ({ ...item }))
    : [];

  if (snapshot.contestType === "leaderboard" && persisted.leaderboard_contest) {
    const lc = persisted.leaderboard_contest;
    snapshot.winnerCount = lc.winner_count || lc.prizes?.length || DEFAULT_WINNER_COUNT;
    snapshot.winnerAmounts = Array.isArray(lc.prizes)
      ? lc.prizes.map((p) => p.amount || 0)
      : [...DEFAULT_WINNER_AMOUNTS];
    snapshot.totalPrizePool =
      typeof lc.total_prize === "number" && lc.total_prize > 0
        ? lc.total_prize
        : snapshot.winnerAmounts.reduce((sum, n) => sum + n, 0);
    if (typeof lc.flat_fee_bonus === "number" && lc.flat_fee_bonus > 0) {
      snapshot.flatFeeBonus = (lc.flat_fee_bonus / 100).toString();
    }
    if (typeof lc.total_budget === "number" && lc.total_budget > 0) {
      snapshot.totalBudget = (lc.total_budget / 100).toString();
    }
  }

  if (persisted.cpm_contest) {
    const cc = persisted.cpm_contest;
    if (typeof cc.cpm_rate_usd === "number") {
      snapshot.cpmRate = cc.cpm_rate_usd.toString();
    }
    if (cc.min_views != null) snapshot.minViews = cc.min_views;
    if (cc.max_views != null) snapshot.maxViews = cc.max_views;
    if (
      snapshot.contestType !== "dual_rewards" &&
      typeof cc.total_budget === "number" &&
      cc.total_budget > 0
    ) {
      snapshot.totalBudget = (cc.total_budget / 100).toString();
    }
    if (typeof cc.terms_conditions === "string") {
      snapshot.termsConditions = cc.terms_conditions;
    }
    if (typeof cc.flat_fee_bonus === "number" && cc.flat_fee_bonus > 0) {
      snapshot.flatFeeBonus = (cc.flat_fee_bonus / 100).toString();
    }
    if (typeof cc.flat_fee_bonus_cap === "number" && cc.flat_fee_bonus_cap > 0) {
      snapshot.flatFeeBonusCap = (cc.flat_fee_bonus_cap / 100).toString();
    }
  }

  if (persisted.milestone_contest) {
    const mc = persisted.milestone_contest;
    snapshot.milestoneRows = hydrateMilestoneRows(mc.milestones);
    if (
      snapshot.contestType === "dual_rewards" &&
      typeof persisted.total_budget_cents === "number" &&
      persisted.total_budget_cents > 0
    ) {
      snapshot.totalBudget = (persisted.total_budget_cents / 100).toString();
    } else if (
      typeof mc.total_budget_cents === "number" &&
      mc.total_budget_cents > 0
    ) {
      snapshot.totalBudget = (mc.total_budget_cents / 100).toString();
    }
    const bonus = mc.bonus;
    if (bonus && typeof bonus === "object") {
      snapshot.milestoneBonusEnabled = Boolean(
        (bonus as { enabled?: boolean }).enabled,
      );
      const mv = (bonus as { most_verified_views?: Record<string, number> })
        .most_verified_views;
      if (mv) {
        if (typeof mv.min_total_views === "number") {
          snapshot.milestoneBonusTopViewsMin = mv.min_total_views;
        }
        if (typeof mv.min_verified_reels === "number") {
          snapshot.milestoneBonusTopViewsMinReels = mv.min_verified_reels;
        }
        if (typeof mv.payout_cents === "number") {
          snapshot.milestoneBonusTopViewsPayout = (
            mv.payout_cents / 100
          ).toString();
        }
      }
      const mr = (bonus as { most_verified_reels?: Record<string, number> })
        .most_verified_reels;
      if (mr) {
        if (typeof mr.min_total_views === "number") {
          snapshot.milestoneBonusTopReelsMinViews = mr.min_total_views;
        }
        if (typeof mr.min_verified_reels === "number") {
          snapshot.milestoneBonusTopReelsMin = mr.min_verified_reels;
        }
        if (typeof mr.payout_cents === "number") {
          snapshot.milestoneBonusTopReelsPayout = (
            mr.payout_cents / 100
          ).toString();
        }
      }
    }
  }

  return snapshot;
}

export function readPersistedPlatformCampaigns(
  details: Record<string, unknown> | null | undefined,
): PlatformCampaignsMap {
  const raw = details?.platform_campaigns;
  if (!raw || typeof raw !== "object") return {};
  const map: PlatformCampaignsMap = {};
  for (const [key, value] of Object.entries(
    raw as Record<string, PersistedPlatformCampaign>,
  )) {
    if (!isVideoContestPlatform(key) || !value || typeof value !== "object") {
      continue;
    }
    map[key] = value;
  }
  return map;
}

export function attachPlatformCampaignsToDetails(
  details: Record<string, unknown>,
  platforms: VideoContestPlatform[],
  snapshots: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>,
): Record<string, unknown> {
  const next = { ...details };
  if (platforms.length < 2) {
    delete next.platform_campaigns;
    return next;
  }
  const campaigns: PlatformCampaignsMap = {};
  for (const platform of platforms) {
    const snap = snapshots[platform];
    if (snap) {
      campaigns[platform] = snapshotToPersistedPlatformCampaign(snap);
    }
  }
  next.platform_campaigns = campaigns;
  return next;
}

export function getSnapshotChargeableCents(
  snapshot: PlatformCampaignSnapshot,
): number {
  if (snapshot.contestType === "leaderboard") {
    const prize = snapshot.totalPrizePool || 0;
    const bonusEnabled = dollarsToCents(snapshot.flatFeeBonus) > 0;
    const bonusBudget = bonusEnabled ? dollarsToCents(snapshot.totalBudget) : 0;
    return prize + bonusBudget;
  }
  return dollarsToCents(snapshot.totalBudget);
}

export function sumSnapshotChargeableCents(
  platforms: VideoContestPlatform[],
  snapshots: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>,
): number {
  return platforms.reduce(
    (sum, platform) =>
      sum +
      getSnapshotChargeableCents(
        snapshots[platform] ?? createDefaultPlatformCampaignSnapshot(),
      ),
    0,
  );
}

export function getPersistedPlatformChargeableCents(
  campaign: PersistedPlatformCampaign,
): number {
  const type = campaign.contest_type;
  if (type === "leaderboard") {
    const lb = campaign.leaderboard_contest;
    if (!lb) return 0;
    const totalPrize =
      typeof lb.total_prize === "number" && lb.total_prize > 0
        ? lb.total_prize
        : (lb.prizes ?? []).reduce((sum, prize) => sum + (prize.amount || 0), 0);
    const flatFeeBonus = Number(lb.flat_fee_bonus) || 0;
    const bonusBudget = Number(lb.total_budget) || 0;
    if (flatFeeBonus > 0 && bonusBudget > 0) return totalPrize + bonusBudget;
    return totalPrize;
  }
  return getPoolBudgetCentsFromDetails(type, {
    total_budget_cents: campaign.total_budget_cents,
    cpm_contest: campaign.cpm_contest ?? null,
    milestone_contest: campaign.milestone_contest ?? null,
  });
}

export function sumPersistedPlatformCampaignsChargeableCents(
  details: Record<string, unknown> | null | undefined,
): number | null {
  const campaigns = readPersistedPlatformCampaigns(details);
  const values = Object.values(campaigns).filter(
    (c): c is PersistedPlatformCampaign => Boolean(c),
  );
  if (values.length < 2) return null;
  return values.reduce(
    (sum, campaign) => sum + getPersistedPlatformChargeableCents(campaign),
    0,
  );
}

export function isHtmlContentEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0;
}

export function validatePlatformCampaignSnapshot(
  platform: VideoContestPlatform,
  snapshot: PlatformCampaignSnapshot,
  options: {
    requireBriefAndRules?: boolean;
    requirePayout?: boolean;
    requireResources?: boolean;
    requireInspiration?: boolean;
    requireResourcesAndInspiration?: boolean;
  } = {},
): string | null {
  const label = VIDEO_PLATFORM_LABELS[platform];
  if (options.requireBriefAndRules) {
    if (isHtmlContentEmpty(snapshot.briefHtml || snapshot.brief)) {
      return `Please enter a brief for ${label}.`;
    }
    if (isHtmlContentEmpty(snapshot.rulesHtml)) {
      return `Please provide rules for ${label}.`;
    }
  }
  if (options.requireResources || options.requireResourcesAndInspiration) {
    if (!(snapshot.resources ?? []).length) {
      return `Please add at least one resource for ${label}.`;
    }
  }
  if (options.requireInspiration || options.requireResourcesAndInspiration) {
    if (!(snapshot.inspirationLinks ?? []).some((link) => link.url?.trim())) {
      return `Please add at least one inspiration link for ${label}.`;
    }
  }
  if (options.requirePayout) {
    if (snapshot.contestType === "leaderboard") {
      for (let i = 0; i < snapshot.winnerCount; i++) {
        if (!snapshot.winnerAmounts[i] || snapshot.winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
          return `${label}: prize for winner ${i + 1} is below the minimum.`;
        }
      }
    } else if (snapshot.contestType === "cpm") {
      const rate = parseFloat(String(snapshot.cpmRate));
      if (!Number.isFinite(rate) || rate < MIN_CPM_RATE) {
        return `${label}: enter a valid CPM rate.`;
      }
      if (dollarsToCents(snapshot.totalBudget) <= 0) {
        return `${label}: total budget is required for CPM campaigns.`;
      }
      if (!snapshot.termsConditions?.trim()) {
        return `${label}: terms and conditions are required for CPM campaigns.`;
      }
    } else if (snapshot.contestType === "milestone") {
      const hasMilestone = snapshot.milestoneRows.some(
        (row) => parseInt(String(row.target_views), 10) > 0,
      );
      if (!hasMilestone) {
        return `${label}: add at least one milestone.`;
      }
      if (dollarsToCents(snapshot.totalBudget) <= 0) {
        return `${label}: total campaign budget is required for milestone campaigns.`;
      }
    } else if (snapshot.contestType === "dual_rewards") {
      const rate = parseFloat(String(snapshot.cpmRate));
      if (!Number.isFinite(rate) || rate < MIN_CPM_RATE) {
        return `${label}: enter a valid CPM rate.`;
      }
      if (dollarsToCents(snapshot.totalBudget) <= 0) {
        return `${label}: total budget is required for dual rewards campaigns.`;
      }
    }
  }
  return null;
}

export function primaryPlatformOf(
  platforms: VideoContestPlatform[],
): VideoContestPlatform {
  return platforms[0] ?? "youtube";
}

export function topLevelPayoutDetailsFromSnapshot(
  snapshot: PlatformCampaignSnapshot,
): Record<string, unknown> {
  const persisted = snapshotToPersistedPlatformCampaign(snapshot);
  const details: Record<string, unknown> = {};
  if (persisted.leaderboard_contest) {
    details.leaderboard_contest = persisted.leaderboard_contest;
  }
  if (persisted.cpm_contest) {
    details.cpm_contest = persisted.cpm_contest;
  }
  if (persisted.milestone_contest) {
    details.milestone_contest = persisted.milestone_contest;
  }
  if (typeof persisted.total_budget_cents === "number") {
    details.total_budget_cents = persisted.total_budget_cents;
  }
  return details;
}
