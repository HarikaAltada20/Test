import { formatCurrencyFromCents } from "@/lib/currency-utils";
import type { RecipientUserRow } from "./types";

const PLACEHOLDER_RE = /\{([a-z_]+)\}/g;

export type ContestTemplateContext = {
  id: string;
  title: string;
};

export type CampaignTemplateContext = {
  name: string;
};

export type ResolveTemplateOptions = {
  contest?: ContestTemplateContext | null;
  campaign?: CampaignTemplateContext | null;
  spinSeed?: string;
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

function isSimplePlaceholder(inner: string): boolean {
  return /^[a-z_]+$/.test(inner.trim());
}

function findMatchingBrace(text: string, openIndex: number): number {
  if (text[openIndex] !== "{") return -1;
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split spin options on `|` at brace depth 0 (supports `{first_name}` inside options). */
function splitSpinOptions(inner: string): string[] {
  const options: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === "{") {
      depth += 1;
      current += ch;
    } else if (ch === "}") {
      depth -= 1;
      current += ch;
    } else if (ch === "|" && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) options.push(trimmed);
      current = "";
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) options.push(trimmed);
  return options;
}

/** Resolve `{option A|option B|option C}` spin syntax (one option per recipient). */
export function resolveSpinSyntax(template: string, seed: string): string {
  let result = "";
  let i = 0;
  while (i < template.length) {
    if (template[i] === "{") {
      const close = findMatchingBrace(template, i);
      if (close === -1) {
        result += template[i];
        i += 1;
        continue;
      }

      const inner = template.slice(i + 1, close);
      if (inner.includes("|") && !isSimplePlaceholder(inner)) {
        const options = splitSpinOptions(inner);
        if (options.length >= 2) {
          result += pickSpinOption(options, `${seed}:${inner}`);
          i = close + 1;
          continue;
        }
      }

      result += template.slice(i, close + 1);
      i = close + 1;
      continue;
    }

    result += template[i];
    i += 1;
  }
  return result;
}

function formatCoins(coins: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(Number(coins ?? 0));
}

function buildEarningsTemplateVars(user: RecipientUserRow): Record<string, string> {
  const contestCashCents = user.total_money_won ?? 0;
  const affiliateEarningsCents = user.affiliate_earnings ?? 0;
  const otherEarningsCents = user.other_earnings ?? 0;
  const totalCashEarnedCents =
    contestCashCents + affiliateEarningsCents + otherEarningsCents;

  return {
    coins: formatCoins(user.coins),
    total_lifetime_coins_earned: formatCoins(user.total_lifetime_coins_earned),
    total_cash_earned: formatCurrencyFromCents(totalCashEarnedCents),
    total_money_won: formatCurrencyFromCents(contestCashCents),
    affiliate_earnings: formatCurrencyFromCents(affiliateEarningsCents),
    other_earnings: formatCurrencyFromCents(otherEarningsCents),
    withdrawable_balance: formatCurrencyFromCents(user.withdrawable_balance),
    total_contests_won: String(user.total_contests_won ?? 0),
    total_contests_participated: String(user.total_contests_participated ?? 0),
    total_money_spent: formatCurrencyFromCents(user.total_money_spent),
    total_contests_run: String(user.total_contests_run ?? 0),
    available_deposit_balance: formatCurrencyFromCents(
      user.available_deposit_balance,
    ),
    advertisers_referred: String(user.advertisers_referred ?? 0),
    creators_referred: String(user.creators_referred ?? 0),
  };
}

export function resolveNotificationTemplate(
  template: string,
  user: RecipientUserRow,
  _timezone: "UTC" | "local" = "UTC",
  options?: ResolveTemplateOptions | ContestTemplateContext | null,
): string {
  const resolvedOptions: ResolveTemplateOptions =
    options && "title" in options
      ? { contest: options }
      : (options ?? {});

  const seed = resolvedOptions.spinSeed ?? user.id;
  let result = resolveSpinSyntax(template, seed);

  const { first_name, last_name } = parseNameParts(user.full_name);
  const vars: Record<string, string> = {
    email: user.email ?? "",
    full_name: user.full_name?.trim() ?? "",
    first_name: first_name || user.username || "there",
    last_name,
    username: user.username ?? "",
    user_type: user.user_type ?? "",
    ...buildEarningsTemplateVars(user),
  };

  if (resolvedOptions.contest) {
    vars.contest_title = resolvedOptions.contest.title;
  }

  if (resolvedOptions.campaign?.name) {
    vars.campaign_name = resolvedOptions.campaign.name.trim();
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

export const CAMPAIGN_TEMPLATE_VARIABLES = [
  { key: "campaign_name", label: "Campaign name" },
] as const;

export const COINS_TEMPLATE_VARIABLES = [
  { key: "coins", label: "Coins available" },
  { key: "total_lifetime_coins_earned", label: "Total coins earned" },
] as const;

export const CASH_EARNINGS_TEMPLATE_VARIABLES = [
  { key: "total_cash_earned", label: "Total cash earned" },
  { key: "total_money_won", label: "Contest winnings" },
  { key: "affiliate_earnings", label: "Affiliate earnings" },
  { key: "other_earnings", label: "Other earnings" },
  { key: "withdrawable_balance", label: "Withdrawable balance" },
  { key: "total_contests_won", label: "Cash campaigns won" },
  { key: "total_contests_participated", label: "Contests participated" },
] as const;

export const ADVERTISER_EARNINGS_TEMPLATE_VARIABLES = [
  { key: "total_money_spent", label: "Total money spent" },
  { key: "total_contests_run", label: "Total contests run" },
  { key: "available_deposit_balance", label: "Available deposit balance" },
] as const;

export const REFERRAL_TEMPLATE_VARIABLES = [
  { key: "advertisers_referred", label: "Advertisers referred" },
  { key: "creators_referred", label: "Creators referred" },
] as const;

/** All merge tags supported when sending admin bulk / campaign emails. */
export const BULK_EMAIL_MERGE_VARIABLES = [
  ...TEMPLATE_VARIABLES,
  ...CAMPAIGN_TEMPLATE_VARIABLES,
  ...COINS_TEMPLATE_VARIABLES,
  ...CASH_EARNINGS_TEMPLATE_VARIABLES,
  ...ADVERTISER_EARNINGS_TEMPLATE_VARIABLES,
  ...REFERRAL_TEMPLATE_VARIABLES,
] as const;

export function mergeTag(key: string): string {
  return `{${key}}`;
}

const BULK_EMAIL_MERGE_VARIABLE_KEYS = new Set<string>(
  BULK_EMAIL_MERGE_VARIABLES.map((v) => v.key),
);

export function filterAllowedMergeVariables(keys: string[]): string[] {
  const seen = new Set<string>();
  const allowed: string[] = [];
  for (const key of keys) {
    if (!BULK_EMAIL_MERGE_VARIABLE_KEYS.has(key) || seen.has(key)) continue;
    seen.add(key);
    allowed.push(key);
  }
  return allowed;
}

export function getMergeVariableLabel(key: string): string {
  return (
    BULK_EMAIL_MERGE_VARIABLES.find((v) => v.key === key)?.label ?? key
  );
}

export function findMissingMergeVariables(
  subject: string,
  body: string,
  variables: string[],
): string[] {
  const combined = `${subject}\n${body}`;
  return variables.filter((key) => !combined.includes(mergeTag(key)));
}

export const BULK_EMAIL_MERGE_TAG_DEFAULTS = [
  "first_name",
  "full_name",
  "username",
  "campaign_name",
] as const;
