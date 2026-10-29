/**
 * Server-side rules for duplicating a campaign into a new draft.
 *
 * Pure functions (no I/O) so the copy rules are unit-tested:
 * - buildDuplicateRow(): the new contests row, built column by column from the
 *   source for the selected sections only. Payment, review and live data are
 *   never part of it.
 * - sanitizeSetupDetails(): contest_based_details rebuilt from setup keys only
 *   (runtime keys such as budget_spent are dropped at every depth).
 * - contestAssetPath() / rewriteAssetUrls(): which files must be physically
 *   copied so deleting one campaign never breaks the other.
 */

import {
  defaultDuplicateTitle,
  DUPLICATE_TITLE_MAX_LENGTH,
  DUPLICATE_UNTITLED,
  shiftDuplicateDates,
  type DuplicateSectionKey,
  type DuplicateSourceFacts,
  type DuplicateWarning,
} from "@/lib/campaign-duplicate";
import { parseVideoContestPlatforms } from "@/lib/video-platform-campaigns";
import { normalizeDraftReviewSettings } from "@/lib/content-drafts";
import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";
import {
  HIGHEST_PLATFORM_PAYOUT_KEY,
  readHighestPlatformPayoutFlag,
} from "@/lib/highest-platform-payout";

export const CONTEST_ASSETS_BUCKET = "contest-assets";

type Json = unknown;
type Row = Record<string, Json>;

const VIDEO_PLATFORM_KEYS = ["youtube", "instagram", "tiktok"] as const;
const PAYOUT_BLOCK_KEYS = [
  "leaderboard_contest",
  "cpm_contest",
  "milestone_contest",
  "total_budget_cents",
] as const;
const TWITTER_SETUP_KEYS = [
  "keywords",
  "mentions",
  "keywords_requirement_mode",
  "mentions_requirement_mode",
  "max_participants",
  "points_config",
  "raid_target",
  "allowed_tweet_types",
] as const;

/** Keys written while a campaign runs (spend, payouts, syncs). Never copied. */
export function isRuntimeKey(key: string): boolean {
  return (
    key === "budget_spent" ||
    key === "spent" ||
    key === "paid_at" ||
    key === "paid_count" ||
    key === "skipped_count" ||
    key.startsWith("last_") ||
    key.startsWith("spent_") ||
    key.endsWith("_spent") ||
    key.endsWith("_paid") ||
    key.endsWith("_paid_at") ||
    key.endsWith("_synced_at") ||
    key.endsWith("_updated_at") ||
    key.endsWith("_refreshed_at")
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Deep copy without runtime keys. */
export function stripRuntimeKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripRuntimeKeys(v)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (isRuntimeKey(k)) continue;
      out[k] = stripRuntimeKeys(v);
    }
    return out as T;
  }
  return value;
}

function pick(obj: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

/** Per-platform payout objects; legacy `platform_campaigns` is read too. */
function readPlatformBlocks(details: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const p of VIDEO_PLATFORM_KEYS) {
    if (isPlainObject(details[p])) out[p] = details[p] as Record<string, unknown>;
  }
  if (Object.keys(out).length === 0 && isPlainObject(details.platform_campaigns)) {
    const legacy = details.platform_campaigns as Record<string, unknown>;
    for (const p of VIDEO_PLATFORM_KEYS) {
      if (isPlainObject(legacy[p])) out[p] = legacy[p] as Record<string, unknown>;
    }
  }
  return out;
}

export type SetupDetailsOptions = {
  setup: boolean;
  rewards: boolean;
  contentType: boolean;
  postRequirements: boolean;
  /** Platforms the copy keeps (from the source's platform column). */
  platforms: readonly string[];
};

/**
 * contest_based_details for the copy: setup keys only, chosen by section.
 * Returns null when nothing applies (the wizard then starts from its defaults).
 */
export function sanitizeSetupDetails(
  details: unknown,
  opts: SetupDetailsOptions,
): Record<string, unknown> | null {
  if (!opts.setup || !isPlainObject(details)) return null;
  const out: Record<string, unknown> = {};

  if (opts.rewards) {
    for (const key of PAYOUT_BLOCK_KEYS) {
      if (details[key] !== undefined && details[key] !== null) {
        out[key] = stripRuntimeKeys(details[key]);
      }
    }
  }

  // Multi-platform: one payout object per platform.
  const blocks = readPlatformBlocks(details);
  for (const p of VIDEO_PLATFORM_KEYS) {
    const block = blocks[p];
    if (!block || !opts.platforms.includes(p)) continue;
    const next: Record<string, unknown> = {};
    if (typeof block.contest_type === "string") next.contest_type = block.contest_type;
    if (opts.contentType && block.content_type !== undefined) {
      next.content_type = block.content_type;
    }
    if (opts.rewards) {
      Object.assign(next, stripRuntimeKeys(pick(block, PAYOUT_BLOCK_KEYS)));
    }
    if (Object.keys(next).length > 0) out[p] = next;
  }

  // Campaign-wide payout rule; only meaningful with 2+ video platforms.
  if (
    opts.rewards &&
    opts.platforms.length >= 2 &&
    readHighestPlatformPayoutFlag(details)
  ) {
    out[HIGHEST_PLATFORM_PAYOUT_KEY] = true;
  }

  if (isPlainObject(details.twitter_campaign)) {
    const tc = details.twitter_campaign as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    if ((opts.contentType || opts.postRequirements) && tc.campaign_type !== undefined) {
      next.campaign_type = tc.campaign_type;
    }
    if (opts.postRequirements) {
      Object.assign(next, stripRuntimeKeys(pick(tc, TWITTER_SETUP_KEYS)));
    }
    if (Object.keys(next).length > 0) out.twitter_campaign = next;
  }

  return Object.keys(out).length > 0 ? out : null;
}

// ---------------------------------------------------------------------------
// Facts and availability
// ---------------------------------------------------------------------------

export function getDuplicateFacts(source: Row): DuplicateSourceFacts {
  const isTextImage = source.contest_format === "text_image";
  const platforms = parseVideoContestPlatforms(source.platform as string | null);
  return {
    isTextImage,
    isMultiPlatform: !isTextImage && platforms.length > 1,
    accessMode: typeof source.access_mode === "string" ? source.access_mode : "public",
  };
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.replace(/<[^>]*>/g, "").trim().length > 0;
}

function hasItems(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) {
    return Object.values(value).some((v) => (Array.isArray(v) ? v.length > 0 : v != null));
  }
  return false;
}

function hasContent(html: unknown, json: unknown): boolean {
  if (hasText(html)) return true;
  if (isPlainObject(json)) return Object.keys(json).length > 0;
  return false;
}

const REQUIREMENT_COLUMNS = [
  "trust_score",
  "trust_number",
  "min_avg_quality_score",
  "min_best_quality_score",
  "min_quality_score",
  "min_platform_earnings",
  "min_platform_views",
] as const;

/** Sections that have something to copy on this source. */
export function availableSections(
  source: Row,
  counts: { questions: number; invites: number },
): DuplicateSectionKey[] {
  const facts = getDuplicateFacts(source);
  const details = isPlainObject(source.contest_based_details)
    ? source.contest_based_details
    : {};
  const twitter = isPlainObject(details.twitter_campaign) ? details.twitter_campaign : null;
  const out: DuplicateSectionKey[] = ["setup", "access"];
  if (hasText(source.title)) out.push("title");
  if (source.content_type) out.push("content_type");
  if (
    source.category ||
    hasItems(source.categories) ||
    hasItems(source.subcategories) ||
    hasItems(source.interests)
  ) {
    out.push("categories");
  }
  if (hasItems(source.region)) out.push("region");
  if (!facts.isTextImage && REQUIREMENT_COLUMNS.some((c) => source[c] != null)) {
    out.push("requirements");
  }
  if (hasText(source.thumbnail_url)) out.push("thumbnail");
  if (facts.accessMode === "restricted" && counts.questions > 0) out.push("questions");
  if (facts.accessMode !== "public" && counts.invites > 0) out.push("invites");
  if (!facts.isTextImage && source.review_before_posting === true) {
    out.push("review_before_posting");
  }
  if (hasContent(source.brief_html, source.brief_json)) out.push("brief");
  if (hasContent(source.rules_html, source.rules_json)) out.push("rules");
  if (twitter && TWITTER_SETUP_KEYS.some((k) => twitter[k] != null)) {
    out.push("post_requirements");
  }
  if (hasItems(source.resources)) out.push("resources");
  if (hasItems(source.inspiration_links)) out.push("inspiration_links");
  if (hasItems(source.tracking_links)) out.push("tracking_links");
  if (
    PAYOUT_BLOCK_KEYS.some((k) => details[k] != null) ||
    Object.keys(readPlatformBlocks(details)).length > 0
  ) {
    out.push("rewards");
  }
  if (isPlainObject(source.bonus_details) && Object.keys(source.bonus_details).length > 0) {
    out.push("bonus");
  }
  if (
    (source.max_earnings_per_creator != null && source.max_earnings_per_creator !== 0) ||
    source.multiple_submissions_enabled === true
  ) {
    out.push("creator_limits");
  }
  if (source.start_date || source.end_date) out.push("dates");
  return out;
}

// ---------------------------------------------------------------------------
// The new row
// ---------------------------------------------------------------------------

export function normalizeDuplicateTitle(input: string | null | undefined): string {
  const trimmed = (input || "").replace(/\s+/g, " ").trim();
  if (!trimmed) return DUPLICATE_UNTITLED;
  return trimmed.slice(0, DUPLICATE_TITLE_MAX_LENGTH).trimEnd();
}

export type BuildDuplicateRowInput = {
  source: Row;
  sections: readonly DuplicateSectionKey[];
  targetAdvertiserId: string;
  /** Name typed in the dialog; defaults to "<title> (copy)". */
  title: string | null | undefined;
  now?: Date;
};

export type BuildDuplicateRowOutput = {
  row: Row;
  warnings: DuplicateWarning[];
};

/**
 * Builds the insert for the new draft. Every column is listed on purpose:
 * anything not set here takes the table default, and the review, payment
 * and live columns are set to their "new draft" values explicitly.
 */
export function buildDuplicateRow(input: BuildDuplicateRowInput): BuildDuplicateRowOutput {
  const { source, targetAdvertiserId } = input;
  const s = new Set(input.sections);
  const has = (k: DuplicateSectionKey) => s.has(k);
  const facts = getDuplicateFacts(source);
  const warnings: DuplicateWarning[] = [];
  const platforms = facts.isTextImage
    ? []
    : parseVideoContestPlatforms(source.platform as string | null);

  const row: Row = {
    advertiser_id: targetAdvertiserId,
    title: has("title")
      ? normalizeDuplicateTitle(input.title || defaultDuplicateTitle(source.title as string | null))
      : DUPLICATE_UNTITLED,
    // A brand-new draft: nothing from review, payment or the live campaign.
    moderation_status: "draft",
    submitted_for_approval_at: null,
    approved_at: null,
    approved_by: null,
    published_at: null,
    rejection_reason: null,
    payment_details: null,
    post_contest_status: null,
    live_submission_count: 0,
    last_metrics_updated: null,
    subscription_info_of_user: null,
    // Defaults for sections that are not copied (same as a new draft).
    contest_type: "leaderboard",
    contest_format: null,
    platform: null,
    content_type: null,
    category: null,
    categories: null,
    subcategories: null,
    interests: null,
    region: null,
    thumbnail_url: null,
    brief_html: "",
    brief_json: null,
    rules_html: "",
    rules_json: null,
    resources: [],
    inspiration_links: [],
    tracking_links: [],
    contest_based_details: null,
    bonus_details: null,
    max_earnings_per_creator: null,
    multiple_submissions_enabled: false,
    max_submissions_per_creator: 1,
    start_date: null,
    end_date: null,
    access_mode: "public",
    access_list_skips_requirements: false,
  };
  for (const c of REQUIREMENT_COLUMNS) row[c] = null;

  if (has("setup")) {
    row.contest_type = source.contest_type ?? "leaderboard";
    row.contest_format = source.contest_format ?? null;
    row.platform = source.platform ?? null;
  }
  if (has("content_type")) row.content_type = source.content_type ?? null;
  if (has("categories")) {
    row.category = source.category ?? null;
    row.categories = source.categories ?? null;
    row.subcategories = source.subcategories ?? null;
    row.interests = source.interests ?? null;
  }
  if (has("region")) row.region = source.region ?? null;
  if (has("requirements") && has("setup") && !facts.isTextImage) {
    for (const c of REQUIREMENT_COLUMNS) row[c] = source[c] ?? null;
  }
  if (has("thumbnail")) row.thumbnail_url = source.thumbnail_url ?? null;

  if (has("access")) {
    const mode = facts.accessMode;
    row.access_mode = mode === "restricted" || mode === "private" ? mode : "public";
    row.access_list_skips_requirements =
      row.access_mode !== "public" && source.access_list_skips_requirements === true;
    if (row.access_mode === "restricted") {
      row.preview_description = source.preview_description ?? null;
      row.applications_open = source.applications_open !== false;
    }
    if (row.access_mode === "public" && source.list_only_to_eligible === true) {
      row.list_only_to_eligible = true;
    }
    if (isPlainObject(source.applicant_visibility)) {
      row.applicant_visibility = source.applicant_visibility;
    }
  }

  // Only set when copied, so copying still works where the review columns
  // don't exist yet; otherwise the copy takes the column defaults (off).
  if (has("review_before_posting") && has("setup") && !facts.isTextImage) {
    Object.assign(row, normalizeDraftReviewSettings({ ...source, review_before_posting: true }));
  }

  if (has("brief")) {
    row.brief_html = source.brief_html ?? "";
    row.brief_json = source.brief_json ?? null;
  }
  if (has("rules")) {
    row.rules_html = source.rules_html ?? "";
    row.rules_json = source.rules_json ?? null;
  }
  if (has("resources")) row.resources = stripRuntimeKeys(source.resources ?? []);
  if (has("inspiration_links")) row.inspiration_links = source.inspiration_links ?? [];
  if (has("tracking_links")) row.tracking_links = source.tracking_links ?? [];

  row.contest_based_details = sanitizeSetupDetails(source.contest_based_details, {
    setup: has("setup"),
    rewards: has("rewards"),
    contentType: has("content_type"),
    postRequirements: has("post_requirements"),
    platforms,
  });

  if (has("bonus")) row.bonus_details = source.bonus_details ?? null;
  if (has("creator_limits")) {
    row.max_earnings_per_creator = source.max_earnings_per_creator ?? null;
    row.multiple_submissions_enabled = source.multiple_submissions_enabled === true;
    row.max_submissions_per_creator =
      source.multiple_submissions_enabled === true &&
      typeof source.max_submissions_per_creator === "number" &&
      source.max_submissions_per_creator > 0
        ? source.max_submissions_per_creator
        : 1;
  }

  if (has("dates")) {
    const dates = shiftDuplicateDates(
      source.start_date as string | null,
      source.end_date as string | null,
      input.now,
    );
    row.start_date = dates.start_date;
    row.end_date = dates.end_date;
    if (dates.shifted) {
      warnings.push({
        code: "dates_shifted",
        message: "The original dates had passed, so the copy starts tomorrow with the same length.",
      });
    }
  }

  return { row, warnings };
}

// ---------------------------------------------------------------------------
// Plan checks (warnings only; the wizard enforces them on submit)
// ---------------------------------------------------------------------------

export type PlanFeaturesForWarnings = {
  contestTypes: readonly string[];
  maxWinnersPerContest: number;
  minContestBudget: number;
};

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

export function planWarnings(
  source: Row,
  plan: PlanFeaturesForWarnings | null,
  planName: string | null,
): DuplicateWarning[] {
  if (!plan) return [];
  const out: DuplicateWarning[] = [];
  const type = typeof source.contest_type === "string" ? source.contest_type : "leaderboard";
  const brand = planName ? `the ${planName} plan` : "this brand's plan";
  if (type !== "leaderboard" && !plan.contestTypes.includes("cpm")) {
    out.push({
      code: "type_not_in_plan",
      message: `${brand[0].toUpperCase()}${brand.slice(1)} doesn't include this campaign type. Change the type before submitting.`,
    });
  }
  const details = isPlainObject(source.contest_based_details) ? source.contest_based_details : {};
  if (type === "leaderboard") {
    const lc = isPlainObject(details.leaderboard_contest) ? details.leaderboard_contest : null;
    const winners = Number(lc?.winner_count) || 0;
    if (winners > plan.maxWinnersPerContest) {
      out.push({
        code: "winners_over_plan",
        message: `The original has ${winners} winners; ${brand} allows ${plan.maxWinnersPerContest}.`,
      });
    }
    const pool = Number(lc?.total_prize) || 0;
    if (pool > 0 && pool < plan.minContestBudget) {
      out.push({
        code: "budget_under_plan",
        message: `The prize pool is below ${brand}'s ${formatUsd(plan.minContestBudget)} minimum.`,
      });
    }
  } else {
    const pool = getPoolBudgetCentsFromDetails(type, details as never);
    if (pool > 0 && pool < plan.minContestBudget) {
      out.push({
        code: "budget_under_plan",
        message: `The budget is below ${brand}'s ${formatUsd(plan.minContestBudget)} minimum.`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Files: each copy gets its own files in the bucket
// ---------------------------------------------------------------------------

const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${CONTEST_ASSETS_BUCKET}/`;
const COPYABLE_FOLDERS = ["contest_thumbnails/", "contest_resources/"];

/**
 * Bucket path for a URL that points at our own contest-assets bucket, or null
 * for anything else (external links stay as they are).
 */
export function contestAssetPath(url: unknown, supabaseUrl: string | null | undefined): string | null {
  if (typeof url !== "string" || !url || !supabaseUrl) return null;
  let parsed: URL;
  let base: URL;
  try {
    parsed = new URL(url);
    base = new URL(supabaseUrl);
  } catch {
    return null;
  }
  if (parsed.host !== base.host) return null;
  if (!parsed.pathname.startsWith(PUBLIC_OBJECT_PREFIX)) return null;
  let path: string;
  try {
    path = decodeURIComponent(parsed.pathname.slice(PUBLIC_OBJECT_PREFIX.length));
  } catch {
    return null;
  }
  if (!COPYABLE_FOLDERS.some((f) => path.startsWith(f))) return null;
  if (path.split("/").some((seg) => seg === ".." || seg === "." || seg === "")) return null;
  return path;
}

function fileExtension(path: string): string {
  const name = path.split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "jpg";
}

function fileName(path: string): string {
  const name = (path.split("/").pop() || "file").replace(/[^A-Za-z0-9._-]/g, "_");
  return name.slice(-120) || "file";
}

export type AssetCopyPlan = {
  /** source path -> new path */
  copies: Map<string, string>;
};

/** Resources are an array, or a platform-keyed map of arrays on multi-platform campaigns. */
function forEachResource(
  resources: unknown,
  fn: (item: Record<string, unknown>) => void,
): void {
  const visitList = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const item of list) if (isPlainObject(item)) fn(item);
  };
  if (Array.isArray(resources)) visitList(resources);
  else if (isPlainObject(resources)) for (const v of Object.values(resources)) visitList(v);
}

/** Works out new bucket paths for the copy's thumbnail and uploaded resources. */
export function planAssetCopies(
  row: Row,
  newContestId: string,
  supabaseUrl: string | null | undefined,
  stamp: number = Date.now(),
): AssetCopyPlan {
  const copies = new Map<string, string>();
  const thumb = contestAssetPath(row.thumbnail_url, supabaseUrl);
  if (thumb) {
    copies.set(thumb, `contest_thumbnails/${newContestId}_${stamp}.${fileExtension(thumb)}`);
  }
  const usedNames = new Set<string>();
  forEachResource(row.resources, (item) => {
    const path = contestAssetPath(item.url, supabaseUrl);
    if (!path || copies.has(path)) return;
    let name = fileName(path);
    let n = 1;
    while (usedNames.has(name)) {
      name = `${n}_${fileName(path)}`;
      n += 1;
    }
    usedNames.add(name);
    copies.set(path, `contest_resources/${newContestId}/${name}`);
  });
  return { copies };
}

/**
 * Points the copy at its own files. Files that failed to copy are removed
 * (thumbnail -> null, resource dropped) so the copy never references the
 * original's files.
 */
export function rewriteAssetUrls(
  row: Row,
  supabaseUrl: string | null | undefined,
  copied: Map<string, string>,
  publicUrlFor: (path: string) => string,
): { thumbnail_url: string | null; resources: unknown; missingThumbnail: boolean; missingResources: number } {
  let missingThumbnail = false;
  let missingResources = 0;
  let thumbnail_url = (row.thumbnail_url as string | null) ?? null;
  const thumbPath = contestAssetPath(thumbnail_url, supabaseUrl);
  if (thumbPath) {
    const next = copied.get(thumbPath);
    if (next) thumbnail_url = publicUrlFor(next);
    else {
      thumbnail_url = null;
      missingThumbnail = true;
    }
  }
  const mapList = (list: unknown) => {
    if (!Array.isArray(list)) return list;
    const out: unknown[] = [];
    for (const item of list) {
      if (!isPlainObject(item)) {
        out.push(item);
        continue;
      }
      const path = contestAssetPath(item.url, supabaseUrl);
      if (!path) {
        out.push(item);
        continue;
      }
      const next = copied.get(path);
      if (next) out.push({ ...item, url: publicUrlFor(next) });
      else missingResources += 1;
    }
    return out;
  };
  let resources: unknown = row.resources;
  if (Array.isArray(resources)) resources = mapList(resources);
  else if (isPlainObject(resources)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(resources)) out[k] = mapList(v);
    resources = out;
  }
  return { thumbnail_url, resources, missingThumbnail, missingResources };
}

/**
 * Search text safe to put inside a PostgREST or() filter: drops the characters
 * that filter syntax uses (commas, parentheses, double quotes, backslashes,
 * colons) and the LIKE wildcards, so typed text can't change the filter.
 */
export function sanitizeSearchTerm(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[,()"\\*%:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
