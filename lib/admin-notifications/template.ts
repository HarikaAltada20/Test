import type { RecipientUserRow } from "./types";

const PLACEHOLDER_RE = /\{([a-z_]+)\}/g;
const SPIN_RE = /\{([^{}|]+(?:\|[^{}|]+)+)\}/g;

export type ContestTemplateContext = {
  id: string;
  title: string;
};

/** Dashboard path for a contest notification deep link. */
export function getContestDashboardPath(
  contestId: string,
  userType: string,
): string {
  if (userType === "advertiser") {
    return `/dashboard/contests/${contestId}`;
  }
  if (userType === "admin") {
    return `/dashboard/admin/contests/${contestId}`;
  }
  return `/dashboard/opportunities/${contestId}`;
}

function parseNameParts(fullName: string | null | undefined): {
  first_name: string;
  last_name: string;
} {
  const trimmed = fullName?.trim() ?? "";
  if (!trimmed) return { first_name: "", last_name: "" };
  const parts = trimmed.split(/\s+/);
  return {
    first_name: parts[0] ?? "",
    last_name: parts.slice(1).join(" "),
  };
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickSpinOption(options: string[], seed: string): string {
  if (options.length === 0) return "";
  const index = hashSeed(seed) % options.length;
  return options[index] ?? options[0] ?? "";
}

/** Resolve `{option A|option B|option C}` spin syntax (one option per recipient). */
export function resolveSpinSyntax(template: string, seed: string): string {
  return template.replace(SPIN_RE, (match, inner: string) => {
    const options = inner
      .split("|")
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (options.length < 2) return match;
    return pickSpinOption(options, `${seed}:${inner}`);
  });
}

export function resolveNotificationTemplate(
  template: string,
  user: RecipientUserRow,
  _timezone: "UTC" | "local" = "UTC",
  contest?: ContestTemplateContext | null,
  spinSeed?: string,
): string {
  const seed = spinSeed ?? user.id;
  let result = resolveSpinSyntax(template, seed);

  const { first_name, last_name } = parseNameParts(user.full_name);
  const vars: Record<string, string> = {
    email: user.email ?? "",
    full_name: user.full_name?.trim() ?? "",
    first_name: first_name || user.username || "there",
    last_name,
    username: user.username ?? "",
    user_type: user.user_type ?? "",
  };

  if (contest) {
    vars.contest_title = contest.title;
  }

  result = result.replace(PLACEHOLDER_RE, (match, key: string) => {
    if (key in vars) return vars[key];
    return match;
  });

  return result;
}

export const TEMPLATE_VARIABLES = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "full_name", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "username", label: "Username" },
  { key: "user_type", label: "User type" },
] as const;

export const CONTEST_TEMPLATE_VARIABLES = [
  { key: "contest_title", label: "Contest title" },
] as const;
