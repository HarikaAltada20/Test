import type { RecipientUserRow } from "./types";

const PLACEHOLDER_RE = /\{([a-z_]+)\}/g;

export function resolveNotificationTemplate(
  template: string,
  user: RecipientUserRow,
  timezone: "UTC" | "local" = "UTC",
): string {
  const vars: Record<string, string> = {
    user_id: user.id,
    email: user.email ?? "",
    full_name: user.full_name ?? "",
    username: user.username ?? "",
    user_type: user.user_type ?? "",
    coins: String(user.coins ?? 0),
    referral_code: user.referral_code ?? "",
    created_at: formatUserCreatedAt(user.created_at, timezone),
  };

  return template.replace(PLACEHOLDER_RE, (match, key: string) => {
    if (key in vars) return vars[key];
    return match;
  });
}

function formatUserCreatedAt(
  createdAt: string,
  timezone: "UTC" | "local",
): string {
  try {
    const d = new Date(createdAt);
    if (timezone === "UTC") {
      return d.toISOString();
    }
    return d.toLocaleString("en-US", { hour12: false });
  } catch {
    return createdAt;
  }
}

export const TEMPLATE_VARIABLES = [
  { key: "full_name", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "username", label: "Username" },
  { key: "user_type", label: "User type" },
  { key: "coins", label: "Coins" },
  { key: "referral_code", label: "Referral code" },
  { key: "user_id", label: "User ID" },
  { key: "created_at", label: "Created at" },
] as const;
