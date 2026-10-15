import type { SupabaseClient } from "@supabase/supabase-js";
import { isSkydoStatus } from "@/lib/skydo-payout";
import type { SkydoStatus } from "@/types/earnings";

export const ADMIN_PAYOUT_METHOD_TYPES = ["skydo", "upi", "bank_transfer", "crypto", "phantom"] as const;

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
  "skydo_email",
  "email_account_count",
  "next_action",
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
  /** Skydo rows not yet verified whose email is verified on another account. */
  knownEmail?: boolean;
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
  skydo_email: string | null;
  /** How many accounts use this Skydo email (this one included). */
  email_account_count: number;
  email_verified_peer_count: number;
  /** Other accounts where this Skydo email is already verified. */
  email_verified_peers: AdminPayoutEmailPeer[];
  /** Not verified here, but the email is verified on another account. */
  known_verified: boolean;
  skydo_verified_via: "manual" | "known_email" | null;
}

export interface AdminPayoutEmailPeer {
  id: string;
  user_id: string;
  name: string | null;
  username: string | null;
}

export interface AdminPayoutEmailGroup {
  email: string;
  account_count: number;
  names: string[];
  member_ids: string[];
  pending_count: number;
  sent_count: number;
  verified_count: number;
  known_count: number;
  total_balance: number;
  oldest_waiting_since: string | null;
  latest_added_at: string | null;
  members: AdminPayoutMethodRow[];
}

export interface AdminPayoutAccountWithEmail {
  id: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  skydo_status: SkydoStatus | null;
  skydo_status_updated_at: string | null;
  created_at: string;
}

export interface AdminPayoutMethodsSummary {
  total: number;
  by_method_type: Record<string, number>;
  by_skydo_status: Record<string, number>;
  skydo_overdue: number;
  /** Pending or email-sent rows whose email is verified on another account. */
  skydo_known_verified: number;
  /** The email_pending share of skydo_known_verified. */
  skydo_known_pending: number;
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
  /** Other accounts using the same Skydo email (Skydo methods only). */
  sameEmailAccounts: AdminPayoutAccountWithEmail[];
}

const BASE_SELECT =
  "id, user_id, method_type, details, friendly_name, is_default, created_at, updated_at, skydo_status, skydo_status_updated_at, skydo_status_updated_by, admin_notes, full_name, email, username, user_type, is_active, user_created_at, country, withdrawable_balance, withdrawal_count, last_withdrawal_at";

const V2_SELECT = `${BASE_SELECT}, status_updated_by_name, stage_since`;

export const ADMIN_PAYOUT_SELECT = `${V2_SELECT}, skydo_email, email_account_count, email_verified_peer_count, email_verified_peers, known_verified, skydo_verified_via`;

/** View generation the select targets: v3 (known-email columns), v2, or legacy. */
export type AdminPayoutViewTier = "v3" | "v2" | "legacy";

export const ADMIN_PAYOUT_SELECT_BY_TIER: Record<AdminPayoutViewTier, string> = {
  v3: ADMIN_PAYOUT_SELECT,
  v2: V2_SELECT,
  legacy: BASE_SELECT,
};

/** Select used when the v2 view migration has not been applied yet. */
export const ADMIN_PAYOUT_SELECT_LEGACY = BASE_SELECT;

/** Postgres "undefined column" (or a missing function) — a newer migration is not applied yet. */
export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    /column .* does not exist/i.test(error.message ?? "") ||
    /could not find the function/i.test(error.message ?? "")
  );
}

/** Fills v2-only fields when rows come from the legacy view. */
export function normalizeAdminPayoutRow(row: Record<string, unknown>): AdminPayoutMethodRow {
  const r = row as unknown as AdminPayoutMethodRow;
  return {
    ...r,
    status_updated_by_name: r.status_updated_by_name ?? null,
    stage_since: r.stage_since ?? r.skydo_status_updated_at ?? r.created_at,
    skydo_email:
      r.skydo_email ??
      (r.method_type === "skydo"
        ? String((r.details as Record<string, unknown> | null)?.email ?? "").toLowerCase() || null
        : null),
    email_account_count: r.email_account_count ?? 0,
    email_verified_peer_count: r.email_verified_peer_count ?? 0,
    email_verified_peers: Array.isArray(r.email_verified_peers) ? r.email_verified_peers : [],
    known_verified: r.known_verified === true,
    skydo_verified_via: r.skydo_verified_via ?? null,
  };
}

export function parseAdminPayoutFilters(searchParams: URLSearchParams): AdminPayoutMethodFilters {
  const sortParam = searchParams.get("sort");
  const sort = (ADMIN_PAYOUT_SORT_KEYS as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as AdminPayoutSortKey)
    : "created_at";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  const methodType = searchParams.get("methodType") || undefined;
  const skydoStatusParam = searchParams.get("skydoStatus");
  const userTypeParam = searchParams.get("userType");
  const isDefaultParam = searchParams.get("isDefault");
  const addedWithinParam = searchParams.get("addedWithin");
  const overdue = searchParams.get("overdue") === "1";
  const knownEmail = searchParams.get("knownEmail") === "1";

  return {
    search: searchParams.get("search")?.trim() || undefined,
    methodType:
      methodType && (ADMIN_PAYOUT_METHOD_TYPES as readonly string[]).includes(methodType) ? methodType : undefined,
    skydoStatus: overdue
      ? "email_pending"
      : knownEmail
        ? undefined
        : isSkydoStatus(skydoStatusParam)
          ? skydoStatusParam
          : undefined,
    overdue,
    knownEmail,
    userType:
      userTypeParam === "creator" || userTypeParam === "advertiser" || userTypeParam === "admin"
        ? userTypeParam
        : undefined,
    isDefault: isDefaultParam === "true" ? true : isDefaultParam === "false" ? false : undefined,
    createdFrom: searchParams.get("createdFrom") || undefined,
    createdTo: searchParams.get("createdTo") || undefined,
    addedWithin:
      addedWithinParam === "24h" || addedWithinParam === "7d" || addedWithinParam === "30d"
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
  options: {
    count?: boolean;
    select?: string;
    tier?: AdminPayoutViewTier;
  } = {}
) {
  const tier = options.tier ?? "v3";
  const legacy = tier === "legacy";
  let query = supabase
    .from("admin_payout_methods_view")
    .select(options.select ?? ADMIN_PAYOUT_SELECT_BY_TIER[tier], options.count ? { count: "exact" } : undefined);

  if (filters.search) {
    query = query.ilike("search_text", `%${escapeLike(filters.search.toLowerCase())}%`);
  }
  if (filters.methodType) query = query.eq("method_type", filters.methodType);
  if (filters.skydoStatus) {
    query = query.eq("method_type", "skydo").eq("skydo_status", filters.skydoStatus);
  }
  if (filters.overdue) {
    const cutoff = new Date(Date.now() - SKYDO_OVERDUE_MS).toISOString();
    query = legacy ? query.lt("created_at", cutoff) : query.lt("stage_since", cutoff);
    // Rows that only need the one-click verify aren't waiting on a Skydo email.
    if (tier === "v3") query = query.eq("known_verified", false);
  }
  if (filters.knownEmail) {
    query =
      tier === "v3"
        ? query.eq("method_type", "skydo").eq("known_verified", true)
        : // Before the v3 migration nothing can be known-verified.
          query.eq("method_type", "skydo").is("id", null);
  }
  if (filters.userType) query = query.eq("user_type", filters.userType);
  if (filters.isDefault !== undefined) {
    query = filters.isDefault ? query.eq("is_default", true) : query.or("is_default.is.null,is_default.eq.false");
  }
  if (filters.createdFrom) query = query.gte("created_at", filters.createdFrom);
  if (filters.createdTo) {
    const to = /^\d{4}-\d{2}-\d{2}$/.test(filters.createdTo) ? `${filters.createdTo}T23:59:59.999Z` : filters.createdTo;
    query = query.lte("created_at", to);
  }
  if (filters.addedWithin) {
    const since = new Date(Date.now() - ADDED_WITHIN_MS[filters.addedWithin]);
    query = query.gte("created_at", since.toISOString());
  }

  const sortColumn = resolveSortColumn(filters.sort, tier);
  query = query.order(sortColumn, {
    ascending: filters.order === "asc",
    nullsFirst: false,
  });
  if (sortColumn === "next_action_rank") {
    // Within the same next step, whoever has waited longest comes first.
    query = query.order("stage_since", { ascending: true });
  } else if (sortColumn !== "created_at") {
    query = query.order("created_at", { ascending: false });
  }
  return query;
}

interface EmailGroupRpcRow extends Omit<AdminPayoutEmailGroup, "members"> {
  min_next_action_rank: number;
  total_groups: number;
  total_methods: number;
}

/**
 * One page of Skydo methods grouped by email. A group is included when any member
 * matches the filters, and always carries every member row.
 * Returns `missing: true` when the v3 migration hasn't been applied.
 */
export async function fetchAdminPayoutEmailGroups(
  supabase: SupabaseClient,
  filters: AdminPayoutMethodFilters,
  page: number,
  pageSize: number
): Promise<
  | { missing: true }
  | {
      missing?: false;
      error?: string;
      groups: AdminPayoutEmailGroup[];
      totalGroups: number;
      totalMethods: number;
    }
> {
  let createdFrom = filters.createdFrom ?? null;
  if (filters.addedWithin) {
    const since = new Date(Date.now() - ADDED_WITHIN_MS[filters.addedWithin]).toISOString();
    if (!createdFrom || since > createdFrom) createdFrom = since;
  }
  const createdTo = filters.createdTo
    ? /^\d{4}-\d{2}-\d{2}$/.test(filters.createdTo)
      ? `${filters.createdTo}T23:59:59.999Z`
      : filters.createdTo
    : null;

  const { data, error } = await supabase.rpc("admin_payout_method_email_groups", {
    p_search: filters.search ?? null,
    p_skydo_status: filters.overdue || filters.knownEmail ? null : (filters.skydoStatus ?? null),
    p_known: filters.knownEmail ?? false,
    p_overdue: filters.overdue ?? false,
    p_user_type: filters.userType ?? null,
    p_is_default: filters.isDefault ?? null,
    p_created_from: createdFrom,
    p_created_to: createdTo,
    p_sort: filters.sort,
    p_order: filters.order,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (isMissingColumnError(error)) return { missing: true };
  if (error)
    return {
      error: error.message,
      groups: [],
      totalGroups: 0,
      totalMethods: 0,
    };

  const rows = (data ?? []) as EmailGroupRpcRow[];
  const ids = rows.flatMap((g) => g.member_ids);
  let members: AdminPayoutMethodRow[] = [];
  if (ids.length > 0) {
    const res = await supabase.from("admin_payout_methods_view").select(ADMIN_PAYOUT_SELECT).in("id", ids);
    if (res.error)
      return {
        error: res.error.message,
        groups: [],
        totalGroups: 0,
        totalMethods: 0,
      };
    members = ((res.data ?? []) as unknown as Record<string, unknown>[]).map(normalizeAdminPayoutRow);
  }
  const byId = new Map(members.map((m) => [m.id, m]));

  return {
    groups: rows.map((g) => ({
      email: g.email,
      account_count: g.account_count,
      names: g.names ?? [],
      member_ids: g.member_ids ?? [],
      pending_count: g.pending_count,
      sent_count: g.sent_count,
      verified_count: g.verified_count,
      known_count: g.known_count,
      total_balance: Number(g.total_balance ?? 0),
      oldest_waiting_since: g.oldest_waiting_since,
      latest_added_at: g.latest_added_at,
      members: (g.member_ids ?? []).map((id) => byId.get(id)).filter((m): m is AdminPayoutMethodRow => Boolean(m)),
    })),
    totalGroups: Number(rows[0]?.total_groups ?? 0),
    totalMethods: Number(rows[0]?.total_methods ?? 0),
  };
}

const V3_SORT_KEYS: AdminPayoutSortKey[] = ["skydo_email", "email_account_count", "next_action"];

/** Maps a sort key to a view column, falling back when an older view lacks it. */
function resolveSortColumn(sort: AdminPayoutSortKey, tier: AdminPayoutViewTier): string {
  if (tier !== "v3" && V3_SORT_KEYS.includes(sort)) {
    return sort === "next_action" ? "skydo_status" : "created_at";
  }
  if (tier === "legacy" && sort === "stage_since") return "created_at";
  if (sort === "next_action") return "next_action_rank";
  return sort;
}

/**
 * Runs a filtered view query, retrying against older view generations when a
 * migration hasn't been applied yet (v3 → v2 → legacy).
 */
export async function runAdminPayoutQuery(
  supabase: SupabaseClient,
  filters: AdminPayoutMethodFilters,
  from: number,
  to: number,
  options: {
    count?: boolean;
    select?: string;
    selectByTier?: Partial<Record<AdminPayoutViewTier, string>>;
  } = {}
) {
  const run = (tier: AdminPayoutViewTier) =>
    buildAdminPayoutQuery(supabase, filters, {
      count: options.count,
      select: options.selectByTier?.[tier] ?? options.select,
      tier,
    }).range(from, to);
  const v3 = await run("v3");
  if (!isMissingColumnError(v3.error)) return { ...v3, tier: "v3" as AdminPayoutViewTier };
  const v2 = await run("v2");
  if (!isMissingColumnError(v2.error)) return { ...v2, tier: "v2" as AdminPayoutViewTier };
  return { ...(await run("legacy")), tier: "legacy" as AdminPayoutViewTier };
}

/**
 * Runs a payout_methods update that sets skydo_verified_via, retrying without it
 * when the column doesn't exist yet (v3 migration not applied).
 */
export async function updateWithVerifiedVia<T>(
  updates: Record<string, string | null>,
  run: (updates: Record<string, string | null>) => PromiseLike<{
    data: T;
    error: { code?: string; message?: string } | null;
  }>
) {
  const first = await run(updates);
  if (!("skydo_verified_via" in updates) || !isMissingColumnError(first.error)) return first;
  const rest = { ...updates };
  delete rest.skydo_verified_via;
  return run(rest);
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
