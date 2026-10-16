/**
 * Duplicate a campaign into a new draft ("Copy an existing campaign").
 *
 * Shared by the dialog and the API: which parts of a campaign can be copied,
 * how they're grouped, and which parts depend on others. The server reads all
 * values from the source campaign itself; the browser only sends section keys.
 */

export const DUPLICATE_SECTION_KEYS = [
  "setup",
  "title",
  "content_type",
  "categories",
  "region",
  "requirements",
  "thumbnail",
  "access",
  "questions",
  "invites",
  "brief",
  "rules",
  "post_requirements",
  "resources",
  "inspiration_links",
  "tracking_links",
  "rewards",
  "bonus",
  "creator_limits",
  "dates",
] as const;

export type DuplicateSectionKey = (typeof DUPLICATE_SECTION_KEYS)[number];

export const DUPLICATE_SECTION_LABELS: Record<DuplicateSectionKey, string> = {
  setup: "Format, type & platforms",
  title: "Title",
  content_type: "Content type",
  categories: "Category & interests",
  region: "Regions & countries",
  requirements: "Creator requirements",
  thumbnail: "Thumbnail",
  access: "Access setting",
  questions: "Application questions",
  invites: "Invited creators",
  brief: "Brief",
  rules: "Rules",
  post_requirements: "Post requirements (X)",
  resources: "Files & links",
  inspiration_links: "Inspiration links",
  tracking_links: "Tracking links",
  rewards: "Rewards & budget",
  bonus: "Bonus",
  creator_limits: "Per-creator limits",
  dates: "Campaign dates",
};

export const DUPLICATE_SECTION_HINTS: Partial<Record<DuplicateSectionKey, string>> = {
  setup: "Video or text/image, campaign type, and the platforms it runs on.",
  access: "Public, Restricted or Private, plus the preview and joining options.",
  invites: "Creators who were invited directly or from a saved list.",
  rewards: "Prizes, CPM rate, milestones and budget. Nothing is paid until you submit.",
  creator_limits: "Max earnings per creator and multiple submissions.",
  dates: "Old dates are moved forward if they have passed.",
};

export type DuplicateSectionGroup = {
  key: string;
  label: string;
  sections: DuplicateSectionKey[];
};

/** Grouped like the wizard's steps. */
export const DUPLICATE_SECTION_GROUPS: DuplicateSectionGroup[] = [
  {
    key: "basics",
    label: "Get started",
    sections: [
      "setup",
      "title",
      "content_type",
      "categories",
      "region",
      "requirements",
      "thumbnail",
    ],
  },
  { key: "access", label: "Who can join", sections: ["access", "questions", "invites"] },
  { key: "brief", label: "Create brief", sections: ["brief", "rules", "post_requirements"] },
  {
    key: "resources",
    label: "Resources",
    sections: ["resources", "inspiration_links", "tracking_links"],
  },
  { key: "prize", label: "Prize", sections: ["rewards", "bonus", "creator_limits", "dates"] },
];

/** Left unticked when the dialog opens (confirmed with the product owner). */
export const DUPLICATE_SECTIONS_OFF_BY_DEFAULT: readonly DuplicateSectionKey[] = [
  "thumbnail",
  "dates",
];

export const DUPLICATE_TITLE_MAX_LENGTH = 100;
export const DUPLICATE_UNTITLED = "Untitled campaign";
const COPY_SUFFIX = " (copy)";

export function isDuplicateSectionKey(value: unknown): value is DuplicateSectionKey {
  return (
    typeof value === "string" &&
    (DUPLICATE_SECTION_KEYS as readonly string[]).includes(value)
  );
}

/** "<title> (copy)", trimmed so the whole thing fits the title limit. */
export function defaultDuplicateTitle(sourceTitle: string | null | undefined): string {
  const base = (sourceTitle || "").trim();
  if (!base) return DUPLICATE_UNTITLED;
  const room = DUPLICATE_TITLE_MAX_LENGTH - COPY_SUFFIX.length;
  return `${base.length > room ? base.slice(0, room).trimEnd() : base}${COPY_SUFFIX}`;
}

/** What the dialog needs to know about a source to decide which boxes apply. */
export type DuplicateSourceFacts = {
  isMultiPlatform: boolean;
  isTextImage: boolean;
  accessMode: string;
};

/**
 * Sections each section needs. Rewards are shaped by type and platforms;
 * multi-platform content is stored per platform, so it needs the platforms too.
 */
export function getSectionDependencies(
  facts: Pick<DuplicateSourceFacts, "isMultiPlatform">,
): Partial<Record<DuplicateSectionKey, DuplicateSectionKey[]>> {
  const deps: Partial<Record<DuplicateSectionKey, DuplicateSectionKey[]>> = {
    requirements: ["setup"],
    post_requirements: ["setup"],
    rewards: ["setup"],
    questions: ["access"],
    invites: ["access"],
  };
  if (facts.isMultiPlatform) {
    for (const key of [
      "content_type",
      "brief",
      "rules",
      "resources",
      "inspiration_links",
      "bonus",
      "creator_limits",
    ] as const) {
      deps[key] = ["setup"];
    }
  }
  return deps;
}

/**
 * Drops sections whose dependencies aren't selected (repeats until stable,
 * so chains resolve). Returns a sorted, de-duplicated list.
 */
export function resolveSectionSelection(
  selected: readonly DuplicateSectionKey[],
  facts: Pick<DuplicateSourceFacts, "isMultiPlatform">,
): DuplicateSectionKey[] {
  const deps = getSectionDependencies(facts);
  const set = new Set(selected.filter(isDuplicateSectionKey));
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of Array.from(set)) {
      const needs = deps[key] ?? [];
      if (needs.some((n) => !set.has(n))) {
        set.delete(key);
        changed = true;
      }
    }
  }
  return DUPLICATE_SECTION_KEYS.filter((k) => set.has(k));
}

/** Sections that are switched off because something they need is unticked. */
export function blockedSections(
  selected: readonly DuplicateSectionKey[],
  facts: Pick<DuplicateSourceFacts, "isMultiPlatform">,
): Partial<Record<DuplicateSectionKey, DuplicateSectionKey[]>> {
  const deps = getSectionDependencies(facts);
  const set = new Set(selected);
  const out: Partial<Record<DuplicateSectionKey, DuplicateSectionKey[]>> = {};
  for (const key of DUPLICATE_SECTION_KEYS) {
    const missing = (deps[key] ?? []).filter((n) => !set.has(n));
    if (missing.length > 0) out[key] = missing;
  }
  return out;
}

/**
 * Dates rule: keep the original dates while the start is still ahead;
 * otherwise start tomorrow at the original time of day, same length.
 */
export function shiftDuplicateDates(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  now: Date = new Date(),
): { start_date: string | null; end_date: string | null; shifted: boolean } {
  const start = startIso ? new Date(startIso) : null;
  const end = endIso ? new Date(endIso) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
  const validEnd = end && !Number.isNaN(end.getTime()) ? end : null;
  if (!validStart) {
    return { start_date: null, end_date: null, shifted: false };
  }
  if (validStart.getTime() > now.getTime()) {
    return {
      start_date: validStart.toISOString(),
      end_date: validEnd ? validEnd.toISOString() : null,
      shifted: false,
    };
  }
  const length =
    validEnd && validEnd.getTime() > validStart.getTime()
      ? validEnd.getTime() - validStart.getTime()
      : null;
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(
    validStart.getUTCHours(),
    validStart.getUTCMinutes(),
    validStart.getUTCSeconds(),
    0,
  );
  // Same time of day may still be under 24h away; always at least a day ahead.
  if (next.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return {
    start_date: next.toISOString(),
    end_date: length !== null ? new Date(next.getTime() + length).toISOString() : null,
    shifted: true,
  };
}

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

export type DuplicateSourceCard = {
  id: string;
  title: string;
  thumbnail_url: string | null;
  moderation_status: string;
  status: string | null;
  contest_type: string | null;
  contest_format: string | null;
  platform: string | null;
  access_mode: string | null;
  created_at: string;
  advertiser_id: string;
  brand_name: string | null;
};

export type DuplicateSavedListOption = {
  id: string;
  name: string;
  /** Creators on the source campaign that came from this list. */
  creator_count: number;
};

export type DuplicateWarning = { code: string; message: string };

export type DuplicatePreview = {
  source: DuplicateSourceCard;
  target: { advertiser_id: string; brand_name: string | null };
  crossBrand: boolean;
  facts: DuplicateSourceFacts;
  /** Sections with something to copy on this source. */
  available: DuplicateSectionKey[];
  savedLists: DuplicateSavedListOption[];
  manualInviteCount: number;
  questionCount: number;
  warnings: DuplicateWarning[];
  defaultTitle: string;
  /** The original start date has passed (copied dates would be moved forward). */
  datesPassed: boolean;
};

export type DuplicateRequest = {
  sourceContestId: string;
  targetAdvertiserId?: string | null;
  sections: DuplicateSectionKey[];
  title?: string | null;
  /** Saved lists (on the source) whose creators to copy; needs "invites". */
  savedListIds?: string[];
  /** Copy creators added individually; needs "invites". */
  includeManualInvites?: boolean;
};

export type DuplicateResult = {
  id: string;
  advertiserId: string;
  warnings: DuplicateWarning[];
};

/** Where to open the new draft. */
export function duplicateWizardHref(
  result: Pick<DuplicateResult, "id" | "advertiserId">,
  isAdmin: boolean,
): string {
  const draft = encodeURIComponent(result.id);
  if (isAdmin) {
    return `/dashboard/admin/contests/create/wizard?advertiserId=${encodeURIComponent(
      result.advertiserId,
    )}&draft=${draft}&copied=1`;
  }
  return `/dashboard/contests/create?draft=${draft}&copied=1`;
}

export const DUPLICATE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "In review",
  approved: "Approved",
  rejected: "Rejected",
  published: "Live",
};

/** Draft / In review / Upcoming / Live / Ended / Rejected. */
export function duplicateStatusLabel(
  moderationStatus: string | null | undefined,
  status: string | null | undefined,
): string {
  if (moderationStatus === "published") {
    if (status === "ended") return "Ended";
    if (status === "upcoming") return "Upcoming";
    return "Live";
  }
  return DUPLICATE_STATUS_LABELS[moderationStatus || ""] || "Draft";
}
