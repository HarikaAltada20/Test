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

export const SKYDO_STATUS_BADGE_CLASSES: Record<SkydoStatus, string> = {
  email_pending:
    "border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
  email_sent:
    "border-blue-400 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-200",
  verified:
    "border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
};

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
