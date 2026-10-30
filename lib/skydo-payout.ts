import type { PayoutMethod, SkydoStatus } from "@/types/earnings";

/** Must match the 500-cent check in enforce_skydo_payout_rules (SUPABASE migration). */
export const SKYDO_MIN_BALANCE_CENTS = 500;

export const SKYDO_FRIENDLY_NAME = "Skydo";

export const SKYDO_STATUSES: SkydoStatus[] = [
  "email_pending",
  "email_sent",
  "verified",
];

export const SKYDO_STATUS_LABELS: Record<SkydoStatus, string> = {
  email_pending: "Email pending",
  email_sent: "Email sent",
  verified: "Payout method verified",
};

export const SKYDO_STATUS_DESCRIPTIONS: Record<SkydoStatus, string> = {
  email_pending: "Skydo will email you within 24 hours.",
  email_sent: "Check your inbox and finish KYC with PAN or Aadhaar.",
  verified: "Ready for withdrawals.",
};

/** Prefer `getSkydoStatusBadgeClasses(status, isDark)` — dashboard dark mode is
 * driven by `data-mode` / `isDark`, so relying only on Tailwind `dark:` here
 * can leave light mint backgrounds with washed-out text. */
export const SKYDO_STATUS_BADGE_CLASSES: Record<SkydoStatus, string> = {
  email_pending:
    "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200",
  email_sent:
    "border-blue-500/40 bg-blue-500/15 text-blue-800 dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-200",
  verified:
    "border-emerald-600/40 bg-emerald-600 text-white dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-200",
};

export function getSkydoStatusBadgeClasses(
  status: SkydoStatus,
  isDark: boolean
): string {
  const classes: Record<SkydoStatus, { light: string; dark: string }> = {
    email_pending: {
      light: "border-amber-400 bg-amber-100 text-amber-900",
      dark: "border-amber-400/40 bg-amber-500/15 text-amber-200",
    },
    email_sent: {
      light: "border-blue-400 bg-blue-100 text-blue-900",
      dark: "border-blue-400/40 bg-blue-500/15 text-blue-200",
    },
    verified: {
      // Solid fill + white text stays readable even if theme class lags.
      light: "border-emerald-700 bg-emerald-700 text-white",
      dark: "border-emerald-400/50 bg-emerald-500/20 text-emerald-200",
    },
  };
  return isDark ? classes[status].dark : classes[status].light;
}

export function isSkydoStatus(value: unknown): value is SkydoStatus {
  return (
    typeof value === "string" &&
    (SKYDO_STATUSES as string[]).includes(value)
  );
}

export function getSkydoStatus(method: Pick<PayoutMethod, "skydo_status">): SkydoStatus {
  return isSkydoStatus(method.skydo_status) ? method.skydo_status : "email_pending";
}

/** Non-Skydo methods are always usable; Skydo only once verified. */
export function isSkydoUsable(
  method: Pick<PayoutMethod, "method_type" | "skydo_status">
): boolean {
  return method.method_type !== "skydo" || method.skydo_status === "verified";
}

/** Owners may remove Skydo only until Skydo emails them (mirrors enforce_skydo_payout_rules). */
export function canRemoveSkydo(
  method: Pick<PayoutMethod, "method_type" | "skydo_status">
): boolean {
  return method.method_type === "skydo" && getSkydoStatus(method) === "email_pending";
}

export function normalizeSkydoEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidSkydoEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeSkydoEmail(value));
}
