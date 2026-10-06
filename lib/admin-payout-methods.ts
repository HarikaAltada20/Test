import type { SupabaseClient } from "@supabase/supabase-js";
import { isSkydoStatus } from "@/lib/skydo-payout";
import type { SkydoStatus } from "@/types/earnings";

export const ADMIN_PAYOUT_METHOD_TYPES = [
  "skydo",
  "upi",
  "bank_transfer",
  "crypto",
  "phantom",
] as const;

export const ADMIN_PAYOUT_SORT_KEYS = [
  "created_at",
  "updated_at",
  "full_name",
  "email",
  "method_type",
  "skydo_status",
  "skydo_status_updated_at",
  "stage_since",
  "withdrawable_balance",
  "withdrawal_count",
] as const;

export type AdminPayoutSortKey = (typeof ADMIN_PAYOUT_SORT_KEYS)[number];

export type AddedWithin = "24h" | "7d" | "30d";

/** A Skydo row in email_pending for longer than this is overdue (we promise an email within 24h). */
export const SKYDO_OVERDUE_MS = 24 * 60 * 60 * 1000;

export interface AdminPayoutMethodFilters {
  search?: string;
  methodType?: string;
  skydoStatus?: SkydoStatus;
  overdue?: boolean;
  userType?: "creator" | "advertiser" | "admin";
  isDefault?: boolean;
  createdFrom?: string;
  createdTo?: string;
  addedWithin?: AddedWithin;
  sort: AdminPayoutSortKey;
  order: "asc" | "desc";
}

export interface AdminPayoutMethodRow {
  id: string;
  user_id: string;
  method_type: string;
  details: Record<string, unknown> | null;
  friendly_name: string | null;
  is_default: boolean | null;
  created_at: string;
  updated_at: string | null;
  skydo_status: SkydoStatus | null;
  skydo_status_updated_at: string | null;
  skydo_status_updated_by: string | null;
  admin_notes: string | null;
  full_name: string | null;
  email: string | null;
  username: string | null;
  user_type: string | null;
  is_active: boolean | null;
  user_created_at: string | null;
  country: string | null;
  withdrawable_balance: number | null;
  withdrawal_count: number | null;
  last_withdrawal_at: string | null;
  status_updated_by_name: string | null;
  stage_since: string | null;
}

export interface AdminPayoutMethodsSummary {
  total: number;
  by_method_type: Record<string, number>;
  by_skydo_status: Record<string, number>;
  skydo_overdue: number;
  added_last_24h: number;
  added_last_7d: number;
}

export interface AdminPayoutWithdrawalSummary {
  id: string;
  amount: number;
  currency: string | null;
  amount_type: string | null;
  status: string;
  created_at: string;
  processed_at: string | null;
}

export interface AdminPayoutMethodDetailResponse {
  method: AdminPayoutMethodRow;
  otherMethods: Pick<
    AdminPayoutMethodRow,
    "id" | "method_type" | "details" | "friendly_name" | "is_default" | "skydo_status" | "created_at"
  >[];
  recentWithdrawals: AdminPayoutWithdrawalSummary[];
}

const BASE_SELECT =
  "id, user_id, method_type, details, friendly_name, is_default, created_at, updated_at, skydo_status, skydo_status_updated_at, skydo_status_updated_by, admin_notes, full_name, email, username, user_type, is_active, user_created_at, country, withdrawable_balance, withdrawal_count, last_withdrawal_at";

export const ADMIN_PAYOUT_SELECT = `${BASE_SELECT}, status_updated_by_name, stage_since`;

/** Select used when the v2 view migration has not been applied yet. */
export const ADMIN_PAYOUT_SELECT_LEGACY = BASE_SELECT;

/** Postgres "undefined column" — the v2 view columns are missing. */
export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || /column .* does not exist/i.test(error.message ?? "");
}

/** Fills v2-only fields when rows come from the legacy view. */
export function normalizeAdminPayoutRow(row: Record<string, unknown>): AdminPayoutMethodRow {
  const r = row as unknown as AdminPayoutMethodRow;
  return {
    ...r,
    status_updated_by_name: r.status_updated_by_name ?? null,
    stage_since: r.stage_since ?? r.skydo_status_updated_at ?? r.created_at,
  };
}

export function parseAdminPayoutFilters(
  searchParams: URLSearchParams
): AdminPayoutMethodFilters {
  const sortParam = searchParams.get("sort");
  const sort = (ADMIN_PAYOUT_SORT_KEYS as readonly string[]).includes(
    sortParam ?? ""
  )
    ? (sortParam as AdminPayoutSortKey)
    : "created_at";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  const methodType = searchParams.get("methodType") || undefined;
  const skydoStatusParam = searchParams.get("skydoStatus");
  const userTypeParam = searchParams.get("userType");
  const isDefaultParam = searchParams.get("isDefault");
  const addedWithinParam = searchParams.get("addedWithin");
  const overdue = searchParams.get("overdue") === "1";

  return {
    search: searchParams.get("search")?.trim() || undefined,
    methodType:
      methodType &&
      (ADMIN_PAYOUT_METHOD_TYPES as readonly string[]).includes(methodType)
        ? methodType
        : undefined,
    skydoStatus: overdue
      ? "email_pending"
      : isSkydoStatus(skydoStatusParam)
        ? skydoStatusParam
        : undefined,
    overdue,
    userType:
      userTypeParam === "creator" ||
      userTypeParam === "advertiser" ||
      userTypeParam === "admin"
        ? userTypeParam
        : undefined,
    isDefault:
      isDefaultParam === "true" ? true : isDefaultParam === "false" ? false : undefined,
    createdFrom: searchParams.get("createdFrom") || undefined,
    createdTo: searchParams.get("createdTo") || undefined,
    addedWithin:
      addedWithinParam === "24h" ||
      addedWithinParam === "7d" ||
      addedWithinParam === "30d"
        ? addedWithinParam
        : undefined,
    sort,
    order,
  };
}

const ADDED_WITHIN_MS: Record<AddedWithin, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Returns a filtered, sorted query on admin_payout_methods_view (no range applied). */
export function buildAdminPayoutQuery(
  supabase: SupabaseClient,
  filters: AdminPayoutMethodFilters,
  options: { count?: boolean; select?: string; legacy?: boolean } = {}
) {
  const legacy = options.legacy ?? false;
  let query = supabase
    .from("admin_payout_methods_view")
    .select(
      options.select ?? (legacy ? ADMIN_PAYOUT_SELECT_LEGACY : ADMIN_PAYOUT_SELECT),
      options.count ? { count: "exact" } : undefined
    );

  if (filters.search) {
    query = query.ilike(
      "search_text",
      `%${escapeLike(filters.search.toLowerCase())}%`
    );
  }
  if (filters.methodType) query = query.eq("method_type", filters.methodType);
  if (filters.skydoStatus) {
    query = query.eq("method_type", "skydo").eq("skydo_status", filters.skydoStatus);
  }
  if (filters.overdue) {
    const cutoff = new Date(Date.now() - SKYDO_OVERDUE_MS).toISOString();
    query = legacy
      ? query.lt("created_at", cutoff)
      : query.lt("stage_since", cutoff);
  }
  if (filters.userType) query = query.eq("user_type", filters.userType);
  if (filters.isDefault !== undefined) {
    query = filters.isDefault
      ? query.eq("is_default", true)
      : query.or("is_default.is.null,is_default.eq.false");
  }
  if (filters.createdFrom) query = query.gte("created_at", filters.createdFrom);
  if (filters.createdTo) {
    const to = /^\d{4}-\d{2}-\d{2}$/.test(filters.createdTo)
      ? `${filters.createdTo}T23:59:59.999Z`
      : filters.createdTo;
    query = query.lte("created_at", to);
  }
  if (filters.addedWithin) {
    const since = new Date(Date.now() - ADDED_WITHIN_MS[filters.addedWithin]);
    query = query.gte("created_at", since.toISOString());
  }

  const sortColumn =
    legacy && filters.sort === "stage_since" ? "created_at" : filters.sort;
  query = query.order(sortColumn, {
    ascending: filters.order === "asc",
    nullsFirst: false,
  });
  if (sortColumn !== "created_at") {
    query = query.order("created_at", { ascending: false });
  }
  return query;
}

/** Full payout identifier, used for display, copy and CSV. */
export function getPayoutIdentifier(
  methodType: string,
  details: Record<string, unknown> | null | undefined,
  options: { maskBank?: boolean } = {}
): string {
  const d = details ?? {};
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  switch (methodType) {
    case "skydo":
      return s(d.email);
    case "upi":
      return s(d.upi_id);
    case "crypto":
    case "phantom":
      return s(d.wallet_address);
    case "bank_transfer": {
      const acct = s(d.account_number);
      return options.maskBank === false ? acct : acct ? `****${acct.slice(-4)}` : "";
    }
    default:
      return "";
  }
}
