export const ACCESS_MODES = ["public", "restricted", "private"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

/** Modes brands/admins may select. */
export const SELECTABLE_ACCESS_MODES: readonly AccessMode[] = ["public", "private", "restricted"];

export type ContestAccessSource =
  | "saved_list"
  | "manual"
  | "existing_submitter"
  | "invite_link"
  | "application";

export const ACCESS_SOURCE_LABELS: Record<ContestAccessSource, string> = {
  saved_list: "Saved list",
  manual: "Added manually",
  existing_submitter: "Existing submitter",
  invite_link: "Invite link",
  application: "Approved application",
};

export type BrandAllowlist = {
  id: string;
  advertiser_id: string;
  name: string;
  member_count: number;
  created_at: string;
  updated_at: string;
};

export type AllowlistMember = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  profile_picture_url: string | null;
  added_at: string;
};

export type ContestAccessMember = AllowlistMember & {
  source: ContestAccessSource;
  source_allowlist_id: string | null;
  source_allowlist_name: string | null;
  source_invite_link_id: string | null;
  source_invite_link_label: string | null;
};

export type InviteLinkStatus = "active" | "expired" | "full" | "revoked";

export type InviteLink = {
  id: string;
  contest_id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  revoked_at: string | null;
  created_at: string;
};

export const INVITE_EXPIRY_PRESETS = [
  { value: "24h", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  { value: "custom", label: "Custom date", ms: null },
  { value: "never", label: "Never", ms: null },
] as const;
export type InviteExpiryPreset = (typeof INVITE_EXPIRY_PRESETS)[number]["value"];
export const DEFAULT_INVITE_EXPIRY: InviteExpiryPreset = "7d";

export const MAX_INVITE_USES = 100_000;
export const MAX_INVITE_LABEL_LENGTH = 60;

/** Result codes from redeem_contest_invite / get_contest_invite_preview. */
export type InviteRedeemResult =
  | "joined"
  | "already_member"
  | "not_signed_in"
  | "not_creator"
  | "not_found"
  | "revoked"
  | "expired"
  | "full"
  | "public"
  | "ended";

export const INVITE_RESULT_MESSAGES: Record<InviteRedeemResult, string> = {
  joined: "You've joined this campaign.",
  already_member: "You already have access to this campaign.",
  not_signed_in: "Sign in to join this campaign.",
  not_creator: "Invite links are for creator accounts.",
  not_found: "This invite link isn't valid.",
  revoked: "This invite link is no longer active. Ask the brand for a new one.",
  expired: "This invite link has expired. Ask the brand for a new one.",
  full: "This invite link has reached its limit. Ask the brand for a new one.",
  public: "This campaign is now open to everyone.",
  ended: "This campaign has ended.",
};

export type UsernameResolution = {
  found: { user_id: string; username: string }[];
  notFound: string[];
};

export const MAX_USERNAMES_PER_REQUEST = 1000;
export const MAX_ALLOWLIST_NAME_LENGTH = 100;

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{1,50}$/;

export function isAccessMode(value: unknown): value is AccessMode {
  return typeof value === "string" && (ACCESS_MODES as readonly string[]).includes(value);
}

export function isPrivateLikeAccessMode(mode: unknown): boolean {
  return isAccessMode(mode) && mode !== "public";
}

/**
 * Split pasted text or an array into unique usernames.
 * Accepts commas, whitespace and new lines; strips a leading "@".
 * Case-insensitive de-duplication keeps the first spelling.
 */
export function parseUsernames(input: string | readonly string[] | null | undefined): {
  valid: string[];
  invalid: string[];
} {
  const raw = Array.isArray(input)
    ? input.flatMap((v) => String(v ?? "").split(/[\s,;]+/))
    : String(input ?? "").split(/[\s,;]+/);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const token of raw) {
    const cleaned = token.trim().replace(/^@+/, "");
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (USERNAME_PATTERN.test(cleaned)) valid.push(cleaned);
    else invalid.push(cleaned);
  }
  return { valid, invalid };
}

export function normalizeAllowlistName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > MAX_ALLOWLIST_NAME_LENGTH) return null;
  return trimmed;
}

/** Validates access fields on a contest write payload. Returns an error message or null. */
export function validateCampaignAccessFields(data: Record<string, unknown>): string | null {
  if (data.access_mode !== undefined) {
    if (
      !isAccessMode(data.access_mode) ||
      !SELECTABLE_ACCESS_MODES.includes(data.access_mode)
    ) {
      return `access_mode must be one of: ${SELECTABLE_ACCESS_MODES.join(", ")}`;
    }
  }
  if (
    data.access_list_skips_requirements !== undefined &&
    typeof data.access_list_skips_requirements !== "boolean"
  ) {
    return "access_list_skips_requirements must be a boolean";
  }
  if (data.preview_description !== undefined && data.preview_description !== null) {
    if (typeof data.preview_description !== "string") {
      return "preview_description must be a string";
    }
    if (data.preview_description.length > MAX_PREVIEW_DESCRIPTION_LENGTH) {
      return `preview_description must be ${MAX_PREVIEW_DESCRIPTION_LENGTH} characters or fewer`;
    }
  }
  if (data.applications_open !== undefined && typeof data.applications_open !== "boolean") {
    return "applications_open must be a boolean";
  }
  if (
    data.list_only_to_eligible !== undefined &&
    typeof data.list_only_to_eligible !== "boolean"
  ) {
    return "list_only_to_eligible must be a boolean";
  }
  return null;
}

/** Maps the submission trigger's access error to a user-facing message. */
export function isCampaignAccessDeniedError(message: string | null | undefined): boolean {
  return typeof message === "string" && message.includes("campaign_access_denied");
}

export function isInviteExpiryPreset(value: unknown): value is InviteExpiryPreset {
  return INVITE_EXPIRY_PRESETS.some((p) => p.value === value);
}

/** A calendar date (YYYY-MM-DD) in the brand's zone; offset uses Date#getTimezoneOffset sign. */
export type InviteCustomExpiry = { date: string; tzOffsetMinutes: number };

const MAX_TZ_OFFSET_MINUTES = 14 * 60;

/** Earliest selectable custom expiry date: tomorrow in the brand's time zone. */
export function earliestInviteExpiryDate(
  now: Date = new Date(),
  tzOffsetMinutes: number = now.getTimezoneOffset(),
): string {
  const local = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  local.setUTCDate(local.getUTCDate() + 1);
  return local.toISOString().slice(0, 10);
}

/**
 * Turns an expiry choice into an ISO timestamp (null = never).
 * Custom dates must be tomorrow or later in the brand's time zone and expire
 * at the end of that day; returns an error message otherwise.
 */
export function resolveInviteExpiry(
  preset: InviteExpiryPreset,
  custom: InviteCustomExpiry | null | undefined,
  now: Date = new Date(),
): { expiresAt: string | null } | { error: string } {
  if (preset === "never") return { expiresAt: null };
  if (preset === "custom") {
    const match = typeof custom?.date === "string"
      ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(custom.date)
      : null;
    const offset = custom?.tzOffsetMinutes;
    if (
      !match ||
      typeof offset !== "number" ||
      !Number.isInteger(offset) ||
      Math.abs(offset) > MAX_TZ_OFFSET_MINUTES
    ) {
      return { error: "Choose an expiry date" };
    }
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const endOfDayUtc = Date.UTC(y, m - 1, d, 23, 59, 59);
    if (new Date(endOfDayUtc).toISOString().slice(0, 10) !== custom!.date) {
      return { error: "Choose an expiry date" };
    }
    if (custom!.date < earliestInviteExpiryDate(now, offset)) {
      return { error: "Choose tomorrow or a later date" };
    }
    return { expiresAt: new Date(endOfDayUtc + offset * 60_000).toISOString() };
  }
  const ms = INVITE_EXPIRY_PRESETS.find((p) => p.value === preset)?.ms ?? 0;
  return { expiresAt: new Date(now.getTime() + ms).toISOString() };
}

/** Mirrors contest_invite_link_status for the link itself (campaign state aside). */
export function getInviteLinkStatus(
  link: Pick<InviteLink, "revoked_at" | "expires_at" | "max_uses" | "use_count">,
  now: Date = new Date(),
): InviteLinkStatus {
  if (link.revoked_at) return "revoked";
  if (link.expires_at && new Date(link.expires_at).getTime() <= now.getTime()) {
    return "expired";
  }
  if (link.max_uses != null && link.use_count >= link.max_uses) return "full";
  return "active";
}

export function buildInviteUrl(token: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/invite/${encodeURIComponent(token)}`;
}

export function isInviteRedeemResult(value: unknown): value is InviteRedeemResult {
  return typeof value === "string" && value in INVITE_RESULT_MESSAGES;
}

// ---------------------------------------------------------------------------
// Restricted campaigns: preview + applications
// ---------------------------------------------------------------------------

export const MAX_PREVIEW_DESCRIPTION_LENGTH = 2000;
export const MAX_APPLICATION_QUESTIONS = 10;
export const MAX_QUESTION_PROMPT_LENGTH = 300;
export const MAX_CHOICE_OPTIONS = 10;
export const MIN_CHOICE_OPTIONS = 2;
export const MAX_CHOICE_OPTION_LENGTH = 100;
export const MAX_REJECTION_REASON_LENGTH = 500;

export const APPLICATION_QUESTION_KINDS = [
  "short_text",
  "long_text",
  "url",
  "single_choice",
  "yes_no",
] as const;
export type ApplicationQuestionKind = (typeof APPLICATION_QUESTION_KINDS)[number];

export const APPLICATION_QUESTION_KIND_LABELS: Record<ApplicationQuestionKind, string> = {
  short_text: "Short answer",
  long_text: "Paragraph",
  url: "Link",
  single_choice: "Multiple choice",
  yes_no: "Yes / No",
};

/** Mirrors the limits enforced by submit_contest_application. */
export const ANSWER_MAX_LENGTH: Record<ApplicationQuestionKind, number> = {
  short_text: 300,
  long_text: 3000,
  url: 500,
  single_choice: MAX_CHOICE_OPTION_LENGTH,
  yes_no: 3,
};

export type ApplicationQuestion = {
  id?: string;
  position?: number;
  prompt: string;
  kind: ApplicationQuestionKind;
  options: string[] | null;
  required: boolean;
};

export type ApplicationStatus = "pending" | "approved" | "rejected" | "withdrawn";
export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export type ApplicationAnswer = {
  question_id: string;
  prompt: string;
  kind: ApplicationQuestionKind;
  answer: string;
};

export type ContestApplication = {
  id: string;
  contest_id: string;
  user_id: string;
  status: ApplicationStatus;
  answers: ApplicationAnswer[];
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  username: string | null;
  full_name: string | null;
  profile_picture_url: string | null;
  on_access_list: boolean;
};

export type MyApplication = {
  id: string;
  status: ApplicationStatus;
  rejection_reason: string | null;
  answers: ApplicationAnswer[];
  created_at: string;
  reviewed_at: string | null;
};

/** Shape returned by get_contest_preview. */
export type ContestPreview = {
  id: string;
  title: string | null;
  brand_name: string | null;
  thumbnail_url: string | null;
  platform: string | null;
  contest_type: string | null;
  contest_format: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  contest_based_details: Record<string, unknown> | null;
  preview_description: string | null;
  applications_open: boolean;
  has_ended: boolean;
  has_access: boolean;
  questions: (ApplicationQuestion & { id: string })[];
  my_application: MyApplication | null;
  [key: string]: unknown;
};

export function isApplicationQuestionKind(value: unknown): value is ApplicationQuestionKind {
  return (
    typeof value === "string" &&
    (APPLICATION_QUESTION_KINDS as readonly string[]).includes(value)
  );
}

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

const ANSWER_URL_PATTERN = /^https?:\/\/\S+$/i;

/**
 * Normalises a brand's question list (trimmed prompts and options, positions
 * reassigned in order). Returns an error message for the first problem found.
 */
export function validateApplicationQuestions(
  input: unknown,
): { questions: ApplicationQuestion[] } | { error: string } {
  if (!Array.isArray(input)) return { error: "questions must be a list" };
  if (input.length > MAX_APPLICATION_QUESTIONS) {
    return { error: `At most ${MAX_APPLICATION_QUESTIONS} questions` };
  }

  const questions: ApplicationQuestion[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < input.length; i++) {
    const raw = input[i] as Record<string, unknown> | null;
    const label = `Question ${i + 1}`;
    if (!raw || typeof raw !== "object") return { error: `${label} is invalid` };

    let id: string | undefined;
    if (raw.id !== undefined && raw.id !== null && raw.id !== "") {
      if (typeof raw.id !== "string" || !UUID_PATTERN.test(raw.id) || seenIds.has(raw.id)) {
        return { error: `${label} has an invalid id` };
      }
      id = raw.id;
      seenIds.add(id);
    }

    const prompt = typeof raw.prompt === "string" ? raw.prompt.trim().replace(/\s+/g, " ") : "";
    if (!prompt) return { error: `${label} needs a question` };
    if (prompt.length > MAX_QUESTION_PROMPT_LENGTH) {
      return { error: `${label} must be ${MAX_QUESTION_PROMPT_LENGTH} characters or fewer` };
    }

    if (!isApplicationQuestionKind(raw.kind)) return { error: `${label} has an unknown type` };
    if (raw.required !== undefined && typeof raw.required !== "boolean") {
      return { error: `${label}: required must be true or false` };
    }

    let options: string[] | null = null;
    if (raw.kind === "single_choice") {
      if (!Array.isArray(raw.options)) return { error: `${label} needs choices` };
      const seen = new Set<string>();
      options = [];
      for (const opt of raw.options) {
        const text = typeof opt === "string" ? opt.trim() : "";
        if (!text) continue;
        if (text.length > MAX_CHOICE_OPTION_LENGTH) {
          return {
            error: `${label}: choices must be ${MAX_CHOICE_OPTION_LENGTH} characters or fewer`,
          };
        }
        const key = text.toLowerCase();
        if (seen.has(key)) return { error: `${label} has duplicate choices` };
        seen.add(key);
        options.push(text);
      }
      if (options.length < MIN_CHOICE_OPTIONS || options.length > MAX_CHOICE_OPTIONS) {
        return {
          error: `${label} needs ${MIN_CHOICE_OPTIONS}–${MAX_CHOICE_OPTIONS} choices`,
        };
      }
    }

    questions.push({
      ...(id ? { id } : {}),
      position: i,
      prompt,
      kind: raw.kind,
      options,
      required: raw.required !== false,
    });
  }
  return { questions };
}

/**
 * What the campaign editor should do with its application questions on save:
 * nothing (not restricted, or unchanged), save the validated questions, or stop with an error.
 */
export function applicationQuestionsToSave(
  accessMode: AccessMode,
  dirty: boolean,
  questions: unknown,
): { skip: true } | { questions: ApplicationQuestion[] } | { error: string } {
  if (accessMode !== "restricted" || !dirty) return { skip: true };
  return validateApplicationQuestions(questions);
}

/** Nearest page that exists for `total` results (1 when there are none). */
export function clampPage(page: number, total: number, pageSize: number): number {
  const lastPage = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), lastPage);
}

/** Error message for one answer, or null when it's acceptable. Mirrors the database check. */
export function validateApplicationAnswer(
  question: Pick<ApplicationQuestion, "kind" | "options" | "required">,
  answer: string | null | undefined,
): string | null {
  const value = (answer ?? "").trim();
  if (!value) return question.required ? "This question is required" : null;
  if (value.length > ANSWER_MAX_LENGTH[question.kind]) {
    return `Keep it to ${ANSWER_MAX_LENGTH[question.kind]} characters or fewer`;
  }
  switch (question.kind) {
    case "url":
      return ANSWER_URL_PATTERN.test(value) ? null : "Enter a link starting with http:// or https://";
    case "single_choice":
      return question.options?.includes(value) ? null : "Choose one of the options";
    case "yes_no":
      return value === "yes" || value === "no" ? null : "Choose yes or no";
    default:
      return null;
  }
}

/** Errors keyed by question id; empty when every answer is acceptable. */
export function validateApplicationAnswers(
  questions: readonly (ApplicationQuestion & { id: string })[],
  answers: Record<string, string | undefined>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    const error = validateApplicationAnswer(q, answers[q.id]);
    if (error) errors[q.id] = error;
  }
  return errors;
}

/** Result codes from the application functions (submit / withdraw / review). */
export type ApplicationResult =
  | "submitted"
  | "not_signed_in"
  | "not_creator"
  | "not_found"
  | "ended"
  | "closed"
  | "already_member"
  | "already_applied"
  | "invalid_answers"
  | "withdrawn"
  | "not_pending"
  | "approved"
  | "already_approved"
  | "rejected"
  | "forbidden"
  | "invalid_state"
  | "invalid_decision";

export const APPLICATION_RESULT_MESSAGES: Record<ApplicationResult, string> = {
  submitted: "Application sent. The brand will review it.",
  not_signed_in: "Sign in to apply.",
  not_creator: "Only creator accounts can apply.",
  not_found: "This campaign isn't accepting applications.",
  ended: "This campaign has ended.",
  closed: "This campaign isn't accepting applications right now.",
  already_member: "You already have access to this campaign.",
  already_applied: "You've already applied to this campaign.",
  invalid_answers: "Please check your answers.",
  withdrawn: "Application withdrawn.",
  not_pending: "Only pending applications can be withdrawn.",
  approved: "Application approved.",
  already_approved: "Already approved.",
  rejected: "Application rejected.",
  forbidden: "You can't review applications for this campaign.",
  invalid_state: "This application can't be changed in its current state.",
  invalid_decision: "Choose approve or reject.",
};

export const APPLICATION_RESULT_HTTP_STATUS: Record<ApplicationResult, number> = {
  submitted: 201,
  not_signed_in: 401,
  not_creator: 403,
  not_found: 404,
  ended: 409,
  closed: 409,
  already_member: 409,
  already_applied: 409,
  invalid_answers: 400,
  withdrawn: 200,
  not_pending: 409,
  approved: 200,
  already_approved: 200,
  rejected: 200,
  forbidden: 403,
  invalid_state: 409,
  invalid_decision: 400,
};

/** Values added to admin_notification_type_enum by 20261015_campaign_access_notification_types.sql. */
export const CAMPAIGN_ACCESS_NOTIFICATION_TYPES = [
  "campaign_application_approved",
  "campaign_application_rejected",
  "campaign_application_received",
  "campaign_access_granted",
] as const;
export type CampaignAccessNotificationType =
  (typeof CAMPAIGN_ACCESS_NOTIFICATION_TYPES)[number];

export function isCampaignAccessNotificationType(
  type: string,
): type is CampaignAccessNotificationType {
  return (CAMPAIGN_ACCESS_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

export function isApplicationResult(value: unknown): value is ApplicationResult {
  return typeof value === "string" && value in APPLICATION_RESULT_MESSAGES;
}

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

/** Status shown for an application; "access_removed" is approved but no longer on the list. */
export type ApplicationDisplayStatus = ApplicationStatus | "access_removed";

export function applicationDisplayStatus(app: {
  status: ApplicationStatus;
  on_access_list?: boolean;
}): ApplicationDisplayStatus {
  return app.status === "approved" && app.on_access_list === false ? "access_removed" : app.status;
}

export const APPLICATION_DISPLAY_STATUS_LABELS: Record<ApplicationDisplayStatus, string> = {
  ...APPLICATION_STATUS_LABELS,
  access_removed: "Access removed",
};

/** Up to two initials from a full name, falling back to the username. */
export function creatorInitials(fullName?: string | null, username?: string | null): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const handle = (username ?? "").replace(/^@/, "").trim();
  return handle ? handle.slice(0, 2).toUpperCase() : "?";
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * One-line result of adding usernames, e.g. "Added 12 creators · 2 already had access · 3 not found".
 * Failed names are listed separately in the UI, not in this line.
 */
export function formatAddResultSummary(
  result: { added: number; alreadyOnList?: number; notFound?: string[]; invalid?: string[] },
  alreadyLabel = "already had access",
): string {
  const parts = [`Added ${plural(result.added, "creator")}`];
  if (result.alreadyOnList) parts.push(`${result.alreadyOnList} ${alreadyLabel}`);
  if (result.notFound?.length) parts.push(`${result.notFound.length} not found`);
  if (result.invalid?.length) parts.push(`${result.invalid.length} invalid`);
  return parts.join(" · ");
}

/** Most applications a brand can review in one bulk request (matches the bulk API). */
export const MAX_BULK_REVIEW = 200;

/** One-tap reasons in the reject dialog. "Other" leaves the text for the brand to write. */
export const REJECTION_REASON_PRESETS = [
  "Audience doesn't match",
  "Portfolio doesn't fit",
  "Campaign is full",
] as const;

/** The first answered question, for a one-line preview in the applications list. */
export function applicationAnswerPreview(
  answers: readonly ApplicationAnswer[],
): { prompt: string; text: string; isLink: boolean } | null {
  const first = answers.find((a) => a.answer.trim() !== "");
  if (!first) return null;
  const text =
    first.kind === "yes_no" ? (first.answer === "yes" ? "Yes" : "No") : first.answer.trim();
  return { prompt: first.prompt, text, isLink: first.kind === "url" };
}

/** Host name of a link answer, e.g. "instagram.com", or the raw text if it isn't a URL. */
export function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Per-status counts after a review succeeds, so the tabs update without a reload.
 * Re-approving an approved creator whose access was removed leaves the counts unchanged.
 */
export function countsAfterReview(
  counts: Record<ApplicationStatus, number>,
  reviewed: readonly Pick<ContestApplication, "status">[],
  decision: "approve" | "reject",
): Record<ApplicationStatus, number> {
  const next = { ...counts };
  const target: ApplicationStatus = decision === "approve" ? "approved" : "rejected";
  for (const app of reviewed) {
    if (app.status === target) continue;
    next[app.status] = Math.max(0, next[app.status] - 1);
    next[target] += 1;
  }
  return next;
}

/** Whole days until a date (rounded up), or null when there's no date or it has passed. */
export function daysUntil(date: string | null | undefined, now: Date = new Date()): number | null {
  if (!date) return null;
  const end = new Date(date).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - now.getTime();
  return diff > 0 ? Math.ceil(diff / 86_400_000) : null;
}

/** How many questions have a non-empty answer. */
export function countAnsweredQuestions(
  questions: readonly { id: string }[],
  answers: Record<string, string | undefined>,
): number {
  return questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
}

/** localStorage key for a creator's unsent answers to one campaign. */
export function applicationDraftKey(contestId: string): string {
  return `goc:application-draft:${contestId}`;
}

/** Restores a saved draft, keeping only string answers to questions that still exist. */
export function parseApplicationDraft(
  raw: string | null,
  questions: readonly { id: string }[],
): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const ids = new Set(questions.map((q) => q.id));
    const draft: Record<string, string> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (ids.has(id) && typeof value === "string") draft[id] = value;
    }
    return draft;
  } catch {
    return {};
  }
}

/**
 * Usernames from an uploaded CSV or text file: the first cell of each row,
 * skipping a header row such as "username" or "handle".
 */
export function parseUsernameCsv(text: string): string[] {
  const rows = text.split(/\r?\n/);
  const names: string[] = [];
  rows.forEach((row, i) => {
    const cell = row.split(/[,;\t]/)[0]?.trim().replace(/^"|"$/g, "").trim() ?? "";
    if (!cell) return;
    if (i === 0 && /^(user ?names?|handles?|creators?|@)$/i.test(cell)) return;
    names.push(cell);
  });
  return names;
}

/** Key the Access tab filters by: a specific saved list or invite link, else the source. */
export function accessMemberFilterKey(m: ContestAccessMember): string {
  if (m.source === "saved_list" && m.source_allowlist_id) return `list:${m.source_allowlist_id}`;
  if (m.source === "invite_link" && m.source_invite_link_id) return `invite:${m.source_invite_link_id}`;
  return m.source;
}

/** Human label for where a creator on the access list came from. */
export function accessMemberSourceLabel(m: ContestAccessMember): string {
  if (m.source === "saved_list") return `List: ${m.source_allowlist_name ?? "deleted list"}`;
  if (m.source === "invite_link" && m.source_invite_link_id) {
    return `Invite link: ${m.source_invite_link_label ?? "Untitled link"}`;
  }
  return ACCESS_SOURCE_LABELS[m.source];
}

export type RosterSortKey = "creator" | "source" | "added";

export function sortAccessMembers(
  members: readonly ContestAccessMember[],
  key: RosterSortKey,
  direction: "asc" | "desc",
): ContestAccessMember[] {
  const value = (m: ContestAccessMember): string =>
    key === "creator"
      ? (m.username ?? "").toLowerCase()
      : key === "source"
        ? accessMemberSourceLabel(m).toLowerCase()
        : m.added_at;
  const sign = direction === "asc" ? 1 : -1;
  return [...members].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    return va < vb ? -sign : va > vb ? sign : 0;
  });
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV of the access list for download. */
export function accessMembersToCsv(members: readonly ContestAccessMember[]): string {
  const rows = [
    ["username", "full_name", "source", "added_at"],
    ...members.map((m) => [m.username ?? "", m.full_name ?? "", accessMemberSourceLabel(m), m.added_at]),
  ];
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

/**
 * What happens when a saved campaign switches who can see it, for the confirm
 * dialog. Mirrors the database: existing submitters are added to the access
 * list, invite links are revoked when going Public, and only Restricted
 * campaigns take applications.
 */
export function accessModeSwitchNotes(
  from: AccessMode,
  to: AccessMode,
  submissions: number | null,
): string[] {
  if (from === to) return [];
  const notes: string[] = [];
  if (to === "public") notes.push("Anyone can see this campaign.");
  if (to === "private") notes.push("Only creators on the access list can see it.");
  if (to === "restricted") {
    notes.push("Everyone sees a preview. Creators apply and you choose who joins.");
  }
  if (from === "public" && submissions && submissions > 0) {
    notes.push(
      `Creators who already submitted (${submissions} submission${submissions === 1 ? "" : "s"}) are added to the access list and keep access.`,
    );
  }
  if (to === "public") notes.push("Active invite links will be revoked.");
  if (from === "restricted") {
    notes.push(
      to === "public"
        ? "Pending applications stay as they are, and the Applications tab is hidden."
        : "Pending applications stay pending, and creators can't apply while it's Private. Switch back to Restricted to review them.",
    );
  }
  return notes;
}

/** Whether switching needs a confirm: anything beyond a plain description of the new mode. */
export function accessModeSwitchNeedsConfirm(
  from: AccessMode,
  to: AccessMode,
  submissions: number | null,
): boolean {
  return accessModeSwitchNotes(from, to, submissions).length > 1;
}

/**
 * Field-level problems with one question, matching validateApplicationQuestions,
 * so the editor can show them while the brand types.
 */
export function questionFieldErrors(q: Pick<ApplicationQuestion, "prompt" | "kind" | "options">): {
  prompt: string | null;
  options: string | null;
  optionErrors: (string | null)[];
} {
  const prompt = q.prompt.trim();
  const promptError = !prompt
    ? "Write the question"
    : prompt.length > MAX_QUESTION_PROMPT_LENGTH
      ? `Keep it to ${MAX_QUESTION_PROMPT_LENGTH} characters or fewer`
      : null;
  if (q.kind !== "single_choice") return { prompt: promptError, options: null, optionErrors: [] };

  const seen = new Set<string>();
  const optionErrors = (q.options ?? []).map((raw) => {
    const text = raw.trim();
    if (!text) return null;
    if (text.length > MAX_CHOICE_OPTION_LENGTH) return `Keep it to ${MAX_CHOICE_OPTION_LENGTH} characters or fewer`;
    const key = text.toLowerCase();
    if (seen.has(key)) return "This choice is already listed";
    seen.add(key);
    return null;
  });
  const options = seen.size < MIN_CHOICE_OPTIONS ? `Add at least ${MIN_CHOICE_OPTIONS} choices` : null;
  return { prompt: promptError, options, optionErrors };
}

/** One-click starter questions for the editor. */
export function applicationQuestionTemplates(endDate?: string | null): (ApplicationQuestion & {
  label: string;
})[] {
  const d = endDate ? new Date(endDate) : null;
  const by =
    d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "the end date";
  return [
    { label: "Link to your best work", prompt: "Link to your best work", kind: "url", options: null, required: true },
    { label: "Why are you a good fit?", prompt: "Why are you a good fit for this campaign?", kind: "long_text", options: null, required: true },
    {
      label: "Follower count range",
      prompt: "How many followers do you have on your main platform?",
      kind: "single_choice",
      options: ["Under 1K", "1K–10K", "10K–100K", "100K+"],
      required: true,
    },
    { label: "Can you post in time?", prompt: `Can you post by ${by}?`, kind: "yes_no", options: null, required: true },
  ];
}
