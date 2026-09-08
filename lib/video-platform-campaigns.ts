/**
 * Multi-platform video campaigns: one contest can allow YouTube, Instagram,
 * and/or TikTok, each with its own campaign type, payout, brief, and rules.
 *
 * Persistence:
 * - contests.platform = "youtube,instagram" (comma-separated, first is primary)
 * - contest_based_details.youtube|instagram|tiktok = per-platform payout JSON
 *   (contest_type + leaderboard/cpm/milestone blocks only — no brief/rules/
 *   resources/inspiration/bonus/max-earnings). The old nested
 *   `platform_campaigns` key is not used.
 * - Multi-platform saves must NOT also mirror primary payout onto root
 *   cpm_contest / milestone_contest / leaderboard_contest / total_budget_cents.
 *   Legacy readers can use withProjectedTopLevelPayout() at read time.
 * - Top-level brief_html / rules_html mirror the primary platform for search
 *   and legacy readers
 * - Multi-platform brief_json / rules_json / resources / inspiration_links /
 *   bonus_details / max_earnings_per_creator are platform-keyed maps:
 *   { youtube: ..., instagram: ..., tiktok: ... }
 * - max_earnings_per_creator multi shape:
 *   { youtube: { max_earnings_per_creator: cents }, ... }
 *   (single-platform stays a plain cents number)
 */

import {
  DEFAULT_TOTAL_PRIZE_POOL,
  DEFAULT_WINNER_AMOUNTS,
  DEFAULT_WINNER_COUNT,
  MIN_CPM_RATE,
  MIN_PRIZE_PER_WINNER,
} from "@/constants/subscriptionPlans";
import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";
import type { ContestBasedDetailsForPool } from "@/lib/contest-type";

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
  "earnings",
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

/**
 * Prize pool shown in Creator Earning Opportunities for the active earnings tab.
 * Uses the live prize editor when that tab is the same platform, otherwise the
 * stored per-platform snapshot so YouTube / Instagram / TikTok can differ.
 */
export function prizePoolCentsForPlatformScope(options: {
  scopeTab: PlatformTabValue;
  prizeTab: PlatformTabValue;
  selected: VideoContestPlatform[];
  snapshots: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>;
  livePrizePoolCents: number;
}): number {
  const { scopeTab, prizeTab, selected, snapshots, livePrizePoolCents } =
    options;
  if (selected.length < 2) return livePrizePoolCents;

  const scoped = platformsForTab(scopeTab, selected);
  if (scoped.length === 0) return livePrizePoolCents;

  const storedCents = (platform: VideoContestPlatform) => {
    const value = snapshots[platform]?.totalPrizePool;
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };

  if (scoped.length === 1) {
    const platform = scoped[0];
    if (prizeTab === platform) return livePrizePoolCents;
    const stored = storedCents(platform);
    return stored > 0 ? stored : livePrizePoolCents;
  }

  if (prizeTab === ALL_PLATFORM_TAB) return livePrizePoolCents;

  return scoped.reduce((sum, platform) => {
    if (platform === prizeTab) return sum + livePrizePoolCents;
    return sum + storedCents(platform);
  }, 0);
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
    earnings: ALL_PLATFORM_TAB,
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
    earnings: true,
    resources: true,
    inspiration: true,
  };
}

/** Sections that stay shared across platforms in the create/edit UI. */
export const SHARED_PLATFORM_SECTION_KEYS: PlatformSectionKey[] = [
  "campaignType",
  "contentType",
];

/** Sections that can differ per selected platform. */
export const PER_PLATFORM_SECTION_KEYS: PlatformSectionKey[] = [
  "brief",
  "rules",
  "prize",
  "earnings",
  "resources",
  "inspiration",
];

/**
 * Restore tab + allLive state from saved per-platform snapshots.
 * Divergent sections open in "Selected platforms" mode so a later save
 * cannot broadcast one editor buffer onto every platform.
 */
export function deriveSectionPlatformUiState(
  selected: VideoContestPlatform[],
  map: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>,
): {
  tabs: Record<PlatformSectionKey, PlatformTabValue>;
  allLive: Record<PlatformSectionKey, boolean>;
} {
  const tabs = createDefaultSectionPlatforms();
  const allLive = createDefaultAllSectionLive();

  if (selected.length < 2) {
    const only = selected[0] ?? ALL_PLATFORM_TAB;
    for (const key of PLATFORM_SECTION_KEYS) {
      tabs[key] = only === ALL_PLATFORM_TAB ? ALL_PLATFORM_TAB : only;
      allLive[key] = true;
    }
    return { tabs, allLive };
  }

  for (const key of SHARED_PLATFORM_SECTION_KEYS) {
    tabs[key] = ALL_PLATFORM_TAB;
    allLive[key] = true;
  }

  for (const section of PER_PLATFORM_SECTION_KEYS) {
    const snaps = selected.map(
      (platform) => map[platform] ?? createDefaultPlatformCampaignSnapshot(),
    );
    const uniform = snaps.every((snap) =>
      areSectionValuesEqual(section, snaps[0], snap),
    );
    if (uniform) {
      tabs[section] = ALL_PLATFORM_TAB;
      allLive[section] = true;
    } else {
      tabs[section] = selected[0];
      allLive[section] = false;
    }
  }

  return { tabs, allLive };
}

export function formatPlatformList(platforms: VideoContestPlatform[]): string {
  const labels = platforms.map((p) => VIDEO_PLATFORM_LABELS[p]);
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

/** Pretty platform label for contest/opportunity list cards (multi-platform aware). */
export function formatContestPlatformLabel(
  platform?: string | null,
): string {
  const platforms = parseVideoContestPlatforms(platform);
  if (platforms.length > 0) return formatPlatformList(platforms);
  const raw = (platform ?? "").trim();
  if (!raw) return "N/A";
  const lower = raw.toLowerCase();
  if (lower === "twitter" || lower === "x") return "Twitter";
  return raw;
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
  maxEarningsPerCreator: number | string;
  bonusEnabled: boolean;
  bonusHtml: string;
  bonusJson: unknown;
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
    budget_spent?: number;
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
  // Legacy only — no longer written; use top-level contest columns.
  max_earnings_per_creator?: number | null;
  bonus_details?: {
    description_html?: string;
    description_json?: unknown;
  } | null;
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
    maxEarningsPerCreator: "",
    bonusEnabled: false,
    bonusHtml: "",
    bonusJson: null,
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
    bonusJson:
      snapshot.bonusJson && typeof snapshot.bonusJson === "object"
        ? JSON.parse(JSON.stringify(snapshot.bonusJson))
        : snapshot.bonusJson,
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
      next.cpmRate = source.cpmRate;
      next.minViews = source.minViews;
      next.maxViews = source.maxViews;
      if (source.contestType !== "leaderboard") {
        next.totalBudget = source.totalBudget;
      }
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
    case "earnings":
      // Creator earning opportunities only — keep payout fields untouched.
      next.flatFeeBonus = source.flatFeeBonus;
      next.flatFeeBonusCap = source.flatFeeBonusCap;
      if (source.contestType === "leaderboard") {
        next.totalBudget = source.totalBudget;
      }
      next.maxEarningsPerCreator = source.maxEarningsPerCreator;
      next.bonusEnabled = source.bonusEnabled;
      next.bonusHtml = source.bonusHtml;
      next.bonusJson = source.bonusJson;
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
        JSON.stringify(left.winnerAmounts) ===
          JSON.stringify(right.winnerAmounts) &&
        String(left.cpmRate) === String(right.cpmRate) &&
        String(left.minViews) === String(right.minViews) &&
        String(left.maxViews) === String(right.maxViews) &&
        // totalBudget is shared across platforms — ignore for divergence checks
        left.termsConditions === right.termsConditions &&
        JSON.stringify(left.milestoneRows) ===
          JSON.stringify(right.milestoneRows) &&
        left.milestoneBonusEnabled === right.milestoneBonusEnabled &&
        String(left.milestoneBonusTopViewsMin) ===
          String(right.milestoneBonusTopViewsMin) &&
        String(left.milestoneBonusTopViewsPayout) ===
          String(right.milestoneBonusTopViewsPayout) &&
        String(left.milestoneBonusTopViewsMinReels) ===
          String(right.milestoneBonusTopViewsMinReels) &&
        String(left.milestoneBonusTopReelsMin) ===
          String(right.milestoneBonusTopReelsMin) &&
        String(left.milestoneBonusTopReelsMinViews) ===
          String(right.milestoneBonusTopReelsMinViews) &&
        String(left.milestoneBonusTopReelsPayout) ===
          String(right.milestoneBonusTopReelsPayout)
      );
    case "earnings":
      return (
        String(left.flatFeeBonus) === String(right.flatFeeBonus) &&
        String(left.flatFeeBonusCap) === String(right.flatFeeBonusCap) &&
        (left.contestType === "leaderboard" ||
        right.contestType === "leaderboard"
          ? String(left.totalBudget) === String(right.totalBudget)
          : true) &&
        String(left.maxEarningsPerCreator) ===
          String(right.maxEarningsPerCreator) &&
        left.bonusEnabled === right.bonusEnabled &&
        left.bonusHtml === right.bonusHtml
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
  if (section === "earnings") {
    // Optional extras — never block section completion.
    return true;
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
    if (tabs[section] === ALL_PLATFORM_TAB) {
      if (allLive[section] === false) {
        continue;
      }
      // Guard: if platforms already differ for this section, do not wipe them
      // by broadcasting the current editor buffer (common after draft reload
      // when tabs were reset to All with allLive=true).
      if (PER_PLATFORM_SECTION_KEYS.includes(section)) {
        const existingSnaps = selected
          .map((platform) => next[platform])
          .filter((snap): snap is PlatformCampaignSnapshot => Boolean(snap));
        if (
          existingSnaps.length >= 2 &&
          existingSnaps.some(
            (snap) => !areSectionValuesEqual(section, existingSnaps[0], snap),
          )
        ) {
          continue;
        }
      }
    }
    const targets = platformsForTab(tabs[section], selected);
    for (const p of targets) {
      const existing = next[p] ?? createDefaultPlatformCampaignSnapshot();
      next[p] = patchSnapshotSection(existing, section, current);
    }
  }
  // CPM / milestone / dual pool budget is shared. Leaderboard totalBudget is
  // the per-platform flat-fee bonus cap ("Total Budget for Bonuses").
  if (current.contestType !== "leaderboard") {
    for (const platform of selected) {
      const snap = next[platform];
      if (!snap) continue;
      next[platform] = {
        ...snap,
        totalBudget: current.totalBudget,
      };
    }
  }
  return next;
}

/**
 * Build the per-platform map used when persisting a multi-platform contest.
 * Campaign type + content type are always shared across selected platforms
 * (those sections no longer have per-platform tabs in the create UI).
 * Every selected platform is guaranteed to appear in the result.
 */
export function preparePlatformCampaignsForSave(
  selected: VideoContestPlatform[],
  tabs: Record<PlatformSectionKey, PlatformTabValue>,
  current: PlatformCampaignSnapshot,
  existingMap: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>,
  allLive: Record<PlatformSectionKey, boolean> = createDefaultAllSectionLive(),
): Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>> {
  if (selected.length === 0) return {};

  const saveTabs: Record<PlatformSectionKey, PlatformTabValue> = {
    ...tabs,
    campaignType: ALL_PLATFORM_TAB,
    contentType: ALL_PLATFORM_TAB,
  };
  const saveLive: Record<PlatformSectionKey, boolean> = {
    ...allLive,
    campaignType: true,
    contentType: true,
  };

  const flushed = buildFlushedPlatformCampaigns(
    selected,
    saveTabs,
    current,
    existingMap,
    saveLive,
  );

  const primary = selected[0];
  const fallback =
    flushed[primary] ??
    patchSnapshotSection(
      patchSnapshotSection(
        createDefaultPlatformCampaignSnapshot(),
        "campaignType",
        current,
      ),
      "contentType",
      current,
    );

  const next: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>> =
    {};
  for (const platform of selected) {
    const base = flushed[platform]
      ? clonePlatformCampaignSnapshot(flushed[platform]!)
      : clonePlatformCampaignSnapshot(fallback);
    let snap = patchSnapshotSection(
      patchSnapshotSection(base, "campaignType", current),
      "contentType",
      current,
    );
    if (current.contestType !== "leaderboard") {
      snap = {
        ...snap,
        // Shared across every selected platform for CPM / milestone / dual.
        totalBudget: current.totalBudget,
      };
    }
    // All-tab earnings: always apply creator earnings from the shared editor buffer.
    if (tabs.earnings === ALL_PLATFORM_TAB) {
      snap = {
        ...snap,
        flatFeeBonus: current.flatFeeBonus,
        flatFeeBonusCap: current.flatFeeBonusCap,
        maxEarningsPerCreator: current.maxEarningsPerCreator,
        bonusEnabled: current.bonusEnabled,
        bonusHtml: current.bonusHtml,
        bonusJson: current.bonusJson,
        ...(current.contestType === "leaderboard"
          ? { totalBudget: current.totalBudget }
          : {}),
      };
    }
    next[platform] = snap;
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
  // Content + creator earnings live on top-level contest columns.
  // Platform objects store contest_type + payout blocks only.
  const contestType = snapshot.contestType;
  const persisted: PersistedPlatformCampaign = {
    contest_type: contestType,
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

  if (
    typeof persisted.max_earnings_per_creator === "number" &&
    persisted.max_earnings_per_creator > 0
  ) {
    snapshot.maxEarningsPerCreator = (
      persisted.max_earnings_per_creator / 100
    ).toString();
  }
  const bonusDetails = persisted.bonus_details;
  if (bonusDetails?.description_html) {
    snapshot.bonusEnabled = true;
    snapshot.bonusHtml = bonusDetails.description_html;
    snapshot.bonusJson = bonusDetails.description_json ?? null;
  }

  return snapshot;
}

/** Top-level payout keys used by single-platform contests / legacy readers. */
export const TOP_LEVEL_PAYOUT_DETAIL_KEYS = [
  "leaderboard_contest",
  "cpm_contest",
  "milestone_contest",
  "total_budget_cents",
] as const;

/** Remove duplicated root payout blocks (multi-platform stores these under youtube|instagram|tiktok). */
export function clearTopLevelPayoutKeys(
  details: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...details };
  for (const key of TOP_LEVEL_PAYOUT_DETAIL_KEYS) {
    delete next[key];
  }
  return next;
}

/** Remove legacy `platform_campaigns` and any deselected platform payout keys. */
export function clearPlatformCampaignKeys(
  details: Record<string, unknown>,
  keep: ReadonlySet<VideoContestPlatform> | VideoContestPlatform[] = [],
): Record<string, unknown> {
  const next = { ...details };
  delete next.platform_campaigns;
  const keepSet = keep instanceof Set ? keep : new Set(keep);
  for (const platform of VIDEO_CONTEST_PLATFORMS) {
    if (!keepSet.has(platform)) {
      delete next[platform];
    }
  }
  return next;
}

function isPersistedPlatformCampaignShape(
  value: unknown,
): value is PersistedPlatformCampaign {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.contest_type === "string" ||
    "leaderboard_contest" in record ||
    "cpm_contest" in record ||
    "milestone_contest" in record ||
    "total_budget_cents" in record
  );
}

export function readPersistedPlatformCampaigns(
  details: Record<string, unknown> | null | undefined,
): PlatformCampaignsMap {
  if (!details || typeof details !== "object") return {};
  const map: PlatformCampaignsMap = {};

  // Preferred: platform payout objects live directly on contest_based_details.
  for (const platform of VIDEO_CONTEST_PLATFORMS) {
    const value = details[platform];
    if (isPersistedPlatformCampaignShape(value)) {
      map[platform] = value;
    }
  }
  if (Object.keys(map).length > 0) return map;

  // Legacy fallback: nested under platform_campaigns.
  const raw = details.platform_campaigns;
  if (!raw || typeof raw !== "object") return {};
  for (const [key, value] of Object.entries(
    raw as Record<string, PersistedPlatformCampaign>,
  )) {
    if (!isVideoContestPlatform(key) || !isPersistedPlatformCampaignShape(value)) {
      continue;
    }
    map[key] = value;
  }
  return map;
}

type LeaderboardPrizeBlock = NonNullable<
  PersistedPlatformCampaign["leaderboard_contest"]
>;

function normalizeLeaderboardPrizeRows(
  prizes: LeaderboardPrizeBlock["prizes"] | null | undefined,
): Array<{ position: number; amount: number }> {
  return [...(prizes ?? [])]
    .map((prize) => ({
      position: Number(prize?.position) || 0,
      amount: Number(prize?.amount) || 0,
    }))
    .sort((a, b) => a.position - b.position);
}

export function areLeaderboardPrizeStructuresEqual(
  left: LeaderboardPrizeBlock | null | undefined,
  right: LeaderboardPrizeBlock | null | undefined,
): boolean {
  const l = left ?? null;
  const r = right ?? null;
  if (!l && !r) return true;
  if (!l || !r) return false;
  if ((Number(l.winner_count) || 0) !== (Number(r.winner_count) || 0)) {
    return false;
  }
  if ((Number(l.total_prize) || 0) !== (Number(r.total_prize) || 0)) {
    return false;
  }
  return (
    JSON.stringify(normalizeLeaderboardPrizeRows(l.prizes)) ===
    JSON.stringify(normalizeLeaderboardPrizeRows(r.prizes))
  );
}

export function leaderboardPrizeStructuresDifferAcrossPlatforms(
  campaigns: PlatformCampaignsMap,
  platforms: VideoContestPlatform[],
): boolean {
  const blocks = platforms
    .map((platform) => campaigns[platform]?.leaderboard_contest)
    .filter((block): block is LeaderboardPrizeBlock => Boolean(block));
  if (blocks.length < 2) return false;
  return blocks
    .slice(1)
    .some((block) => !areLeaderboardPrizeStructuresEqual(blocks[0], block));
}

export type LeaderboardPrizeRow = { position: number; amount: number };

export type LeaderboardPrizeRankingPlan = {
  /**
   * True when prizes match across platforms (or there is only one ladder):
   * rank in the All tab across every leaderboard platform.
   */
  rankAcrossAllPlatforms: boolean;
  sharedPrizes: LeaderboardPrizeRow[];
  prizesByPlatform: Partial<
    Record<VideoContestPlatform, LeaderboardPrizeRow[]>
  >;
  leaderboardPlatforms: VideoContestPlatform[];
};

function readLeaderboardPrizeRows(
  block: LeaderboardPrizeBlock | null | undefined,
): LeaderboardPrizeRow[] {
  return normalizeLeaderboardPrizeRows(block?.prizes);
}

function isLeaderboardPlatformCampaign(
  campaign: PersistedPlatformCampaign | null | undefined,
): boolean {
  if (!campaign) return false;
  if (campaign.contest_type === "leaderboard") return true;
  return Boolean(campaign.leaderboard_contest);
}

/**
 * Same prize structure on every platform → one All-tab ranking.
 * Different per-platform prizes → independent ranking ladders.
 */
export function resolveLeaderboardPrizeRankingPlan(
  details: Record<string, unknown> | null | undefined,
  platformCsv?: string | null,
): LeaderboardPrizeRankingPlan {
  const campaigns = readPersistedPlatformCampaigns(details);
  const ordered = parseVideoContestPlatforms(platformCsv);
  const fromCsv = ordered.filter((platform) => campaigns[platform]);
  const campaignPlatforms =
    fromCsv.length > 0
      ? fromCsv
      : VIDEO_CONTEST_PLATFORMS.filter((platform) => campaigns[platform]);
  const leaderboardPlatforms = campaignPlatforms.filter((platform) =>
    isLeaderboardPlatformCampaign(campaigns[platform]),
  );

  const prizesByPlatform: Partial<
    Record<VideoContestPlatform, LeaderboardPrizeRow[]>
  > = {};
  for (const platform of leaderboardPlatforms) {
    prizesByPlatform[platform] = readLeaderboardPrizeRows(
      campaigns[platform]?.leaderboard_contest,
    );
  }

  const rootPrizes = readLeaderboardPrizeRows(
    (details as { leaderboard_contest?: LeaderboardPrizeBlock | null } | null)
      ?.leaderboard_contest,
  );
  const firstPlatformPrizes =
    leaderboardPlatforms.length > 0
      ? (prizesByPlatform[leaderboardPlatforms[0]] ?? [])
      : [];
  const sharedPrizes =
    firstPlatformPrizes.length > 0 ? firstPlatformPrizes : rootPrizes;

  const rankAcrossAllPlatforms =
    leaderboardPlatforms.length < 2 ||
    !leaderboardPrizeStructuresDifferAcrossPlatforms(
      campaigns,
      leaderboardPlatforms,
    );

  return {
    rankAcrossAllPlatforms,
    sharedPrizes,
    prizesByPlatform,
    leaderboardPlatforms,
  };
}

export function readCampaignFlatFeeBonusCents(
  campaign: PersistedPlatformCampaign | null | undefined,
): number {
  if (!campaign) return 0;
  return (
    Number(campaign.leaderboard_contest?.flat_fee_bonus) ||
    Number(campaign.cpm_contest?.flat_fee_bonus) ||
    0
  );
}

export function readCampaignFlatFeeBonusBudgetCents(
  campaign: PersistedPlatformCampaign | null | undefined,
): number | null {
  if (!campaign) return null;
  if (campaign.contest_type === "cpm" || campaign.contest_type === "dual_rewards") {
    const cap = Number(campaign.cpm_contest?.flat_fee_bonus_cap) || 0;
    const total = Number(campaign.cpm_contest?.total_budget) || 0;
    const budget = cap > 0 ? cap : total;
    return budget > 0 ? budget : null;
  }
  const total = Number(campaign.leaderboard_contest?.total_budget) || 0;
  return total > 0 ? total : null;
}

export type FlatFeeBonusLadder = {
  amountCents: number;
  budgetCents: number | null;
};

export type FlatFeeBonusPlan = {
  /** Same bonus + budget on every platform → one All-tab FCFS pool. */
  shareAcrossAllPlatforms: boolean;
  shared: FlatFeeBonusLadder;
  byPlatform: Partial<Record<VideoContestPlatform, FlatFeeBonusLadder>>;
  platforms: VideoContestPlatform[];
};

function ladderFromCampaign(
  campaign: PersistedPlatformCampaign | null | undefined,
): FlatFeeBonusLadder {
  return {
    amountCents: Math.max(0, readCampaignFlatFeeBonusCents(campaign)),
    budgetCents: readCampaignFlatFeeBonusBudgetCents(campaign),
  };
}

function rootFlatFeeBonusLadder(
  details: Record<string, unknown> | null | undefined,
  contestType?: string | null,
): FlatFeeBonusLadder {
  if (!details || typeof details !== "object") {
    return { amountCents: 0, budgetCents: null };
  }
  if (contestType === "cpm") {
    const cpm = details.cpm_contest as
      | {
          flat_fee_bonus?: number;
          total_budget?: number;
          flat_fee_bonus_cap?: number | null;
        }
      | undefined;
    const amount = Math.max(0, Number(cpm?.flat_fee_bonus) || 0);
    const cap = Number(cpm?.flat_fee_bonus_cap) || 0;
    const total = Number(cpm?.total_budget) || 0;
    const budget = cap > 0 ? cap : total;
    return { amountCents: amount, budgetCents: budget > 0 ? budget : null };
  }
  const lb = details.leaderboard_contest as
    | { flat_fee_bonus?: number; total_budget?: number }
    | undefined;
  const amount = Math.max(0, Number(lb?.flat_fee_bonus) || 0);
  const total = Number(lb?.total_budget) || 0;
  return { amountCents: amount, budgetCents: total > 0 ? total : null };
}

function flatFeeBonusLaddersEqual(
  left: FlatFeeBonusLadder,
  right: FlatFeeBonusLadder,
): boolean {
  return (
    left.amountCents === right.amountCents &&
    left.budgetCents === right.budgetCents
  );
}

function mergeFlatFeeBonusLadder(
  primary: FlatFeeBonusLadder | undefined,
  fallback: FlatFeeBonusLadder,
): FlatFeeBonusLadder {
  if (!primary) return fallback;
  return {
    amountCents:
      primary.amountCents > 0 ? primary.amountCents : fallback.amountCents,
    budgetCents:
      primary.budgetCents != null ? primary.budgetCents : fallback.budgetCents,
  };
}

/**
 * Same bonus (and bonus budget) on every platform → All-tab shared pool.
 * Different per-platform bonus/budget → independent FCFS ladders.
 */
export function resolveFlatFeeBonusPlan(
  details: Record<string, unknown> | null | undefined,
  platformCsv?: string | null,
  contestType?: string | null,
): FlatFeeBonusPlan {
  const campaigns = readPersistedPlatformCampaigns(details);
  const ordered = parseVideoContestPlatforms(platformCsv);
  const fromCsv = ordered.filter((platform) => campaigns[platform]);
  const platforms =
    fromCsv.length > 0
      ? fromCsv
      : VIDEO_CONTEST_PLATFORMS.filter((platform) => campaigns[platform]);

  const root = rootFlatFeeBonusLadder(details, contestType);
  const byPlatform: Partial<Record<VideoContestPlatform, FlatFeeBonusLadder>> =
    {};
  for (const platform of platforms) {
    byPlatform[platform] = ladderFromCampaign(campaigns[platform]);
  }

  const anyPlatformAmount = platforms.some(
    (platform) => (byPlatform[platform]?.amountCents || 0) > 0,
  );
  if (!anyPlatformAmount && root.amountCents > 0) {
    for (const platform of platforms) {
      byPlatform[platform] = mergeFlatFeeBonusLadder(
        byPlatform[platform],
        root,
      );
    }
  }

  const first = platforms.length > 0 ? byPlatform[platforms[0]] : undefined;
  const shared: FlatFeeBonusLadder = mergeFlatFeeBonusLadder(first, root);

  // Leaderboard bonus budgets are per-platform caps. Matching amounts still
  // run independent FCFS ladders so YouTube+Instagram+TikTok each keep their
  // own total_budget. CPM/dual keep a shared All-tab pool when ladders match.
  const shareAcrossAllPlatforms =
    contestType === "leaderboard"
      ? platforms.length < 2
      : platforms.length < 2 ||
        platforms.every((platform) =>
          flatFeeBonusLaddersEqual(byPlatform[platform] ?? shared, shared),
        );

  return {
    shareAcrossAllPlatforms,
    shared,
    byPlatform,
    platforms,
  };
}

export function flatFeeBonusLadderForSubmission(
  plan: FlatFeeBonusPlan,
  submissionPlatform?: string | null,
  contestPlatformCsv?: string | null,
): FlatFeeBonusLadder {
  if (plan.shareAcrossAllPlatforms || plan.platforms.length < 2) {
    return plan.shared;
  }
  const key =
    parseVideoContestPlatforms(submissionPlatform)[0] ??
    parseVideoContestPlatforms(contestPlatformCsv)[0] ??
    plan.platforms[0];
  return plan.byPlatform[key] ?? plan.shared;
}

export type FlatFeeBonusListDisplay =
  | { kind: "shared"; amountCents: number }
  | {
      kind: "byPlatform";
      rows: Array<{ platform: VideoContestPlatform; amountCents: number }>;
    };

/** List-card bonus badge: one amount when platforms match, else per-platform rows. */
export function resolveFlatFeeBonusListDisplay(
  details: Record<string, unknown> | null | undefined,
  platformCsv?: string | null,
  contestType?: string | null,
): FlatFeeBonusListDisplay | null {
  const plan = resolveFlatFeeBonusPlan(details, platformCsv, contestType);
  const rows = (
    plan.platforms.length > 0 ? plan.platforms : []
  )
    .map((platform) => ({
      platform,
      amountCents: Math.max(0, plan.byPlatform[platform]?.amountCents || 0),
    }))
    .filter((row) => row.amountCents > 0);

  if (rows.length === 0) {
    const shared = Math.max(0, plan.shared.amountCents);
    return shared > 0 ? { kind: "shared", amountCents: shared } : null;
  }

  const first = rows[0]!.amountCents;
  if (rows.length === 1 || rows.every((row) => row.amountCents === first)) {
    return { kind: "shared", amountCents: first };
  }

  return { kind: "byPlatform", rows };
}

export function flatFeeBonusesDifferAcrossPlatforms(
  campaigns: PlatformCampaignsMap,
  platforms: VideoContestPlatform[],
): boolean {
  if (platforms.length < 2) return false;
  if (!platforms.some((platform) => campaigns[platform])) return false;
  const first = readCampaignFlatFeeBonusCents(campaigns[platforms[0]]);
  return platforms
    .slice(1)
    .some(
      (platform) =>
        readCampaignFlatFeeBonusCents(campaigns[platform]) !== first,
    );
}

export function readLeaderboardBonusBudgetCents(
  campaign: PersistedPlatformCampaign | null | undefined,
): number {
  return Number(campaign?.leaderboard_contest?.total_budget) || 0;
}

export function leaderboardBonusBudgetsDifferAcrossPlatforms(
  campaigns: PlatformCampaignsMap,
  platforms: VideoContestPlatform[],
): boolean {
  if (platforms.length < 2) return false;
  if (!platforms.some((platform) => campaigns[platform])) return false;
  const first = readLeaderboardBonusBudgetCents(campaigns[platforms[0]]);
  return platforms
    .slice(1)
    .some(
      (platform) =>
        readLeaderboardBonusBudgetCents(campaigns[platform]) !== first,
    );
}

export function sumLeaderboardBonusBudgetCents(
  campaigns: PlatformCampaignsMap,
  platforms: VideoContestPlatform[],
): number {
  return platforms.reduce((sum, platform) => {
    return sum + readLeaderboardBonusBudgetCents(campaigns[platform]);
  }, 0);
}

function leaderboardPlatformsFromDetails(
  details: Record<string, unknown> | null | undefined,
  platformCsv?: string | null,
): VideoContestPlatform[] {
  const campaigns = readPersistedPlatformCampaigns(details);
  const ordered = parseVideoContestPlatforms(platformCsv);
  const fromCsv = ordered.filter((platform) => campaigns[platform]);
  return fromCsv.length > 0
    ? fromCsv
    : VIDEO_CONTEST_PLATFORMS.filter((platform) => campaigns[platform]);
}

/**
 * Flat-fee bonus pool for list/sort trackers.
 * Always sums per-platform total_budget when 2+ platform campaigns exist.
 * Root leaderboard_contest may only have budget_spent.
 */
export function resolveLeaderboardFlatFeeBonusBudgetCents(
  details: Record<string, unknown> | null | undefined,
  platformCsv?: string | null,
): number {
  const campaigns = readPersistedPlatformCampaigns(details);
  const platforms = leaderboardPlatformsFromDetails(details, platformCsv);
  if (platforms.length >= 2) {
    const summed = sumLeaderboardBonusBudgetCents(campaigns, platforms);
    if (summed > 0) return summed;
  }
  const plan = resolveFlatFeeBonusPlan(details, platformCsv, "leaderboard");
  return Math.max(0, plan.shared.budgetCents ?? 0);
}

/** Persisted bonus spend: sum per-platform budget_spent, else root. */
export function resolveLeaderboardFlatFeeBonusSpentCents(
  details: Record<string, unknown> | null | undefined,
  platformCsv?: string | null,
): number {
  const campaigns = readPersistedPlatformCampaigns(details);
  const platforms = leaderboardPlatformsFromDetails(details, platformCsv);
  if (platforms.length >= 2) {
    let sum = 0;
    let found = false;
    for (const platform of platforms) {
      const raw = campaigns[platform]?.leaderboard_contest?.budget_spent;
      if (typeof raw === "number" && Number.isFinite(raw)) {
        sum += Math.max(0, raw);
        found = true;
      }
    }
    if (found) return sum;
  }
  const lb =
    details && typeof details === "object"
      ? (details.leaderboard_contest as { budget_spent?: number } | undefined)
      : undefined;
  return Math.max(0, Number(lb?.budget_spent) || 0);
}

/** Normalize rich HTML so empty / whitespace-only briefs compare equal. */
export function normalizeHtmlForPlatformCompare(
  html: string | null | undefined,
): string {
  if (!html || !String(html).replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim()) {
    return "";
  }
  return String(html)
    .replace(/\s+/g, " ")
    .trim();
}

type PlatformContentContestRef = {
  brief_html?: string | null;
  brief_json?: unknown;
  rules_html?: string | null;
  rules_json?: unknown;
  platform?: string | null;
};

export function briefsDifferAcrossPlatforms(
  contest: PlatformContentContestRef | null | undefined,
  platforms: readonly VideoContestPlatform[],
): boolean {
  if (platforms.length < 2) return false;
  const first = normalizeHtmlForPlatformCompare(
    briefHtmlForPlatform(contest, platforms[0]),
  );
  return platforms
    .slice(1)
    .some(
      (platform) =>
        normalizeHtmlForPlatformCompare(
          briefHtmlForPlatform(contest, platform),
        ) !== first,
    );
}

export function rulesDifferAcrossPlatforms(
  contest: PlatformContentContestRef | null | undefined,
  platforms: readonly VideoContestPlatform[],
): boolean {
  if (platforms.length < 2) return false;
  const first = normalizeHtmlForPlatformCompare(
    rulesHtmlForPlatform(contest, platforms[0]),
  );
  return platforms
    .slice(1)
    .some(
      (platform) =>
        normalizeHtmlForPlatformCompare(
          rulesHtmlForPlatform(contest, platform),
        ) !== first,
    );
}

export function inspirationLinksDifferAcrossPlatforms(
  links: unknown,
  platforms: readonly VideoContestPlatform[],
): boolean {
  if (platforms.length < 2) return false;
  const first = JSON.stringify(
    inspirationLinksForPlatform(links, platforms[0]),
  );
  return platforms
    .slice(1)
    .some(
      (platform) =>
        JSON.stringify(inspirationLinksForPlatform(links, platform)) !== first,
    );
}

export function resourcesDifferAcrossPlatforms(
  resources: unknown,
  platforms: readonly VideoContestPlatform[],
): boolean {
  if (platforms.length < 2) return false;
  const first = JSON.stringify(resourcesForPlatform(resources, platforms[0]));
  return platforms
    .slice(1)
    .some(
      (platform) =>
        JSON.stringify(resourcesForPlatform(resources, platform)) !== first,
    );
}

export function bonusDetailsDifferAcrossPlatforms(
  bonusDetails: unknown,
  platforms: readonly VideoContestPlatform[],
): boolean {
  if (platforms.length < 2) return false;
  const first = normalizeHtmlForPlatformCompare(
    bonusDetailsForPlatform(bonusDetails, platforms[0])?.description_html,
  );
  return platforms
    .slice(1)
    .some(
      (platform) =>
        normalizeHtmlForPlatformCompare(
          bonusDetailsForPlatform(bonusDetails, platform)?.description_html,
        ) !== first,
    );
}

export function maxEarningsDifferAcrossPlatforms(
  maxEarnings: unknown,
  bonusDetails: unknown,
  platforms: readonly VideoContestPlatform[],
): boolean {
  if (platforms.length < 2) return false;
  const first =
    maxEarningsCentsForPlatform(maxEarnings, bonusDetails, platforms[0]) ?? 0;
  return platforms
    .slice(1)
    .some(
      (platform) =>
        (maxEarningsCentsForPlatform(maxEarnings, bonusDetails, platform) ??
          0) !== first,
    );
}

/**
 * CPM / milestone payout configs differ across platforms (leaderboard prizes
 * use separate helpers). Used to decide All-tab payout section splitting.
 */
export function videoPayoutConfigsDifferAcrossPlatforms(
  details: Record<string, unknown> | null | undefined,
  platforms: readonly VideoContestPlatform[],
): boolean {
  if (platforms.length < 2) return false;
  const serialize = (platform: VideoContestPlatform) => {
    const projected = withProjectedTopLevelPayout(
      details,
      platforms.join(","),
      platform,
    );
    return JSON.stringify({
      contestType: contestTypeForPlatform(details, platform),
      cpm: projected.cpm_contest ?? null,
      milestone: projected.milestone_contest ?? null,
    });
  };
  const first = serialize(platforms[0]!);
  return platforms.slice(1).some((platform) => serialize(platform) !== first);
}

export function attachPlatformCampaignsToDetails(
  details: Record<string, unknown>,
  platforms: VideoContestPlatform[],
  snapshots: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>,
): Record<string, unknown> {
  if (platforms.length < 2) {
    return clearPlatformCampaignKeys(details);
  }
  // Multi-platform: payout lives only under youtube|instagram|tiktok — never
  // also mirror primary onto root cpm_contest / milestone_contest / etc.
  const next = clearTopLevelPayoutKeys(
    clearPlatformCampaignKeys(details, platforms),
  );
  for (const platform of platforms) {
    const snap =
      snapshots[platform] ?? createDefaultPlatformCampaignSnapshot();
    next[platform] = snapshotToPersistedPlatformCampaign(snap);
  }
  return next;
}

export type PlatformRichTextPayload = {
  html: string;
  json: unknown;
};

export type PlatformContentColumns = {
  brief_html: string;
  brief_json: unknown;
  rules_html: string;
  rules_json: unknown;
  resources:
    | PlatformResourceItem[]
    | Partial<Record<VideoContestPlatform, PlatformResourceItem[]>>;
  inspiration_links:
    | PlatformInspirationLink[]
    | Partial<Record<VideoContestPlatform, PlatformInspirationLink[]>>;
};

/** True when a jsonb column is a platform-keyed map rather than a legacy array/doc. */
export function isPlatformKeyedContentMap(
  value: unknown,
): value is Partial<Record<VideoContestPlatform, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value as Record<string, unknown>).some((key) =>
    isVideoContestPlatform(key),
  );
}

function cloneResourceItems(
  items: PlatformResourceItem[] | undefined,
): PlatformResourceItem[] {
  return (items ?? []).map((item) => ({ ...item }));
}

function cloneInspirationLinks(
  items: PlatformInspirationLink[] | undefined,
): PlatformInspirationLink[] {
  return (items ?? []).map((item) => ({ ...item }));
}

/**
 * Build top-level contest content columns from per-platform snapshots.
 * Multi-platform contests store platform-keyed maps in the jsonb columns.
 */
export function buildPlatformContentColumns(
  platforms: VideoContestPlatform[],
  snapshots: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>,
): PlatformContentColumns {
  const primary = primaryPlatformOf(platforms);
  const primarySnap =
    snapshots[primary] ?? createDefaultPlatformCampaignSnapshot();

  if (platforms.length < 2) {
    return {
      brief_html: primarySnap.briefHtml || primarySnap.brief || "",
      brief_json: primarySnap.briefJson ?? null,
      rules_html: primarySnap.rulesHtml || "",
      rules_json: primarySnap.rulesJson ?? null,
      resources: cloneResourceItems(primarySnap.resources),
      inspiration_links: cloneInspirationLinks(primarySnap.inspirationLinks),
    };
  }

  const briefMap: Partial<Record<VideoContestPlatform, PlatformRichTextPayload>> =
    {};
  const rulesMap: Partial<Record<VideoContestPlatform, PlatformRichTextPayload>> =
    {};
  const resourcesMap: Partial<
    Record<VideoContestPlatform, PlatformResourceItem[]>
  > = {};
  const inspirationMap: Partial<
    Record<VideoContestPlatform, PlatformInspirationLink[]>
  > = {};

  for (const platform of platforms) {
    const snap =
      snapshots[platform] ?? createDefaultPlatformCampaignSnapshot();
    briefMap[platform] = {
      html: snap.briefHtml || snap.brief || "",
      json: snap.briefJson ?? null,
    };
    rulesMap[platform] = {
      html: snap.rulesHtml || "",
      json: snap.rulesJson ?? null,
    };
    resourcesMap[platform] = cloneResourceItems(snap.resources);
    inspirationMap[platform] = cloneInspirationLinks(snap.inspirationLinks);
  }

  return {
    brief_html: primarySnap.briefHtml || primarySnap.brief || "",
    brief_json: briefMap,
    rules_html: primarySnap.rulesHtml || "",
    rules_json: rulesMap,
    resources: resourcesMap,
    inspiration_links: inspirationMap,
  };
}

function readRichTextPayload(
  value: unknown,
): PlatformRichTextPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.html === "string" || "json" in record) {
    return {
      html: typeof record.html === "string" ? record.html : "",
      json: record.json ?? null,
    };
  }
  return null;
}

/**
 * Merge top-level content columns (and legacy platform_campaigns content)
 * into per-platform snapshots used by the create/edit UI.
 */
export function applyPlatformContentColumnsToSnapshots(
  platforms: VideoContestPlatform[],
  columns: {
    brief_html?: string | null;
    brief_json?: unknown;
    rules_html?: string | null;
    rules_json?: unknown;
    resources?: unknown;
    inspiration_links?: unknown;
  },
  existing: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>,
): Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>> {
  const next: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>> =
    { ...existing };
  const primary = primaryPlatformOf(platforms);
  const briefKeyed = isPlatformKeyedContentMap(columns.brief_json);
  const rulesKeyed = isPlatformKeyedContentMap(columns.rules_json);
  const resourcesKeyed = isPlatformKeyedContentMap(columns.resources);
  const inspirationKeyed = isPlatformKeyedContentMap(columns.inspiration_links);

  for (const platform of platforms) {
    const snap = clonePlatformCampaignSnapshot(
      next[platform] ?? createDefaultPlatformCampaignSnapshot(),
    );

    if (briefKeyed) {
      const payload = readRichTextPayload(
        (columns.brief_json as Record<string, unknown>)[platform],
      );
      if (payload) {
        snap.briefHtml = payload.html;
        snap.brief = payload.html;
        snap.briefJson = payload.json;
      }
    } else if (platform === primary) {
      if (columns.brief_html) {
        snap.briefHtml = columns.brief_html;
        snap.brief = columns.brief_html;
      }
      if (columns.brief_json !== undefined) {
        snap.briefJson = columns.brief_json;
      }
    }

    if (rulesKeyed) {
      const payload = readRichTextPayload(
        (columns.rules_json as Record<string, unknown>)[platform],
      );
      if (payload) {
        snap.rulesHtml = payload.html;
        snap.rulesJson = payload.json;
      }
    } else if (platform === primary) {
      if (columns.rules_html) {
        snap.rulesHtml = columns.rules_html;
      }
      if (columns.rules_json !== undefined) {
        snap.rulesJson = columns.rules_json;
      }
    }

    if (resourcesKeyed) {
      const list = (columns.resources as Record<string, unknown>)[platform];
      if (Array.isArray(list)) {
        snap.resources = cloneResourceItems(list as PlatformResourceItem[]);
      }
    } else if (platform === primary && Array.isArray(columns.resources)) {
      snap.resources = cloneResourceItems(
        columns.resources as PlatformResourceItem[],
      );
    }

    if (inspirationKeyed) {
      const list = (columns.inspiration_links as Record<string, unknown>)[
        platform
      ];
      if (Array.isArray(list)) {
        snap.inspirationLinks = cloneInspirationLinks(
          list as PlatformInspirationLink[],
        );
      }
    } else if (
      platform === primary &&
      Array.isArray(columns.inspiration_links)
    ) {
      snap.inspirationLinks = cloneInspirationLinks(
        columns.inspiration_links as PlatformInspirationLink[],
      );
    }

    // Legacy fallback: content previously nested under platform_campaigns.
    const legacy = existing[platform];
    if (legacy) {
      if (!(snap.briefHtml || snap.brief) && (legacy.briefHtml || legacy.brief)) {
        snap.briefHtml = legacy.briefHtml || legacy.brief;
        snap.brief = legacy.briefHtml || legacy.brief;
        snap.briefJson = legacy.briefJson ?? null;
      }
      if (!snap.rulesHtml && legacy.rulesHtml) {
        snap.rulesHtml = legacy.rulesHtml;
        snap.rulesJson = legacy.rulesJson ?? null;
      }
      if (!(snap.resources ?? []).length && (legacy.resources ?? []).length) {
        snap.resources = cloneResourceItems(legacy.resources);
      }
      if (
        !(snap.inspirationLinks ?? []).length &&
        (legacy.inspirationLinks ?? []).length
      ) {
        snap.inspirationLinks = cloneInspirationLinks(legacy.inspirationLinks);
      }
    }

    next[platform] = snap;
  }

  return next;
}

export type PlatformBonusPayload = {
  description_html?: string;
  description_json?: unknown;
};

export type PlatformMaxEarningsPayload = {
  max_earnings_per_creator: number | null;
};

export type PlatformCreatorEarningsColumns = {
  /**
   * Single-platform: cents number (or null).
   * Multi-platform: { youtube|instagram|tiktok: { max_earnings_per_creator } }.
   */
  max_earnings_per_creator:
    | number
    | null
    | Partial<Record<VideoContestPlatform, PlatformMaxEarningsPayload>>;
  /**
   * Single-platform: classic { description_html, description_json }.
   * Multi-platform: { youtube|instagram|tiktok: PlatformBonusPayload }.
   */
  bonus_details: PlatformBonusPayload | Partial<
    Record<VideoContestPlatform, PlatformBonusPayload>
  > | null;
};

function bonusTextFromSnapshot(
  snap: PlatformCampaignSnapshot,
): PlatformBonusPayload | null {
  if (!(snap.bonusEnabled && snap.bonusHtml)) return null;
  return {
    description_html: snap.bonusHtml,
    description_json: snap.bonusJson ?? null,
  };
}

function readBonusPayload(value: unknown): PlatformBonusPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (isPlatformKeyedContentMap(value) && !("description_html" in record)) {
    return null;
  }
  const html =
    typeof record.description_html === "string"
      ? record.description_html
      : typeof record.description === "string"
        ? record.description
        : undefined;
  if (!html && !("description_json" in record)) return null;
  return {
    description_html: html,
    description_json: record.description_json,
  };
}

function readMaxEarningsCents(value: unknown): number | null {
  if (typeof value === "number" && value > 0) return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.max_earnings_per_creator === "number" &&
    record.max_earnings_per_creator > 0
  ) {
    return record.max_earnings_per_creator;
  }
  return null;
}

function isPlatformKeyedMaxEarningsMap(
  value: unknown,
): value is Partial<Record<VideoContestPlatform, unknown>> {
  return isPlatformKeyedContentMap(value);
}

/** Build top-level bonus_details + max_earnings_per_creator from snapshots. */
export function buildPlatformCreatorEarningsColumns(
  platforms: VideoContestPlatform[],
  snapshots: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>,
): PlatformCreatorEarningsColumns {
  const primary = primaryPlatformOf(platforms);
  const primarySnap =
    snapshots[primary] ?? createDefaultPlatformCampaignSnapshot();
  const primaryMax = dollarsToCents(primarySnap.maxEarningsPerCreator);

  if (platforms.length < 2) {
    return {
      max_earnings_per_creator: primaryMax > 0 ? primaryMax : null,
      bonus_details: bonusTextFromSnapshot(primarySnap),
    };
  }

  const bonusMap: Partial<Record<VideoContestPlatform, PlatformBonusPayload>> =
    {};
  const maxMap: Partial<
    Record<VideoContestPlatform, PlatformMaxEarningsPayload>
  > = {};
  let anyBonus = false;
  let anyMax = false;

  for (const platform of platforms) {
    const snap =
      snapshots[platform] ?? createDefaultPlatformCampaignSnapshot();
    const bonus = bonusTextFromSnapshot(snap);
    if (bonus) {
      bonusMap[platform] = bonus;
      anyBonus = true;
    }
    const maxCents = dollarsToCents(snap.maxEarningsPerCreator);
    maxMap[platform] = {
      max_earnings_per_creator: maxCents > 0 ? maxCents : null,
    };
    if (maxCents > 0) anyMax = true;
  }

  return {
    max_earnings_per_creator: anyMax ? maxMap : null,
    bonus_details: anyBonus ? bonusMap : null,
  };
}

/** Hydrate snapshots from top-level creator-earnings columns. */
export function applyPlatformCreatorEarningsColumnsToSnapshots(
  platforms: VideoContestPlatform[],
  columns: {
    max_earnings_per_creator?: number | null | unknown;
    bonus_details?: unknown;
  },
  existing: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>,
): Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>> {
  const next: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>> =
    { ...existing };
  const primary = primaryPlatformOf(platforms);
  const bonusKeyed = isPlatformKeyedContentMap(columns.bonus_details);
  const maxKeyed = isPlatformKeyedMaxEarningsMap(
    columns.max_earnings_per_creator,
  );
  const legacyBonus = !bonusKeyed
    ? readBonusPayload(columns.bonus_details)
    : null;
  const topLevelMax = !maxKeyed
    ? readMaxEarningsCents(columns.max_earnings_per_creator)
    : null;

  for (const platform of platforms) {
    const snap = clonePlatformCampaignSnapshot(
      next[platform] ?? createDefaultPlatformCampaignSnapshot(),
    );

    if (bonusKeyed) {
      const payload = readBonusPayload(
        (columns.bonus_details as Record<string, unknown>)[platform],
      );
      if (payload?.description_html) {
        snap.bonusEnabled = true;
        snap.bonusHtml = payload.description_html;
        snap.bonusJson = payload.description_json ?? null;
      }
    } else if (platform === primary || (!snap.bonusEnabled && legacyBonus)) {
      if (legacyBonus?.description_html) {
        snap.bonusEnabled = true;
        snap.bonusHtml = legacyBonus.description_html;
        snap.bonusJson = legacyBonus.description_json ?? null;
      }
    }

    if (maxKeyed) {
      const cents = readMaxEarningsCents(
        (columns.max_earnings_per_creator as Record<string, unknown>)[
          platform
        ],
      );
      if (cents) {
        snap.maxEarningsPerCreator = (cents / 100).toString();
      }
    } else if (topLevelMax) {
      // Legacy flat int, or max nested inside old bonus_details payloads.
      if (platform === primary || !snap.maxEarningsPerCreator) {
        snap.maxEarningsPerCreator = (topLevelMax / 100).toString();
      }
    } else if (bonusKeyed) {
      // Legacy: max was nested under bonus_details[platform].
      const cents = readMaxEarningsCents(
        (columns.bonus_details as Record<string, unknown>)[platform],
      );
      if (cents) {
        snap.maxEarningsPerCreator = (cents / 100).toString();
      }
    }

    // Legacy fallback: previously nested under platform payout objects.
    const legacy = existing[platform];
    if (legacy) {
      if (!snap.maxEarningsPerCreator && legacy.maxEarningsPerCreator) {
        snap.maxEarningsPerCreator = legacy.maxEarningsPerCreator;
      }
      if (!snap.bonusEnabled && legacy.bonusEnabled && legacy.bonusHtml) {
        snap.bonusEnabled = true;
        snap.bonusHtml = legacy.bonusHtml;
        snap.bonusJson = legacy.bonusJson ?? null;
      }
    }

    next[platform] = snap;
  }

  return next;
}

/** Resolve bonus HTML/JSON for display (primary or requested platform). */
export function bonusDetailsForPlatform(
  bonusDetails: unknown,
  platform?: VideoContestPlatform | string | null,
): PlatformBonusPayload | null {
  if (!bonusDetails || typeof bonusDetails !== "object") return null;
  if (isPlatformKeyedContentMap(bonusDetails)) {
    const key = isVideoContestPlatform(platform)
      ? platform
      : parseVideoContestPlatforms(platform)[0];
    if (key) {
      return readBonusPayload(
        (bonusDetails as Record<string, unknown>)[key],
      );
    }
    for (const p of VIDEO_CONTEST_PLATFORMS) {
      const payload = readBonusPayload(
        (bonusDetails as Record<string, unknown>)[p],
      );
      if (payload?.description_html) return payload;
    }
    return null;
  }
  return readBonusPayload(bonusDetails);
}

/** Contest-shaped helper used by list cards and similar UI. */
export function resolveBonusDetails(
  contest:
    | {
        bonus_details?: unknown;
        platform?: string | null;
      }
    | null
    | undefined,
): PlatformBonusPayload | null {
  if (!contest) return null;
  return bonusDetailsForPlatform(contest.bonus_details, contest.platform);
}

/** Resolve max earnings cents for a platform (column map, int, or legacy bonus). */
export function maxEarningsCentsForPlatform(
  maxEarnings: unknown,
  bonusDetails: unknown,
  platform?: VideoContestPlatform | string | null,
): number | null {
  const key = isVideoContestPlatform(platform)
    ? platform
    : parseVideoContestPlatforms(platform)[0];

  if (isPlatformKeyedMaxEarningsMap(maxEarnings)) {
    if (key) {
      const cents = readMaxEarningsCents(
        (maxEarnings as Record<string, unknown>)[key],
      );
      if (cents) return cents;
    }
    for (const p of VIDEO_CONTEST_PLATFORMS) {
      const cents = readMaxEarningsCents(
        (maxEarnings as Record<string, unknown>)[p],
      );
      if (cents) return cents;
    }
  }

  if (typeof maxEarnings === "number" && maxEarnings > 0) return maxEarnings;

  // Legacy: max nested under bonus_details platform map / payload.
  if (isPlatformKeyedContentMap(bonusDetails)) {
    if (key) {
      const cents = readMaxEarningsCents(
        (bonusDetails as Record<string, unknown>)[key],
      );
      if (cents) return cents;
    }
  }
  return readMaxEarningsCents(bonusDetails);
}

/**
 * Resolve a single cents cap for payout/budget code that still expects a number.
 * Uses the requested/primary platform when the column is a platform-keyed map.
 */
export function resolveMaxEarningsPerCreatorCents(
  contest:
    | {
        max_earnings_per_creator?: unknown;
        bonus_details?: unknown;
        platform?: string | null;
      }
    | null
    | undefined,
  platform?: VideoContestPlatform | string | null,
): number | null {
  if (!contest) return null;
  return maxEarningsCentsForPlatform(
    contest.max_earnings_per_creator,
    contest.bonus_details,
    platform ?? contest.platform,
  );
}

export type MaxEarningsContestInput = {
  max_earnings_per_creator?: unknown;
  bonus_details?: unknown;
  platform?: string | null;
  contest_based_details?: Record<string, unknown> | null;
};

export function isKeyedMaxEarningsMap(value: unknown): boolean {
  return isPlatformKeyedMaxEarningsMap(value);
}

/**
 * Cap for one submission's platform. Keyed maps do not fall back to another
 * platform's cap. A legacy number applies contest-wide.
 */
export function resolveMaxEarningsCentsForSubmission(
  contest: MaxEarningsContestInput | null | undefined,
  submissionPlatform?: string | null,
): number | null {
  if (!contest) return null;
  const platform = videoContestPlatformFromValue(submissionPlatform);

  if (isPlatformKeyedMaxEarningsMap(contest.max_earnings_per_creator)) {
    if (!platform) return null;
    const fromColumn = readMaxEarningsCents(
      (contest.max_earnings_per_creator as Record<string, unknown>)[platform],
    );
    if (fromColumn) return fromColumn;
    const campaigns = readPersistedPlatformCampaigns(
      contest.contest_based_details,
    );
    const fromCampaign = readMaxEarningsCents(
      campaigns[platform]?.max_earnings_per_creator,
    );
    if (fromCampaign) return fromCampaign;
    const cpm = resolveCpmContestConfigForPlatform(
      contest.contest_based_details,
      platform,
      contest.platform,
    );
    const fromCpm = Number(cpm?.max_earnings_per_creator || 0);
    return fromCpm > 0 ? fromCpm : null;
  }

  if (
    typeof contest.max_earnings_per_creator === "number" &&
    contest.max_earnings_per_creator > 0
  ) {
    return contest.max_earnings_per_creator;
  }

  if (platform) {
    const campaigns = readPersistedPlatformCampaigns(
      contest.contest_based_details,
    );
    const fromCampaign = readMaxEarningsCents(
      campaigns[platform]?.max_earnings_per_creator,
    );
    if (fromCampaign) return fromCampaign;
    const cpm = resolveCpmContestConfigForPlatform(
      contest.contest_based_details,
      platform,
      contest.platform,
    );
    const fromCpm = Number(cpm?.max_earnings_per_creator || 0);
    if (fromCpm > 0) return fromCpm;
  }

  return maxEarningsCentsForPlatform(
    contest.max_earnings_per_creator,
    contest.bonus_details,
    platform ?? contest.platform,
  );
}

/** Seed creator-earning fields from legacy top-level contest columns when missing. */
export function applyLegacyCreatorEarningsToSnapshots(
  platforms: VideoContestPlatform[],
  columns: {
    max_earnings_per_creator?: number | null | unknown;
    bonus_details?: unknown;
  },
  existing: Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>>,
): Partial<Record<VideoContestPlatform, PlatformCampaignSnapshot>> {
  return applyPlatformCreatorEarningsColumnsToSnapshots(
    platforms,
    columns,
    existing,
  );
}

/** Flatten platform-keyed or legacy resource lists for display / cleanup. */
export function flattenContestResources(
  resources: unknown,
): PlatformResourceItem[] {
  if (Array.isArray(resources)) {
    return cloneResourceItems(resources as PlatformResourceItem[]);
  }
  if (!isPlatformKeyedContentMap(resources)) return [];
  const out: PlatformResourceItem[] = [];
  for (const platform of VIDEO_CONTEST_PLATFORMS) {
    const list = resources[platform];
    if (Array.isArray(list)) {
      out.push(...cloneResourceItems(list as PlatformResourceItem[]));
    }
  }
  return out;
}

/** Flatten platform-keyed or legacy inspiration lists for display. */
export function flattenContestInspirationLinks(
  links: unknown,
): PlatformInspirationLink[] {
  if (Array.isArray(links)) {
    return cloneInspirationLinks(links as PlatformInspirationLink[]);
  }
  if (!isPlatformKeyedContentMap(links)) return [];
  const out: PlatformInspirationLink[] = [];
  for (const platform of VIDEO_CONTEST_PLATFORMS) {
    const list = links[platform];
    if (Array.isArray(list)) {
      out.push(...cloneInspirationLinks(list as PlatformInspirationLink[]));
    }
  }
  return out;
}

export function resourcesForPlatform(
  resources: unknown,
  platform: VideoContestPlatform | string | null | undefined,
): PlatformResourceItem[] {
  if (Array.isArray(resources)) {
    return cloneResourceItems(resources as PlatformResourceItem[]);
  }
  if (!isPlatformKeyedContentMap(resources)) return [];
  const key = isVideoContestPlatform(platform)
    ? platform
    : parseVideoContestPlatforms(platform)[0];
  if (!key) return flattenContestResources(resources);
  return cloneResourceItems(
    (resources[key] as PlatformResourceItem[] | undefined) ?? [],
  );
}

export function inspirationLinksForPlatform(
  links: unknown,
  platform: VideoContestPlatform | string | null | undefined,
): PlatformInspirationLink[] {
  if (Array.isArray(links)) {
    return cloneInspirationLinks(links as PlatformInspirationLink[]);
  }
  if (!isPlatformKeyedContentMap(links)) return [];
  const key = isVideoContestPlatform(platform)
    ? platform
    : parseVideoContestPlatforms(platform)[0];
  if (!key) return flattenContestInspirationLinks(links);
  return cloneInspirationLinks(
    (links[key] as PlatformInspirationLink[] | undefined) ?? [],
  );
}

type ContestContentColumns = {
  brief_html?: string | null;
  brief_json?: unknown;
  rules_html?: string | null;
  rules_json?: unknown;
  platform?: string | null;
};

function resolvePlatformContentKey(
  contest: ContestContentColumns | null | undefined,
  platform?: VideoContestPlatform | string | null,
): VideoContestPlatform | undefined {
  if (isVideoContestPlatform(platform)) return platform;
  const fromArg = parseVideoContestPlatforms(platform)[0];
  if (fromArg) return fromArg;
  return parseVideoContestPlatforms(contest?.platform)[0];
}

/** Resolve brief HTML for a platform from keyed brief_json or legacy brief_html. */
export function briefHtmlForPlatform(
  contest: ContestContentColumns | null | undefined,
  platform?: VideoContestPlatform | string | null,
): string {
  if (!contest) return "";
  const key = resolvePlatformContentKey(contest, platform);
  if (isPlatformKeyedContentMap(contest.brief_json) && key) {
    const payload = readRichTextPayload(
      (contest.brief_json as Record<string, unknown>)[key],
    );
    if (payload) return payload.html || "";
  }
  const primary = parseVideoContestPlatforms(contest.platform)[0];
  if (!key || key === primary || !isPlatformKeyedContentMap(contest.brief_json)) {
    return contest.brief_html || "";
  }
  return "";
}

/** Resolve rules HTML for a platform from keyed rules_json or legacy rules_html. */
export function rulesHtmlForPlatform(
  contest: ContestContentColumns | null | undefined,
  platform?: VideoContestPlatform | string | null,
): string {
  if (!contest) return "";
  const key = resolvePlatformContentKey(contest, platform);
  if (isPlatformKeyedContentMap(contest.rules_json) && key) {
    const payload = readRichTextPayload(
      (contest.rules_json as Record<string, unknown>)[key],
    );
    if (payload) return payload.html || "";
  }
  const primary = parseVideoContestPlatforms(contest.platform)[0];
  if (!key || key === primary || !isPlatformKeyedContentMap(contest.rules_json)) {
    return (contest.rules_html as string | null | undefined) || "";
  }
  return "";
}

/** Contest type stored under a platform payout key (falls back to contest.contest_type). */
export function contestTypeForPlatform(
  details: Record<string, unknown> | null | undefined,
  platform?: VideoContestPlatform | string | null,
  fallback?: string | null,
): VideoContestType | string | null | undefined {
  const campaigns = readPersistedPlatformCampaigns(details);
  const key = isVideoContestPlatform(platform)
    ? platform
    : parseVideoContestPlatforms(platform)[0];
  if (key && campaigns[key]?.contest_type) {
    return campaigns[key]!.contest_type;
  }
  return fallback;
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
  if (platforms.length === 0) return 0;
  const primary =
    snapshots[platforms[0]] ?? createDefaultPlatformCampaignSnapshot();

  // Pool-based types share one Total Campaign Budget across platforms.
  if (primary.contestType !== "leaderboard") {
    return dollarsToCents(primary.totalBudget);
  }

  // Leaderboard: sum per-platform prize pools and per-platform bonus budgets.
  let total = 0;
  for (const platform of platforms) {
    const snap =
      snapshots[platform] ?? createDefaultPlatformCampaignSnapshot();
    total += getSnapshotChargeableCents(snap);
  }
  return total;
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
  const entries = VIDEO_CONTEST_PLATFORMS.map((platform) => campaigns[platform])
    .filter((c): c is PersistedPlatformCampaign => Boolean(c));
  if (entries.length < 2) return null;

  const primary = entries[0]!;
  if (primary.contest_type !== "leaderboard") {
    return getPersistedPlatformChargeableCents(primary);
  }

  let total = 0;
  for (const campaign of entries) {
    total += getPersistedPlatformChargeableCents(campaign);
  }
  return total;
}

/**
 * Resolve display/chargeable pool budget for a contest, including multi-platform
 * payouts stored under youtube|instagram|tiktok keys.
 */
export function resolveContestPoolBudgetCents(
  contestType: string | null | undefined,
  details: Record<string, unknown> | null | undefined,
  platformCsv?: string | null,
): number {
  const projected = withProjectedTopLevelPayout(details, platformCsv);
  const fromProjected = getPoolBudgetCentsFromDetails(
    contestType,
    projected as ContestBasedDetailsForPool,
  );
  if (fromProjected > 0) return fromProjected;

  const multi = sumPersistedPlatformCampaignsChargeableCents(details);
  if (multi != null && multi > 0) return multi;

  return getPoolBudgetCentsFromDetails(
    contestType,
    (details as ContestBasedDetailsForPool) ?? null,
  );
}

export type ContestPlatformCpmRate = {
  platform: VideoContestPlatform;
  rateUsd: number;
};

function readCpmRateUsd(cpm: unknown): number | null {
  if (!cpm || typeof cpm !== "object") return null;
  const raw = (cpm as { cpm_rate_usd?: unknown }).cpm_rate_usd;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = parseFloat(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export type ResolvedCpmContestConfig = {
  cpm_rate_usd: number;
  min_views?: number | null;
  max_views?: number | null;
  flat_fee_bonus?: number;
  flat_fee_bonus_cap?: number | null;
  max_earnings_per_creator?: number | null;
  total_budget?: number;
};

export function videoContestPlatformFromValue(
  value?: string | null,
): VideoContestPlatform | null {
  const parsed = parseVideoContestPlatforms(value);
  if (parsed.length === 1) return parsed[0];
  return null;
}

function asResolvedCpmConfig(cpm: unknown): ResolvedCpmContestConfig | null {
  const rate = readCpmRateUsd(cpm);
  if (rate == null || !(rate > 0)) return null;
  const obj = cpm as {
    min_views?: number | null;
    max_views?: number | null;
    flat_fee_bonus?: number;
    flat_fee_bonus_cap?: number | null;
    max_earnings_per_creator?: number | null;
    total_budget?: number;
  };
  return {
    cpm_rate_usd: rate,
    min_views: obj.min_views,
    max_views: obj.max_views,
    flat_fee_bonus: obj.flat_fee_bonus,
    flat_fee_bonus_cap: obj.flat_fee_bonus_cap,
    max_earnings_per_creator: obj.max_earnings_per_creator,
    total_budget: obj.total_budget,
  };
}

function rootCpmFromDetails(
  details: Record<string, unknown> | null | undefined,
): unknown {
  if (!details || typeof details !== "object") return null;
  return (details as { cpm_contest?: unknown }).cpm_contest;
}

/**
 * CPM payout config for one submission/platform. Multi-platform contests store
 * rates under youtube|instagram|tiktok; root cpm_contest is often empty.
 * A persisted `cpm_rate_usd: 0` (empty editor field) is treated as missing so
 * TikTok/Instagram can inherit a usable rate without inheriting another
 * platform's min/max view gates.
 */
export function resolveCpmContestConfigForPlatform(
  details: Record<string, unknown> | null | undefined,
  submissionPlatform?: string | null,
  contestPlatformCsv?: string | null,
): ResolvedCpmContestConfig | null {
  const campaigns = readPersistedPlatformCampaigns(details);
  const platform = videoContestPlatformFromValue(submissionPlatform);
  const platformRaw =
    platform && campaigns[platform]
      ? campaigns[platform]?.cpm_contest
      : undefined;
  const fromPlatform = asResolvedCpmConfig(platformRaw);
  if (fromPlatform) return fromPlatform;

  const fromRoot = asResolvedCpmConfig(rootCpmFromDetails(details));
  const projected = asResolvedCpmConfig(
    withProjectedTopLevelPayout(details, contestPlatformCsv).cpm_contest,
  );
  const fallback = fromRoot ?? projected;
  if (!fallback) return null;

  if (platformRaw && typeof platformRaw === "object") {
    const raw = platformRaw as {
      min_views?: number | null;
      max_views?: number | null;
      flat_fee_bonus?: number;
      flat_fee_bonus_cap?: number | null;
      max_earnings_per_creator?: number | null;
      total_budget?: number;
    };
    return {
      ...fallback,
      min_views: raw.min_views !== undefined ? raw.min_views : fallback.min_views,
      max_views: raw.max_views !== undefined ? raw.max_views : fallback.max_views,
      flat_fee_bonus:
        raw.flat_fee_bonus !== undefined
          ? raw.flat_fee_bonus
          : fallback.flat_fee_bonus,
      flat_fee_bonus_cap:
        raw.flat_fee_bonus_cap !== undefined
          ? raw.flat_fee_bonus_cap
          : fallback.flat_fee_bonus_cap,
      max_earnings_per_creator:
        raw.max_earnings_per_creator !== undefined
          ? raw.max_earnings_per_creator
          : fallback.max_earnings_per_creator,
      total_budget:
        raw.total_budget !== undefined ? raw.total_budget : fallback.total_budget,
    };
  }

  return fallback;
}

export function contestHasUsableCpmRate(
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv?: string | null,
): boolean {
  const campaigns = readPersistedPlatformCampaigns(details);
  for (const platform of VIDEO_CONTEST_PLATFORMS) {
    const rate = readCpmRateUsd(campaigns[platform]?.cpm_contest);
    if (rate != null && rate > 0) return true;
  }
  return resolveCpmContestConfigForPlatform(details, null, contestPlatformCsv) !=
    null;
}

export type ResolvedMilestoneContestConfig = {
  milestones: Array<{
    order?: number;
    target_views: number;
    payout_cents: number;
    winner_limit: number | null;
  }>;
  total_budget_cents?: number;
  bonus?: Record<string, unknown>;
};

function asResolvedMilestoneConfig(
  milestone: unknown,
): ResolvedMilestoneContestConfig | null {
  if (!milestone || typeof milestone !== "object") return null;
  const obj = milestone as {
    milestones?: unknown;
    total_budget_cents?: number;
    bonus?: Record<string, unknown>;
  };
  if (!Array.isArray(obj.milestones) || obj.milestones.length === 0) {
    return null;
  }
  const milestones: ResolvedMilestoneContestConfig["milestones"] = [];
  for (const row of obj.milestones) {
    if (!row || typeof row !== "object") continue;
    const m = row as {
      order?: number;
      target_views?: number;
      payout_cents?: number;
      winner_limit?: number | null;
    };
    const target = Number(m.target_views || 0);
    if (!(target > 0)) continue;
    const rawLimit = m.winner_limit;
    const parsedLimit =
      rawLimit == null || rawLimit === ("" as unknown)
        ? null
        : Number(rawLimit);
    milestones.push({
      order: typeof m.order === "number" ? m.order : undefined,
      target_views: target,
      payout_cents: Number(m.payout_cents || 0),
      winner_limit:
        parsedLimit != null && Number.isFinite(parsedLimit) ? parsedLimit : null,
    });
  }
  if (milestones.length === 0) return null;
  return {
    milestones,
    total_budget_cents: obj.total_budget_cents,
    bonus: obj.bonus,
  };
}

function rootMilestoneFromDetails(
  details: Record<string, unknown> | null | undefined,
): unknown {
  if (!details || typeof details !== "object") return null;
  return (details as { milestone_contest?: unknown }).milestone_contest;
}

/**
 * Milestone ladder for one submission/platform. Multi-platform contests store
 * ladders under youtube|instagram|tiktok; root milestone_contest is often empty.
 */
export function resolveMilestoneContestForPlatform(
  details: Record<string, unknown> | null | undefined,
  submissionPlatform?: string | null,
  contestPlatformCsv?: string | null,
): ResolvedMilestoneContestConfig | null {
  const campaigns = readPersistedPlatformCampaigns(details);
  const platform = videoContestPlatformFromValue(submissionPlatform);
  if (platform) {
    const fromPlatform = asResolvedMilestoneConfig(
      campaigns[platform]?.milestone_contest,
    );
    if (fromPlatform) return fromPlatform;
  }

  const fromRoot = asResolvedMilestoneConfig(rootMilestoneFromDetails(details));
  if (fromRoot) return fromRoot;

  const projected = withProjectedTopLevelPayout(details, contestPlatformCsv);
  return asResolvedMilestoneConfig(projected.milestone_contest);
}

export function contestHasUsableMilestoneLadder(
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv?: string | null,
): boolean {
  const campaigns = readPersistedPlatformCampaigns(details);
  for (const platform of VIDEO_CONTEST_PLATFORMS) {
    if (asResolvedMilestoneConfig(campaigns[platform]?.milestone_contest)) {
      return true;
    }
  }
  return resolveMilestoneContestForPlatform(details, null, contestPlatformCsv) !=
    null;
}

/**
 * CPM rates for list/detail display. Prefers per-platform payout keys when
 * present (multi-platform contests clear root cpm_contest on save).
 */
export function resolveContestPlatformCpmRates(
  details: Record<string, unknown> | null | undefined,
  platformCsv?: string | null,
): ContestPlatformCpmRate[] {
  const campaigns = readPersistedPlatformCampaigns(details);
  const ordered = parseVideoContestPlatforms(platformCsv);
  const platforms =
    ordered.length > 0
      ? ordered
      : VIDEO_CONTEST_PLATFORMS.filter((p) => campaigns[p]);

  const fromPlatforms: ContestPlatformCpmRate[] = [];
  for (const platform of platforms) {
    const rate = readCpmRateUsd(campaigns[platform]?.cpm_contest);
    if (rate != null && rate > 0) {
      fromPlatforms.push({ platform, rateUsd: rate });
    }
  }
  if (fromPlatforms.length > 0) return fromPlatforms;

  const projected = withProjectedTopLevelPayout(details, platformCsv);
  const rootRate =
    readCpmRateUsd(projected.cpm_contest) ??
    readCpmRateUsd(
      details && typeof details === "object"
        ? (details as { cpm_contest?: unknown }).cpm_contest
        : null,
    );
  if (rootRate == null) return [];

  const platform = platforms[0];
  if (platform) return [{ platform, rateUsd: rootRate }];
  return [];
}

/** Compact CPM text for contest list cards (multi-platform aware). */
export function formatContestListCpmRatesText(
  rates: ContestPlatformCpmRate[],
  formatMoneyFn: (cents: number) => string,
): string | null {
  if (rates.length === 0) return null;
  const first = rates[0]!.rateUsd;
  const allSame = rates.every((r) => r.rateUsd === first);
  if (rates.length === 1 || allSame) {
    return `${formatMoneyFn(first * 100)} / 1k views`;
  }
  return (
    rates
      .map(
        (r) =>
          `${VIDEO_PLATFORM_LABELS[r.platform]} ${formatMoneyFn(r.rateUsd * 100)}`,
      )
      .join(" · ") + " / 1k views"
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

/** Build single-platform root payout blocks from a snapshot (not for multi-platform save). */
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

/**
 * Read-time helper for legacy UI that still expects root cpm/milestone/leaderboard.
 * When multi-platform payout keys exist and root payout is missing, project the
 * primary platform's payout onto the root (does not mutate stored details).
 * Pass preferPlatform to project a specific platform (detail-page tabs).
 */
export function withProjectedTopLevelPayout(
  details: Record<string, unknown> | null | undefined,
  platformCsv?: string | null,
  preferPlatform?: VideoContestPlatform | null,
): Record<string, unknown> {
  if (!details || typeof details !== "object") return {};
  const campaigns = readPersistedPlatformCampaigns(details);
  const campaignPlatforms = VIDEO_CONTEST_PLATFORMS.filter((p) => campaigns[p]);
  if (campaignPlatforms.length < 2) return details;

  const ordered = parseVideoContestPlatforms(platformCsv);
  const target =
    (preferPlatform && campaigns[preferPlatform] ? preferPlatform : null) ??
    ordered.find((p) => campaigns[p]) ??
    primaryPlatformOf(campaignPlatforms);

  if (!preferPlatform) {
    const hasMeaningfulTopLevel = (() => {
      const rootBudget = details.total_budget_cents;
      if (typeof rootBudget === "number" && rootBudget > 0) return true;

      const cpm = details.cpm_contest as
        | {
            total_budget?: number | null;
            cpm_rate_usd?: number | null;
          }
        | null
        | undefined;
      if (cpm && typeof cpm === "object") {
        if (typeof cpm.total_budget === "number" && cpm.total_budget > 0) {
          return true;
        }
        if (typeof cpm.cpm_rate_usd === "number" && cpm.cpm_rate_usd > 0) {
          return true;
        }
      }

      const milestone = details.milestone_contest as
        | { total_budget_cents?: number | null }
        | null
        | undefined;
      if (
        milestone &&
        typeof milestone === "object" &&
        typeof milestone.total_budget_cents === "number" &&
        milestone.total_budget_cents > 0
      ) {
        return true;
      }

      const leaderboard = details.leaderboard_contest as
        | {
            total_prize?: number | null;
            prizes?: unknown[] | null;
          }
        | null
        | undefined;
      if (leaderboard && typeof leaderboard === "object") {
        if (
          typeof leaderboard.total_prize === "number" &&
          leaderboard.total_prize > 0
        ) {
          return true;
        }
        if (
          Array.isArray(leaderboard.prizes) &&
          leaderboard.prizes.length > 0
        ) {
          return true;
        }
      }
      return false;
    })();
    if (hasMeaningfulTopLevel) return details;
  }

  const targetCampaign = campaigns[target];
  if (!targetCampaign) return details;

  const projected: Record<string, unknown> = {};
  if (targetCampaign.leaderboard_contest) {
    projected.leaderboard_contest = targetCampaign.leaderboard_contest;
  }
  if (targetCampaign.cpm_contest) {
    projected.cpm_contest = targetCampaign.cpm_contest;
  }
  if (targetCampaign.milestone_contest) {
    projected.milestone_contest = targetCampaign.milestone_contest;
  }
  if (typeof targetCampaign.total_budget_cents === "number") {
    projected.total_budget_cents = targetCampaign.total_budget_cents;
  }

  const base = preferPlatform ? clearTopLevelPayoutKeys({ ...details }) : details;
  return { ...base, ...projected };
}
