// Shared parsing and validation for the admin user search (Manual Entry modal).
// Pure module: safe to import from client components and API routes.

export type UserSearchScope = "all" | "username" | "name" | "email" | "id";
export type UserSearchType = "all" | "creator" | "advertiser";

export const USER_SEARCH_SCOPES: ReadonlyArray<{
  value: UserSearchScope;
  label: string;
  shortcut: string | null;
  placeholder: string;
}> = [
  {
    value: "all",
    label: "All",
    shortcut: null,
    placeholder: "Search by name, email, username, or user ID",
  },
  {
    value: "username",
    label: "Username",
    shortcut: "@",
    placeholder: "Search by username",
  },
  { value: "name", label: "Name", shortcut: "name:", placeholder: "Search by name" },
  {
    value: "email",
    label: "Email",
    shortcut: "email:",
    placeholder: "Search by email",
  },
  {
    value: "id",
    label: "User ID",
    shortcut: "id:",
    placeholder: "Search by user ID or ID prefix",
  },
];

export const USER_SEARCH_MAX_LENGTH = 100;

// Typed at the very start of the box (while scope is All) to switch scope.
const SHORTCUTS: ReadonlyArray<[string, UserSearchScope]> = [
  ["@", "username"],
  ["name:", "name"],
  ["email:", "email"],
  ["id:", "id"],
  ["#", "id"],
];

/**
 * Detects a scope shortcut at the start of the input.
 * Returns null when the input has no shortcut prefix, so an "@" inside an
 * email address never changes scope.
 */
export function detectScopeShortcut(
  raw: string
): { scope: UserSearchScope; rest: string } | null {
  const lower = raw.toLowerCase();
  for (const [prefix, scope] of SHORTCUTS) {
    if (lower.startsWith(prefix)) {
      return { scope, rest: raw.slice(prefix.length).trimStart() };
    }
  }
  return null;
}

export function isUserSearchScope(value: unknown): value is UserSearchScope {
  return USER_SEARCH_SCOPES.some((s) => s.value === value);
}

export function isUserSearchType(value: unknown): value is UserSearchType {
  return value === "all" || value === "creator" || value === "advertiser";
}

export function minQueryLength(scope: UserSearchScope): number {
  return scope === "id" ? 4 : 2;
}

/** Normalizes the term for a scope: trims, drops a leading @ for usernames. */
export function normalizeSearchTerm(scope: UserSearchScope, raw: string): string {
  let term = raw.trim();
  if (scope === "username") term = term.replace(/^@+/, "");
  if (scope === "id") term = term.replace(/^#/, "").toLowerCase();
  return term.slice(0, USER_SEARCH_MAX_LENGTH);
}

export type ParsedUserSearch =
  | { ok: true; scope: UserSearchScope; type: UserSearchType; term: string }
  | { ok: false; error: string };

/** Validates API query params. Missing scope/type default to "all". */
export function parseUserSearchParams(params: {
  q: string | null;
  scope: string | null;
  type: string | null;
}): ParsedUserSearch {
  const scope = params.scope ?? "all";
  const type = params.type ?? "all";
  if (!isUserSearchScope(scope)) {
    return { ok: false, error: "Invalid search scope" };
  }
  if (!isUserSearchType(type)) {
    return { ok: false, error: "Invalid user type" };
  }
  const term = normalizeSearchTerm(scope, params.q ?? "");
  const min = minQueryLength(scope);
  if (term.length < min) {
    return {
      ok: false,
      error: `Search query must be at least ${min} characters`,
    };
  }
  if (scope === "id" && !/^[0-9a-f-]+$/.test(term)) {
    return { ok: false, error: "User ID can only contain 0-9, a-f and dashes" };
  }
  return { ok: true, scope, type, term };
}

const SECRET_KEY = /token|secret|password|code_verifier|api_key|cookie/i;

/**
 * Deep-copies a value with secret-looking keys replaced by "[hidden]".
 * Social account JSON on creator_profiles stores OAuth access/refresh tokens,
 * which must never reach the browser.
 */
export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? "[hidden]" : redactSecrets(v);
    }
    return out as T;
  }
  return value;
}
