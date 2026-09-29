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

  q = applyWithdrawalsTabFilter(q, tab);

  if (createdFrom) {
    q = q.gte("created_at", createdFrom);
  }
  if (createdTo) {
    q = q.lte("created_at", createdTo);
  }

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
      .select("amount, amount_type, processed_at")
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
      const amount = Number(row.amount ?? 0);
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
