import type { SupabaseClient } from "@supabase/supabase-js";

export type WithdrawalsListTab =
  | "all"
  | "pending"
  | "in_review"
  | "paid"
  | "rejected"
  | "approved"
  | "forfeited"
  | "failed";

export type WithdrawalsSortKey =
  | "created_at"
  | "amount"
  | "user_full_name"
  | "username"
  | "email";

export function parseWithdrawalsTab(raw: string | null): WithdrawalsListTab {
  const v = (raw || "all").toLowerCase();
  if (
    v === "pending" ||
    v === "in_review" ||
    v === "paid" ||
    v === "rejected" ||
    v === "approved" ||
    v === "forfeited" ||
    v === "failed"
  ) {
    return v;
  }
  return "all";
}

export function parseSortKey(raw: string | null): WithdrawalsSortKey {
  const v = (raw || "created_at").toLowerCase();
  if (
    v === "amount" ||
    v === "user_full_name" ||
    v === "username" ||
    v === "email"
  ) {
    return v;
  }
  return "created_at";
}

export function parseOrder(raw: string | null): "asc" | "desc" {
  return raw?.toLowerCase() === "asc" ? "asc" : "desc";
}

export const WITHDRAWAL_PAYOUT_METHODS = [
  "skydo",
  "upi",
  "bank_transfer",
  "crypto",
  "phantom",
] as const;

export type WithdrawalPayoutMethod = (typeof WITHDRAWAL_PAYOUT_METHODS)[number];

export type WithdrawalsMethodFilter = "all" | WithdrawalPayoutMethod;

export function parsePayoutMethod(raw: string | null): WithdrawalsMethodFilter {
  const v = (raw || "all").toLowerCase();
  return (WITHDRAWAL_PAYOUT_METHODS as readonly string[]).includes(v)
    ? (v as WithdrawalPayoutMethod)
    : "all";
}

export type WithdrawalsFilters = {
  tab: WithdrawalsListTab;
  method: WithdrawalsMethodFilter;
  createdFrom?: string | null;
  createdTo?: string | null;
};

/** Status tab + payout method + created_at range, shared by list, grouped and export. */
export function applyWithdrawalsFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: any,
  filters: WithdrawalsFilters,
) {
  let next = applyWithdrawalsTabFilter(q, filters.tab);
  if (filters.method !== "all") {
    next = next.ilike("payout_method_type_snapshot", filters.method);
  }
  if (filters.createdFrom) next = next.gte("created_at", filters.createdFrom);
  if (filters.createdTo) next = next.lte("created_at", filters.createdTo);
  return next;
}

/** Map flat view row to API shape expected by admin UI (nested users). */
export function mapWithdrawalListRow(r: Record<string, unknown>) {
  const {
    user_full_name,
    user_email,
    user_username,
    ...rest
  } = r as {
    user_full_name?: string | null;
    user_email?: string | null;
    user_username?: string | null;
    [k: string]: unknown;
  };
  return {
    ...rest,
    users:
      user_full_name != null || user_email != null || user_username != null
        ? {
            full_name: user_full_name ?? null,
            email: user_email ?? null,
            username: user_username ?? null,
          }
        : null,
  };
}

/** Apply status filter for EnhancedTabs ids. */
export function applyWithdrawalsTabFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: any,
  tab: WithdrawalsListTab,
) {
  switch (tab) {
    case "pending":
      return q.eq("status", "pending");
    case "in_review":
      return q.eq("status", "in_review");
    case "paid":
      return q.eq("status", "processed");
    case "rejected":
      return q.in("status", ["rejected", "cancelled"]);
    case "approved":
      return q.eq("status", "approved");
    case "forfeited":
      return q.eq("status", "forfeited");
    case "failed":
      return q.eq("status", "failed");
    default:
      return q;
  }
}

const SORT_COLUMN: Record<WithdrawalsSortKey, string> = {
  created_at: "created_at",
  amount: "amount",
  user_full_name: "user_full_name",
  username: "user_username",
  email: "user_email",
};

export async function fetchWithdrawalsPage(
  supabase: SupabaseClient,
  opts: {
    page: number;
    pageSize: number;
    tab: WithdrawalsListTab;
    method?: WithdrawalsMethodFilter;
    createdFrom?: string | null;
    createdTo?: string | null;
    sort: WithdrawalsSortKey;
    order: "asc" | "desc";
  },
) {
  const { page, pageSize, tab, createdFrom, createdTo, sort, order } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const ascending = order === "asc";

  let q = supabase
    .from("admin_withdrawal_requests_list")
    .select("*", { count: "exact" });

  q = applyWithdrawalsFilters(q, {
    tab,
    method: opts.method ?? "all",
    createdFrom,
    createdTo,
  });

  const col = SORT_COLUMN[sort];
  q = q.order(col, { ascending });
  q = q.order("id", { ascending: true });

  q = q.range(from, to);

  const { data: list, error: listError, count: total } = await q;

  if (listError) {
    return { error: listError.message, data: null as unknown[] | null, total: 0 };
  }

  return {
    error: null as string | null,
    data: (list || []).map((row) =>
      mapWithdrawalListRow(row as Record<string, unknown>),
    ),
    total: total ?? 0,
  };
}

export type WithdrawalStatusBuckets = {
  all: number;
  pending: number;
  in_review: number;
  approved: number;
  paid: number;
  rejected: number;
  forfeited: number;
  failed: number;
};

type StatusSummaryRow = {
  status: string;
  request_count: number | string;
  cash_amount_cents: number | string;
  /** Absent before 20261015130000_balance_guards_and_net_totals.sql. */
  cash_fee_cents?: number | string | null;
};

/** Per-tab counts and cash totals, optionally limited to one payout method. */
export async function fetchWithdrawalStatusSummary(
  supabase: SupabaseClient,
  method: WithdrawalsMethodFilter,
): Promise<{
  error: string | null;
  totals: WithdrawalStatusBuckets;
  /** Processing fees inside `totals`; amount sent = totals - fees. */
  fees: WithdrawalStatusBuckets;
  statusCounts: WithdrawalStatusBuckets;
}> {
  let res =
    method === "all"
      ? await supabase.rpc("admin_withdrawal_status_summary")
      : await supabase.rpc("admin_withdrawal_status_summary", {
          p_method_type: method,
        });
  if (res.error && method !== "all") {
    console.warn(
      "admin_withdrawal_status_summary(p_method_type) unavailable, using unfiltered summary:",
      res.error.message,
    );
    res = await supabase.rpc("admin_withdrawal_status_summary");
  }

  const byStatus = new Map(
    ((res.data ?? []) as StatusSummaryRow[]).map((row) => [
      row.status,
      {
        count: toFiniteNumber(row.request_count),
        cash: toFiniteNumber(row.cash_amount_cents),
        fee: toFiniteNumber(row.cash_fee_cents ?? 0),
      },
    ]),
  );
  const sum = (field: "count" | "cash" | "fee", ...statuses: string[]) =>
    statuses.reduce((s, st) => s + (byStatus.get(st)?.[field] ?? 0), 0);
  const buckets = (field: "count" | "cash" | "fee"): WithdrawalStatusBuckets => ({
    all: sum(
      field,
      "pending",
      "in_review",
      "approved",
      "processed",
      "rejected",
      "cancelled",
      "forfeited",
      "failed",
    ),
    pending: sum(field, "pending"),
    in_review: sum(field, "in_review"),
    approved: sum(field, "approved"),
    paid: sum(field, "processed"),
    rejected: sum(field, "rejected", "cancelled"),
    forfeited: sum(field, "forfeited"),
    failed: sum(field, "failed"),
  });

  return {
    error: res.error ? res.error.message || "Failed to load withdrawal totals" : null,
    totals: buckets("cash"),
    fees: buckets("fee"),
    statusCounts: buckets("count"),
  };
}

export const MAX_WITHDRAWALS_BULK_FETCH = 50_000;
const BULK_FETCH_CHUNK = 1000;

/**
 * All rows matching the filters (mapped to API shape), fetched in chunks.
 * Errors when the match count exceeds MAX_WITHDRAWALS_BULK_FETCH.
 */
export async function fetchAllFilteredWithdrawals(
  supabase: SupabaseClient,
  filters: WithdrawalsFilters,
  sort: WithdrawalsSortKey = "created_at",
  order: "asc" | "desc" = "desc",
): Promise<{
  error: string | null;
  status?: number;
  data: Record<string, unknown>[];
}> {
  const countQ = applyWithdrawalsFilters(
    supabase
      .from("admin_withdrawal_requests_list")
      .select("*", { count: "exact", head: true }),
    filters,
  );
  const { count, error: countErr } = await countQ;
  if (countErr) return { error: countErr.message, status: 500, data: [] };
  if ((count ?? 0) > MAX_WITHDRAWALS_BULK_FETCH) {
    return {
      error: `Too many rows (${count}). Narrow the date range, status or payout method filter (max ${MAX_WITHDRAWALS_BULK_FETCH}).`,
      status: 400,
      data: [],
    };
  }

  const col = SORT_COLUMN[sort];
  const ascending = order === "asc";
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < (count ?? 0); offset += BULK_FETCH_CHUNK) {
    const q = applyWithdrawalsFilters(
      supabase.from("admin_withdrawal_requests_list").select("*"),
      filters,
    )
      .order(col, { ascending })
      .order("id", { ascending: true })
      .range(offset, offset + BULK_FETCH_CHUNK - 1);
    const { data, error } = await q;
    if (error) return { error: error.message, status: 500, data: [] };
    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk.map((r) => mapWithdrawalListRow(r)));
    if (chunk.length < BULK_FETCH_CHUNK) break;
  }
  return { error: null, data: rows };
}

export const MISSING_PAYEE_LABEL = "Missing payee details";

/** Normalised payout destination for a row (what the money is actually sent to). */
export function payoutDestination(row: Record<string, unknown>): {
  method: string;
  destination: string;
} {
  const method = String(row.payout_method_type_snapshot || "").toLowerCase();
  const d = (row.payout_method_details_snapshot || {}) as Record<
    string,
    unknown
  >;
  // Case-sensitive: only leading/trailing [ \t\n\r\f\v] is ignored, matching
  // the SQL in admin_withdrawal_payee_groups.
  const s = (v: unknown) =>
    String(v ?? "").replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
  let destination = "";
  switch (method) {
    case "skydo":
      destination = s(d.email);
      break;
    case "upi":
      destination = s(d.upi_id);
      break;
    case "bank_transfer": {
      const acct = s(d.account_number);
      const code = s(d.ifsc_code || d.swift_bic_code);
      destination = acct ? (code ? `${acct} / ${code}` : acct) : "";
      break;
    }
    case "crypto":
    case "phantom":
      destination = s(d.wallet_address);
      break;
    default:
      destination = "";
  }
  return { method, destination };
}

export function payeeKey(row: Record<string, unknown>): string {
  const { method, destination } = payoutDestination(row);
  return `${method || "unknown"}|${destination || MISSING_PAYEE_LABEL}`;
}

export type WithdrawalPayeeGroup = {
  key: string;
  method: string;
  destination: string;
  currency: string;
  amountType: string;
  totalCents: number;
  /** Processing fees in the group, cents. */
  feeCents: number;
  /** Amount to send after fees, cents (USD). */
  netCents: number;
  /** Amount to send in INR paise; null unless every request in the group has one. */
  netLocalMinor: number | null;
  count: number;
  usernames: string[];
  names: string[];
  statuses: Record<string, number>;
  latestCreatedAt: string | null;
  requests: Record<string, unknown>[];
};

/**
 * Group mapped withdrawal rows by payout destination. Currency and amount type
 * are part of the key so totals never mix units.
 */
export function groupWithdrawalsByPayee(
  rows: Record<string, unknown>[],
): WithdrawalPayeeGroup[] {
  const groups = new Map<string, WithdrawalPayeeGroup>();
  for (const row of rows) {
    const { method, destination } = payoutDestination(row);
    const currency = String(row.currency || "USD").toUpperCase();
    const amountType = String(row.amount_type || "cash");
    const key = `${payeeKey(row)}|${currency}|${amountType}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        method: method || "unknown",
        destination: destination || MISSING_PAYEE_LABEL,
        currency,
        amountType,
        totalCents: 0,
        feeCents: 0,
        netCents: 0,
        netLocalMinor: 0,
        count: 0,
        usernames: [],
        names: [],
        statuses: {},
        latestCreatedAt: null,
        requests: [],
      };
      groups.set(key, g);
    }
    const amount = Number(row.amount ?? 0);
    g.totalCents += Number.isFinite(amount) ? amount : 0;
    const fee = Number(row.fee_cents ?? 0);
    g.feeCents += Number.isFinite(fee) ? fee : 0;
    const net = Number(row.net_amount_cents ?? amount - fee);
    g.netCents += Number.isFinite(net) ? net : 0;
    const local = row.net_amount_local_minor;
    g.netLocalMinor =
      g.netLocalMinor === null || local === null || local === undefined || !Number.isFinite(Number(local))
        ? null
        : g.netLocalMinor + Number(local);
    g.count += 1;
    const users = row.users as
      | { username?: string | null; full_name?: string | null }
      | null
      | undefined;
    if (users?.username && !g.usernames.includes(users.username)) {
      g.usernames.push(users.username);
    }
    if (users?.full_name && !g.names.includes(users.full_name)) {
      g.names.push(users.full_name);
    }
    const status = String(row.status || "unknown");
    g.statuses[status] = (g.statuses[status] ?? 0) + 1;
    const createdAt = row.created_at ? String(row.created_at) : null;
    if (createdAt && (!g.latestCreatedAt || createdAt > g.latestCreatedAt)) {
      g.latestCreatedAt = createdAt;
    }
    g.requests.push(row);
  }
  return [...groups.values()].sort((a, b) => b.totalCents - a.totalCents);
}

/** UUIDs per `.in()` filter; keeps the PostgREST request URL well under size limits. */
const ID_FILTER_CHUNK = 150;

type RpcPayeeGroupRow = {
  method: string;
  destination: string;
  currency: string;
  amount_type: string;
  total_cents: number | string;
  request_count: number | string;
  usernames: string[] | null;
  names: string[] | null;
  statuses: Record<string, number | string> | null;
  latest_created_at: string | null;
  request_ids: string[] | null;
  total_groups: number | string;
  total_requests: number | string;
  fee_cents?: number | string | null;
  net_cents?: number | string | null;
  net_local_minor?: number | string | null;
};

/**
 * One page of payee groups. Grouping runs in SQL (admin_withdrawal_payee_groups);
 * only the requests belonging to this page's groups are loaded.
 * Falls back to in-memory grouping if the RPC is not deployed.
 */
export async function fetchWithdrawalPayeeGroupsPage(
  supabase: SupabaseClient,
  filters: WithdrawalsFilters,
  page: number,
  pageSize: number,
): Promise<{
  error: string | null;
  status?: number;
  groups: WithdrawalPayeeGroup[];
  totalGroups: number;
  totalRequests: number;
}> {
  const from = (page - 1) * pageSize;
  const { data, error } = await supabase.rpc("admin_withdrawal_payee_groups", {
    p_tab: filters.tab,
    p_method_type: filters.method === "all" ? null : filters.method,
    p_from: filters.createdFrom ?? null,
    p_to: filters.createdTo ?? null,
    p_limit: pageSize,
    p_offset: from,
  });

  if (error) {
    console.warn(
      "admin_withdrawal_payee_groups RPC unavailable, grouping in memory:",
      error.message,
    );
    const all = await fetchAllFilteredWithdrawals(supabase, filters);
    if (all.error) {
      return {
        error: all.error,
        status: all.status,
        groups: [],
        totalGroups: 0,
        totalRequests: 0,
      };
    }
    const groups = groupWithdrawalsByPayee(all.data);
    return {
      error: null,
      groups: groups.slice(from, from + pageSize),
      totalGroups: groups.length,
      totalRequests: all.data.length,
    };
  }

  const rows = (data ?? []) as RpcPayeeGroupRow[];
  const ids = rows.flatMap((r) => r.request_ids ?? []);
  const byId = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < ids.length; i += ID_FILTER_CHUNK) {
    const { data: reqRows, error: reqErr } = await supabase
      .from("admin_withdrawal_requests_list")
      .select("*")
      .in("id", ids.slice(i, i + ID_FILTER_CHUNK));
    if (reqErr) {
      return {
        error: reqErr.message,
        status: 500,
        groups: [],
        totalGroups: 0,
        totalRequests: 0,
      };
    }
    for (const r of (reqRows ?? []) as Record<string, unknown>[]) {
      byId.set(String(r.id), mapWithdrawalListRow(r));
    }
  }

  const groups: WithdrawalPayeeGroup[] = rows.map((r) => ({
    key: `${r.method}|${r.destination}|${r.currency}|${r.amount_type}`,
    method: r.method,
    destination: r.destination,
    currency: r.currency,
    amountType: r.amount_type,
    totalCents: toFiniteNumber(r.total_cents),
    feeCents: toFiniteNumber(r.fee_cents),
    netCents: r.net_cents == null ? toFiniteNumber(r.total_cents) : toFiniteNumber(r.net_cents),
    netLocalMinor: r.net_local_minor == null ? null : toFiniteNumber(r.net_local_minor),
    count: toFiniteNumber(r.request_count),
    usernames: r.usernames ?? [],
    names: r.names ?? [],
    statuses: Object.fromEntries(
      Object.entries(r.statuses ?? {}).map(([k, v]) => [k, toFiniteNumber(v)]),
    ),
    latestCreatedAt: r.latest_created_at,
    requests: (r.request_ids ?? [])
      .map((id) => byId.get(String(id)))
      .filter((x): x is Record<string, unknown> => Boolean(x)),
  }));

  return {
    error: null,
    groups,
    totalGroups: rows.length > 0 ? toFiniteNumber(rows[0].total_groups) : 0,
    totalRequests: rows.length > 0 ? toFiniteNumber(rows[0].total_requests) : 0,
  };
}

export type WithdrawalPayoutSeriesPoint = {
  date: string;
  label: string;
  amountCents: number;
  count: number;
};

/** How chart points are grouped for the selected range. */
export type WithdrawalPayoutSeriesGranularity = "day" | "week" | "month";

type RpcPayoutDayRow = {
  day: string;
  amount_cents: number | string;
  payout_count: number | string;
};

function toFiniteNumber(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseUtcDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatUtcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Inclusive UTC calendar-day span between two ISO timestamps. */
export function payoutSeriesDaySpan(
  fromIso: string,
  toIso: string,
): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  from.setUTCHours(12, 0, 0, 0);
  to.setUTCHours(12, 0, 0, 0);
  const ms = to.getTime() - from.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Pick chart bucket size from range length:
 * - up to ~3 months → daily
 * - up to ~1 year → weekly
 * - longer (e.g. 2 years) → monthly
 */
export function choosePayoutSeriesGranularity(
  daySpan: number,
): WithdrawalPayoutSeriesGranularity {
  if (daySpan <= 92) return "day";
  if (daySpan <= 366) return "week";
  return "month";
}

function startOfUtcIsoWeekMonday(day: string): string {
  const d = parseUtcDay(day);
  if (!d) return day;
  const dow = d.getUTCDay(); // 0 = Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return formatUtcDay(d);
}

function startOfUtcMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

function bucketKeyForDay(
  day: string,
  granularity: WithdrawalPayoutSeriesGranularity,
): string {
  if (granularity === "week") return startOfUtcIsoWeekMonday(day);
  if (granularity === "month") return startOfUtcMonth(day);
  return day;
}

function formatBucketLabel(
  key: string,
  granularity: WithdrawalPayoutSeriesGranularity,
): string {
  const d = parseUtcDay(key);
  if (!d) return key;
  if (granularity === "month") {
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  if (granularity === "week") {
    const end = new Date(d);
    end.setUTCDate(end.getUTCDate() + 6);
    const startLabel = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    const endLabel = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    return `${startLabel} – ${endLabel}`;
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Every bucket key from fromIso..toIso at the chosen granularity (zeros filled). */
function periodKeysInclusive(
  fromIso: string,
  toIso: string,
  granularity: WithdrawalPayoutSeriesGranularity,
): string[] {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
  from.setUTCHours(12, 0, 0, 0);
  to.setUTCHours(12, 0, 0, 0);
  if (from > to) return [];

  const startKey = bucketKeyForDay(formatUtcDay(from), granularity);
  const endKey = bucketKeyForDay(formatUtcDay(to), granularity);
  const cursor = parseUtcDay(startKey);
  const end = parseUtcDay(endKey);
  if (!cursor || !end) return [];

  const keys: string[] = [];
  while (cursor <= end) {
    keys.push(formatUtcDay(cursor));
    if (granularity === "month") {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    } else if (granularity === "week") {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    // Safety: ~10 years of daily points max
    if (keys.length > 3700) break;
  }
  return keys;
}

function buildSeriesFromDailyMap(
  daily: Map<string, { amountCents: number; count: number }>,
  fromIso: string | undefined,
  toIso: string | undefined,
): {
  data: WithdrawalPayoutSeriesPoint[];
  granularity: WithdrawalPayoutSeriesGranularity;
} {
  const daySpan =
    fromIso && toIso ? payoutSeriesDaySpan(fromIso, toIso) : daily.size;
  const granularity = choosePayoutSeriesGranularity(daySpan || daily.size);

  const rolled = new Map<string, { amountCents: number; count: number }>();
  for (const [day, value] of daily) {
    const key = bucketKeyForDay(day, granularity);
    const prev = rolled.get(key) ?? { amountCents: 0, count: 0 };
    prev.amountCents += value.amountCents;
    prev.count += value.count;
    rolled.set(key, prev);
  }

  const keys =
    fromIso && toIso
      ? periodKeysInclusive(fromIso, toIso, granularity)
      : Array.from(rolled.keys()).sort((a, b) => a.localeCompare(b));

  return {
    granularity,
    data: keys.map((date) => {
      const b = rolled.get(date) ?? { amountCents: 0, count: 0 };
      return {
        date,
        label: formatBucketLabel(date, granularity),
        amountCents: b.amountCents,
        count: b.count,
      };
    }),
  };
}

function normalizeDayKey(dayRaw: unknown): string | null {
  const day =
    typeof dayRaw === "string"
      ? dayRaw.slice(0, 10)
      : String(dayRaw ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/**
 * Payout series for processed cash withdrawals by processed_at.
 * Uses SQL RPC daily aggregates, then rolls up to day/week/month for long ranges
 * so multi-year views stay readable and light.
 */
export async function fetchWithdrawalPayoutSeries(
  supabase: SupabaseClient,
  opts: {
    processedFrom?: string | null;
    processedTo?: string | null;
  },
): Promise<{
  error: string | null;
  data: WithdrawalPayoutSeriesPoint[];
  granularity: WithdrawalPayoutSeriesGranularity;
}> {
  const fromIso = opts.processedFrom || undefined;
  const toIso = opts.processedTo || undefined;
  const daily = new Map<string, { amountCents: number; count: number }>();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "admin_withdrawal_payout_series",
    {
      p_from: fromIso ?? null,
      p_to: toIso ?? null,
    },
  );

  if (!rpcError) {
    for (const row of (rpcData ?? []) as RpcPayoutDayRow[]) {
      const day = normalizeDayKey(row.day);
      if (!day) continue;
      daily.set(day, {
        amountCents: toFiniteNumber(row.amount_cents),
        count: toFiniteNumber(row.payout_count),
      });
    }
    const built = buildSeriesFromDailyMap(daily, fromIso, toIso);
    return { error: null, ...built };
  }

  console.warn(
    "admin_withdrawal_payout_series RPC unavailable, falling back:",
    rpcError.message,
  );

  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    let q = supabase
      .from("admin_withdrawal_requests_list")
      .select("amount, net_amount_cents, amount_type, processed_at")
      .eq("status", "processed")
      .not("processed_at", "is", null)
      .order("processed_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (fromIso) {
      q = q.gte("processed_at", fromIso);
    }
    if (toIso) {
      q = q.lte("processed_at", toIso);
    }

    const { data, error } = await q;
    if (error) {
      return { error: error.message, data: [], granularity: "day" };
    }

    const rows = data ?? [];
    for (const row of rows) {
      const processedAt = row.processed_at as string | null;
      if (!processedAt) continue;
      const amountType = (row.amount_type as string | null) || "cash";
      if (amountType !== "cash") continue;
      const day = new Date(processedAt).toISOString().slice(0, 10);
      const amount = Number(row.net_amount_cents ?? row.amount ?? 0);
      if (!Number.isFinite(amount)) continue;
      const prev = daily.get(day) ?? { amountCents: 0, count: 0 };
      prev.amountCents += amount;
      prev.count += 1;
      daily.set(day, prev);
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const built = buildSeriesFromDailyMap(daily, fromIso, toIso);
  return { error: null, ...built };
}
