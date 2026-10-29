/**
 * Review before posting: shared types, limits, labels and validation for
 * content drafts. Client-safe (no server imports).
 *
 * Database: db/migrations/20261022_review_before_posting.sql
 */

export const CONTENT_DRAFTS_BUCKET = "content-drafts";

/** Matches the bucket's file_size_limit (100 MB). */
export const MAX_DRAFT_FILE_BYTES = 100 * 1024 * 1024;
/** Longest video accepted, in seconds (the database allows one second of rounding). */
export const MAX_DRAFT_DURATION_SEC = 180;
export const MAX_DRAFT_TITLE_LENGTH = 200;
export const MAX_DRAFT_CAPTION_LENGTH = 2200;
export const MAX_DRAFT_HASHTAGS = 30;
export const MAX_DRAFT_HASHTAG_LENGTH = 100;
export const MAX_DRAFT_NOTE_LENGTH = 1000;
export const MAX_DRAFT_REASON_LENGTH = 1000;
export const MAX_DRAFT_COMMENT_LENGTH = 2000;
/** Draft cards in one upload dialog (also capped by the creator's free slots). */
export const MAX_DRAFTS_PER_UPLOAD = 10;

/** Campaign defaults when the setting is turned on. NULL in the database means no limit. */
export const DEFAULT_DRAFT_MAX_OPEN = 20;
export const DEFAULT_DRAFT_MAX_REVISIONS = 5;
export const DRAFT_LIMIT_RANGES = {
  open: { min: 1, max: 500 },
  revisions: { min: 0, max: 50 },
  rejections: { min: 1, max: 500 },
} as const;

export const DRAFT_VIDEO_TYPES: Record<string, "mp4" | "mov" | "webm"> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
export const DRAFT_FILE_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";

export type DraftStatus =
  | "pending_review"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "withdrawn";
/** Status shown to people: an approved draft with a linked post is "posted". */
export type DraftDisplayStatus = DraftStatus | "posted";

export const DRAFT_STATUS_LABELS: Record<DraftDisplayStatus, string> = {
  pending_review: "In review",
  revision_requested: "Revision requested",
  approved: "Approved",
  posted: "Posted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export type DraftBadgeTone = "green" | "slate" | "purple" | "amber" | "red" | "gray";
export const DRAFT_STATUS_TONES: Record<DraftDisplayStatus, DraftBadgeTone> = {
  pending_review: "purple",
  revision_requested: "amber",
  approved: "green",
  posted: "slate",
  rejected: "red",
  withdrawn: "gray",
};

/** Creator list filters ("approved" = approved and not posted yet). */
export const MY_DRAFT_FILTERS = [
  "all",
  "pending_review",
  "revision_requested",
  "approved",
  "posted",
  "rejected",
] as const;
export type MyDraftFilter = (typeof MY_DRAFT_FILTERS)[number];

/** Brand review tabs. */
export const CAMPAIGN_DRAFT_FILTERS = [
  "pending_review",
  "revision_requested",
  "approved",
  "posted",
  "rejected",
  "all",
] as const;
export type CampaignDraftFilter = (typeof CAMPAIGN_DRAFT_FILTERS)[number];

export const DRAFT_FILTER_LABELS: Record<MyDraftFilter | CampaignDraftFilter, string> = {
  all: "All",
  pending_review: "In review",
  revision_requested: "Revision requested",
  approved: "Approved",
  posted: "Posted",
  rejected: "Rejected",
};
export const CAMPAIGN_DRAFT_FILTER_LABELS: Record<CampaignDraftFilter, string> = {
  ...DRAFT_FILTER_LABELS,
  pending_review: "To review",
};

export type DraftSort = "oldest" | "newest";

export type DraftCampaignCard = {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  platform: string | null;
  end_date: string | null;
  has_ended: boolean;
  review_before_posting: boolean;
  brand_name: string | null;
};

export type DraftPost = {
  id: string;
  platform: string | null;
  status: string | null;
  content_link: string | null;
  created_at: string;
};

export type DraftVersionSummary = {
  id: string;
  version_no: number;
  title: string;
  caption: string | null;
  hashtags: string[];
  poster_path: string | null;
  duration_sec: number | string | null;
  size_bytes: number;
  mime_type: string;
  created_at: string;
};

export type DraftVersion = DraftVersionSummary & {
  creator_note: string | null;
  storage_path: string;
  width: number | null;
  height: number | null;
};

export type DraftRecord = {
  approved: number;
  rejected: number;
  revisions: number;
  withdrawn: number;
  draft_trust: number;
};

export type DraftCreator = {
  id: string;
  username: string | null;
  full_name: string | null;
  profile_picture_url: string | null;
};

export type DraftListRow = {
  id: string;
  contest_id: string;
  creator_id: string;
  status: DraftStatus;
  display_status: DraftDisplayStatus;
  version_count: number;
  revision_count: number;
  approved_version_id: string | null;
  approved_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  files_purged: boolean;
  current_version: DraftVersionSummary | null;
  posts: DraftPost[];
  campaign: DraftCampaignCard | null;
  /** Brand and admin lists only. */
  creator?: DraftCreator | null;
  record?: DraftRecord | null;
};

export type DraftEventKind =
  | "submitted"
  | "revised"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "withdrawn"
  | "approval_revoked"
  | "comment"
  | "posted"
  | "expired";

export type DraftEvent = {
  id: string;
  kind: DraftEventKind;
  actor_role: "creator" | "brand" | "admin" | "system";
  actor_id: string | null;
  actor_name: string | null;
  is_me: boolean;
  body: string | null;
  version_id: string | null;
  version_no: number | null;
  submission_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type DraftPermissions = {
  revise: boolean;
  withdraw: boolean;
  post: boolean;
  comment: boolean;
  review: boolean;
  revoke: boolean;
  request_revision: boolean;
};

export type DraftDetail = DraftListRow & {
  viewer_role: "creator" | "brand" | "admin";
  max_revisions: number | null;
  versions: DraftVersion[];
  events: DraftEvent[];
  can: DraftPermissions;
  /** Why the creator can't send to this campaign now (campaign_status codes), or null. */
  campaign_block: string | null;
};

export type DraftListPage = {
  total: number;
  counts: Partial<Record<DraftDisplayStatus, number>>;
  rows: DraftListRow[];
  /** Brand lists only: whether the campaign currently requires review. */
  review_before_posting?: boolean;
};

/** content_draft_campaign_status for the signed-in creator. */
export type CampaignDraftStatus = {
  review_before_posting: boolean;
  can_upload?: boolean;
  block_reason?: string | null;
  counts?: Partial<Record<DraftDisplayStatus, number>>;
  open_count?: number;
  rejected_count?: number;
  max_open?: number | null;
  max_revisions?: number | null;
  max_rejections?: number | null;
};

export type DraftReviewDecision = "approve" | "request_revision" | "reject";

export type DraftMedia = {
  version_id: string;
  video_url: string | null;
  download_url: string | null;
  poster_url: string | null;
  purged: boolean;
};

export function isDraftDisplayStatus(value: unknown): value is DraftDisplayStatus {
  return typeof value === "string" && value in DRAFT_STATUS_LABELS;
}

export function isDraftReviewDecision(value: unknown): value is DraftReviewDecision {
  return value === "approve" || value === "request_revision" || value === "reject";
}

export function parseMyDraftFilter(value: unknown): MyDraftFilter {
  return typeof value === "string" && (MY_DRAFT_FILTERS as readonly string[]).includes(value)
    ? (value as MyDraftFilter)
    : "all";
}

export function parseCampaignDraftFilter(value: unknown): CampaignDraftFilter {
  return typeof value === "string" && (CAMPAIGN_DRAFT_FILTERS as readonly string[]).includes(value)
    ? (value as CampaignDraftFilter)
    : "pending_review";
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Hashtags from free text ("#summer, fun  #GoC"): without '#', no spaces,
 * de-duplicated case-insensitively (first spelling wins), in order. Mirrors
 * content_draft_clean_hashtags in the database.
 */
export function parseHashtags(input: string | readonly string[]): string[] {
  const parts = typeof input === "string" ? input.split(/[\s,]+/) : input;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const tag = String(raw ?? "").trim().replace(/^#+/, "");
    if (!tag || tag.length > MAX_DRAFT_HASHTAG_LENGTH || /[\s#]/.test(tag)) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** File extension stored for a video type, or null when the type isn't accepted. */
export function draftVideoExtension(file: { type?: string | null; name?: string | null }): "mp4" | "mov" | "webm" | null {
  const type = (file.type || "").toLowerCase();
  if (DRAFT_VIDEO_TYPES[type]) return DRAFT_VIDEO_TYPES[type];
  // Some browsers leave .mov/.webm types empty; fall back to the name.
  if (!type) {
    const ext = (file.name || "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    if (ext === "mp4" || ext === "m4v") return "mp4";
    if (ext === "mov") return "mov";
    if (ext === "webm") return "webm";
  }
  return null;
}

/** Content type to upload with, from the extension we accepted. */
export function draftVideoContentType(ext: "mp4" | "mov" | "webm"): string {
  return ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4";
}

/** Problem with a picked video before uploading, or null. */
export function validateDraftFile(
  file: { type?: string | null; name?: string | null; size: number },
  durationSec?: number | null,
): string | null {
  if (!draftVideoExtension(file)) return "Use an MP4, MOV or WebM video.";
  if (file.size <= 0) return "This file is empty.";
  if (file.size > MAX_DRAFT_FILE_BYTES) {
    return `This video is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_DRAFT_FILE_BYTES)}.`;
  }
  if (durationSec != null && Number.isFinite(durationSec) && durationSec > MAX_DRAFT_DURATION_SEC + 1) {
    return `This video is ${formatDuration(durationSec)} long. The limit is ${formatDuration(MAX_DRAFT_DURATION_SEC)}.`;
  }
  return null;
}

export type DraftFieldErrors = Partial<Record<"title" | "caption" | "hashtags" | "note", string>>;

export function validateDraftFields(input: {
  title: string;
  caption?: string | null;
  hashtags?: readonly string[];
  note?: string | null;
}): DraftFieldErrors {
  const errors: DraftFieldErrors = {};
  const title = input.title.trim();
  if (!title) errors.title = "Add a title.";
  else if (title.length > MAX_DRAFT_TITLE_LENGTH) errors.title = `Use ${MAX_DRAFT_TITLE_LENGTH} characters or fewer.`;
  if ((input.caption ?? "").trim().length > MAX_DRAFT_CAPTION_LENGTH) {
    errors.caption = `Use ${MAX_DRAFT_CAPTION_LENGTH} characters or fewer.`;
  }
  if ((input.hashtags?.length ?? 0) > MAX_DRAFT_HASHTAGS) {
    errors.hashtags = `Use ${MAX_DRAFT_HASHTAGS} hashtags or fewer.`;
  }
  if ((input.note ?? "").trim().length > MAX_DRAFT_NOTE_LENGTH) {
    errors.note = `Use ${MAX_DRAFT_NOTE_LENGTH} characters or fewer.`;
  }
  return errors;
}

/** Where a version's video goes in the bucket. The database checks this exact path. */
export function draftVideoPath(creatorId: string, draftId: string, versionId: string, ext: string): string {
  return `${creatorId}/${draftId}/${versionId}.${ext}`;
}

export function draftPosterPath(creatorId: string, draftId: string, versionId: string): string {
  return `${creatorId}/${draftId}/${versionId}-poster.jpg`;
}

/** Title suggestion from a file name: "my_video-final.mp4" -> "my video final". */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DRAFT_TITLE_LENGTH);
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 10) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** 75 -> "1:15", 180 -> "3:00". */
export function formatDuration(seconds: number | string | null | undefined): string {
  const n = typeof seconds === "string" ? Number(seconds) : seconds;
  if (n == null || !Number.isFinite(n) || n < 0) return "";
  const total = Math.round(n);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Draft trust score, same scale as the submission trust score:
 * (approved - rejected) / approved x 100, clamped 0-100. With no approvals it
 * is 100 when nothing was rejected, otherwise 0. Mirrors creator_draft_records.
 */
export function draftTrustScore(approved: number, rejected: number): number {
  if (approved <= 0) return rejected > 0 ? 0 : 100;
  return Math.max(0, Math.min(100, Math.round(((approved - rejected) / approved) * 100)));
}

/**
 * A creator's own record from their draft counts (all campaigns), matching
 * creator_draft_records: posted drafts count as approved.
 */
export function draftRecordFromCounts(counts: DraftListPage["counts"]): {
  approved: number;
  rejected: number;
  trust: number;
} {
  const approved = (counts.approved ?? 0) + (counts.posted ?? 0);
  const rejected = counts.rejected ?? 0;
  return { approved, rejected, trust: draftTrustScore(approved, rejected) };
}

/** "14 approved · 2 rejected · 5 revisions". */
export function formatDraftRecord(record: DraftRecord | null | undefined): string {
  if (!record) return "No drafts yet";
  const parts = [
    `${record.approved} approved`,
    `${record.rejected} rejected`,
    `${record.revisions} ${record.revisions === 1 ? "revision" : "revisions"}`,
  ];
  return parts.join(" · ");
}

/** What the creator should do next, shown on list rows. */
export function draftNextStep(row: Pick<DraftListRow, "display_status" | "campaign">): string {
  switch (row.display_status) {
    case "pending_review":
      return "Waiting for the brand. Don't post yet.";
    case "revision_requested":
      return "Upload a revision";
    case "approved":
      return row.campaign?.has_ended ? "The campaign has ended" : "Post it, then submit the link";
    case "posted":
      return "Linked to your submission";
    case "rejected":
      return "Closed. You can start a new draft.";
    case "withdrawn":
      return "Withdrawn";
  }
}

/** Waiting time for brand lists: "3 h", "2 d". */
export function waitingLabel(since: string | null | undefined, now: Date = new Date()): string {
  if (!since) return "";
  const ms = now.getTime() - new Date(since).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

export const DRAFT_EVENT_LABELS: Record<DraftEventKind, string> = {
  submitted: "sent the draft for review",
  revised: "uploaded a revision",
  approved: "approved",
  revision_requested: "asked for changes",
  rejected: "rejected the draft",
  withdrawn: "withdrew the draft",
  approval_revoked: "withdrew the approval",
  comment: "",
  posted: "posted it",
  expired: "Closed automatically",
};

/** Quick reasons in the review dialog. */
export const DRAFT_REVISION_PRESETS = [
  "Show the product earlier",
  "Mention the brand",
  "Audio issue",
  "Follow the brief",
] as const;
export const DRAFT_REJECTION_PRESETS = [
  "Off-brief",
  "Brand guidelines not followed",
  "Low video quality",
  "Not a fit for this campaign",
] as const;

// ---------------------------------------------------------------------------
// Result codes from the database functions
// ---------------------------------------------------------------------------

/** Why a creator can't send drafts to a campaign now (content_draft_campaign_check + limits). */
export function draftBlockMessage(
  code: string | null | undefined,
  status?: Pick<CampaignDraftStatus, "max_open" | "max_rejections"> | null,
): string | null {
  switch (code) {
    case null:
    case undefined:
    case "":
      return null;
    case "review_not_enabled":
      return "This campaign doesn't review videos before posting.";
    case "not_started":
      return "This campaign hasn't started yet.";
    case "ended":
      return "This campaign has ended.";
    case "no_access":
      return "You don't have access to this campaign.";
    case "requirements_not_met":
      return "You don't meet this campaign's creator requirements yet.";
    case "open_limit_reached":
      return status?.max_open
        ? `You have ${status.max_open} drafts waiting on the brand, the most this campaign allows. You can send more once they're reviewed.`
        : "You have the most drafts this campaign allows in review.";
    case "rejection_limit_reached":
      return status?.max_rejections
        ? `${status.max_rejections} of your drafts were rejected, so this campaign doesn't accept new drafts from you.`
        : "This campaign doesn't accept new drafts from you.";
    case "not_found":
      return "This campaign isn't available.";
    default:
      return "You can't send drafts to this campaign right now.";
  }
}

/** Message for create_content_draft / add_content_draft_version results. */
export function draftSendResultMessage(result: string, detail?: string | null): string {
  switch (result) {
    case "submitted":
      return "Sent for review.";
    case "upload_missing":
      return "The upload didn't finish. Try again.";
    case "invalid_file":
      if (detail === "type") return "Use an MP4, MOV or WebM video.";
      if (detail === "size") return `The video must be ${formatBytes(MAX_DRAFT_FILE_BYTES)} or smaller.`;
      return "The upload didn't match this draft. Try again.";
    case "invalid_input":
      if (detail === "title") return "Add a title (200 characters or fewer).";
      if (detail === "caption") return `Keep the caption to ${MAX_DRAFT_CAPTION_LENGTH} characters.`;
      if (detail === "hashtags") return `Use ${MAX_DRAFT_HASHTAGS} hashtags or fewer.`;
      if (detail === "note") return `Keep the note to ${MAX_DRAFT_NOTE_LENGTH} characters.`;
      if (detail === "duration") return `Videos can be up to ${formatDuration(MAX_DRAFT_DURATION_SEC)} long.`;
      return "Check the draft details.";
    case "open_limit_reached":
      return draftBlockMessage("open_limit_reached", { max_open: Number(detail) || null })!;
    case "rejection_limit_reached":
      return draftBlockMessage("rejection_limit_reached", { max_rejections: Number(detail) || null })!;
    case "invalid_state":
      return detail === "pending_review"
        ? "This draft is already in review."
        : "This draft can't take a new version now.";
    case "conflict":
      return "Something went wrong with this draft. Remove it and add the video again.";
    case "not_creator":
      return "Only creator accounts can send drafts.";
    case "not_signed_in":
      return "Sign in to send drafts.";
    default:
      return draftBlockMessage(result) ?? "Couldn't send this draft. Try again.";
  }
}

export function draftReviewResultMessage(result: string): string {
  switch (result) {
    case "approved":
      return "Approved. The creator can post it now.";
    case "revision_requested":
      return "Revision requested. The creator has been notified.";
    case "rejected":
      return "Rejected. The creator has been notified.";
    case "stale":
      return "This draft changed (a new version or someone else's decision). Showing the latest.";
    case "already_posted":
      return "This draft is already posted, so the approval can't be changed.";
    case "revision_limit_reached":
      return "This draft has used all its revision rounds. Approve or reject it.";
    case "reason_required":
      return "Add a reason so the creator knows what to change.";
    case "forbidden":
      return "You can't review drafts for this campaign.";
    case "not_found":
      return "This draft no longer exists.";
    case "invalid_input":
      return `Keep the reason to ${MAX_DRAFT_REASON_LENGTH} characters.`;
    default:
      return "Couldn't save the decision. Try again.";
  }
}

/**
 * Message for a submission insert refused by the review-before-posting gate,
 * or null when the error is something else.
 */
export function draftSubmissionErrorMessage(message: string | null | undefined): string | null {
  const m = message ?? "";
  if (m.includes("draft_required")) {
    return "This campaign reviews videos before they're posted. Choose your approved draft first.";
  }
  if (m.includes("draft_not_approved")) {
    return "That draft isn't approved anymore. Check its status in My Submissions → Drafts.";
  }
  if (m.includes("draft_already_posted")) {
    return "That draft is already linked to a post on this platform. Pick another approved draft.";
  }
  if (m.includes("draft_posted_before_approval")) {
    return "This post went live before your draft was approved. Post the approved video again, then submit the new link.";
  }
  if (m.includes("draft_not_found")) {
    return "That draft isn't yours or belongs to another campaign.";
  }
  if (m.includes("draft_link_locked")) {
    return "A post linked to an approved draft can't be changed.";
  }
  return null;
}

/** In-app notification types (db/migrations/20261021_content_draft_notification_types.sql). */
export const CONTENT_DRAFT_NOTIFICATION_TYPES = [
  "content_draft_submitted",
  "content_draft_approved",
  "content_draft_revision_requested",
  "content_draft_rejected",
  "content_draft_comment",
] as const;
export type ContentDraftNotificationType = (typeof CONTENT_DRAFT_NOTIFICATION_TYPES)[number];

export function isContentDraftNotificationType(type: string): type is ContentDraftNotificationType {
  return (CONTENT_DRAFT_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

/**
 * Where a draft notification opens: the campaign's Drafts tab for brands and
 * admins (campaignPath is their campaign page), the creator's drafts otherwise.
 */
export function draftNotificationHref(contestId: string, userType: string, campaignPath: string): string {
  if (userType === "advertiser" || userType === "admin") return `${campaignPath}?tab=drafts`;
  return `/dashboard/submissions?view=drafts&campaign=${encodeURIComponent(contestId)}`;
}

/** Normalised campaign settings from create/edit forms. */
export type DraftReviewSettings = {
  review_before_posting: boolean;
  draft_max_open: number | null;
  draft_max_revisions: number | null;
  draft_max_rejections: number | null;
};

export const DEFAULT_DRAFT_REVIEW_SETTINGS: DraftReviewSettings = {
  review_before_posting: false,
  draft_max_open: DEFAULT_DRAFT_MAX_OPEN,
  draft_max_revisions: DEFAULT_DRAFT_MAX_REVISIONS,
  draft_max_rejections: null,
};

function limitOrNull(value: unknown, range: { min: number; max: number }): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(range.max, Math.max(range.min, Math.round(n)));
}

/** Reads the four contest columns (or form values), clamped to the database ranges. */
export function normalizeDraftReviewSettings(raw: Partial<Record<keyof DraftReviewSettings, unknown>> | null | undefined): DraftReviewSettings {
  const r = raw ?? {};
  return {
    review_before_posting: r.review_before_posting === true,
    draft_max_open:
      r.draft_max_open === undefined ? DEFAULT_DRAFT_MAX_OPEN : limitOrNull(r.draft_max_open, DRAFT_LIMIT_RANGES.open),
    draft_max_revisions:
      r.draft_max_revisions === undefined
        ? DEFAULT_DRAFT_MAX_REVISIONS
        : limitOrNull(r.draft_max_revisions, DRAFT_LIMIT_RANGES.revisions),
    draft_max_rejections: limitOrNull(r.draft_max_rejections, DRAFT_LIMIT_RANGES.rejections),
  };
}

/** The review settings present in a create/update payload, normalised. Keys not sent stay out. */
export function pickDraftReviewSettings(raw: Record<string, unknown> | null | undefined): Partial<DraftReviewSettings> {
  const r = raw ?? {};
  const out: Partial<DraftReviewSettings> = {};
  if (r.review_before_posting !== undefined) out.review_before_posting = r.review_before_posting === true;
  if (r.draft_max_open !== undefined) out.draft_max_open = limitOrNull(r.draft_max_open, DRAFT_LIMIT_RANGES.open);
  if (r.draft_max_revisions !== undefined) {
    out.draft_max_revisions = limitOrNull(r.draft_max_revisions, DRAFT_LIMIT_RANGES.revisions);
  }
  if (r.draft_max_rejections !== undefined) {
    out.draft_max_rejections = limitOrNull(r.draft_max_rejections, DRAFT_LIMIT_RANGES.rejections);
  }
  return out;
}

export const DRAFT_REVIEW_SETTING_KEYS = [
  "review_before_posting",
  "draft_max_open",
  "draft_max_revisions",
  "draft_max_rejections",
] as const;

/** The approved draft a published submission was made from (brand and admin views). */
export type SubmissionDraftLink = {
  draftId: string;
  /** The version that was approved and posted. */
  versionId: string;
  versionNo: number | null;
  title: string | null;
  caption: string | null;
  hashtags: string[];
  durationSec: number | null;
  approvedAt: string | null;
  /** When the creator submitted the posted link. */
  submittedAt: string | null;
  /** Draft revision rounds before approval. */
  revisionCount: number;
  filesPurged: boolean;
};

/** Maps each linked submission id to its approved draft, from the brand's draft list rows. */
export function buildSubmissionDraftMap(rows: DraftListRow[]): Map<string, SubmissionDraftLink> {
  const map = new Map<string, SubmissionDraftLink>();
  for (const row of rows) {
    const version = row.current_version;
    const versionId = row.approved_version_id ?? version?.id ?? null;
    if (!versionId) continue;
    const duration = Number(version?.duration_sec);
    for (const post of row.posts ?? []) {
      if (!post?.id) continue;
      map.set(post.id, {
        draftId: row.id,
        versionId,
        versionNo: version?.version_no ?? null,
        title: version?.title ?? null,
        caption: version?.caption ?? null,
        hashtags: version?.hashtags ?? [],
        durationSec: Number.isFinite(duration) && duration > 0 ? duration : null,
        approvedAt: row.approved_at,
        submittedAt: post.created_at ?? null,
        revisionCount: row.revision_count ?? 0,
        filesPurged: !!row.files_purged,
      });
    }
  }
  return map;
}

/** "3 h after approval", or null when either time is missing. */
export function postedAfterApprovalLabel(
  approvedAt: string | null | undefined,
  postedAt: string | null | undefined,
): string | null {
  if (!approvedAt || !postedAt) return null;
  const ms = new Date(postedAt).getTime() - new Date(approvedAt).getTime();
  if (!Number.isFinite(ms)) return null;
  if (ms < 60_000) return "right after approval";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min after approval`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h after approval`;
  return `${Math.round(hours / 24)} days after approval`;
}
