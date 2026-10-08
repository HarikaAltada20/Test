export const ACCESS_MODES = ["public", "restricted", "private"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

/** Modes brands/admins may select today. `restricted` ships in a later phase. */
export const SELECTABLE_ACCESS_MODES: readonly AccessMode[] = ["public", "private"];

export type ContestAccessSource = "saved_list" | "manual" | "existing_submitter";

export const ACCESS_SOURCE_LABELS: Record<ContestAccessSource, string> = {
  saved_list: "Saved list",
  manual: "Added manually",
  existing_submitter: "Existing submitter",
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
