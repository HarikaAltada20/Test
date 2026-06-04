import type { RecipientUserRow } from "./types";

const PLACEHOLDER_RE = /\{([a-z_]+)\}/g;

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

export function resolveNotificationTemplate(
  template: string,
  user: RecipientUserRow,
  _timezone: "UTC" | "local" = "UTC",
  contest?: ContestTemplateContext | null,
): string {
  const vars: Record<string, string> = {
    email: user.email ?? "",
    full_name: user.full_name ?? "",
    username: user.username ?? "",
    user_type: user.user_type ?? "",
  };

  if (contest) {
    vars.contest_title = contest.title;
  }

  return template.replace(PLACEHOLDER_RE, (match, key: string) => {
    if (key in vars) return vars[key];
    return match;
  });
}

export const TEMPLATE_VARIABLES = [
  { key: "full_name", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "username", label: "Username" },
  { key: "user_type", label: "User type" },
] as const;

export const CONTEST_TEMPLATE_VARIABLES = [
  { key: "contest_title", label: "Contest title" },
] as const;
