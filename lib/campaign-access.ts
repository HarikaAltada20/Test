export const ACCESS_MODES = ["public", "restricted", "private"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

/** Modes brands/admins may select today. `restricted` ships in a later phase. */
export const SELECTABLE_ACCESS_MODES: readonly AccessMode[] = ["public", "private"];

export type ContestAccessSource =
  | "saved_list"
  | "manual"
  | "existing_submitter"
  | "invite_link";

export const ACCESS_SOURCE_LABELS: Record<ContestAccessSource, string> = {
  saved_list: "Saved list",
  manual: "Added manually",
  existing_submitter: "Existing submitter",
  invite_link: "Invite link",
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
  return null;
}

/** Maps the submission trigger's access error to a user-facing message. */
export function isCampaignAccessDeniedError(message: string | null | undefined): boolean {
  return typeof message === "string" && message.includes("campaign_access_denied");
}

export function isInviteExpiryPreset(value: unknown): value is InviteExpiryPreset {
  return INVITE_EXPIRY_PRESETS.some((p) => p.value === value);
}

/**
 * Turns an expiry choice into an ISO timestamp (null = never).
 * Custom dates must be in the future; returns an error message otherwise.
 */
export function resolveInviteExpiry(
  preset: InviteExpiryPreset,
  customExpiresAt: string | null | undefined,
  now: Date = new Date(),
): { expiresAt: string | null } | { error: string } {
  if (preset === "never") return { expiresAt: null };
  if (preset === "custom") {
    const date = customExpiresAt ? new Date(customExpiresAt) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return { error: "Choose an expiry date" };
    }
    if (date.getTime() <= now.getTime()) {
      return { error: "The expiry date must be in the future" };
    }
    return { expiresAt: date.toISOString() };
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
