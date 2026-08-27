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

function formatPayoutDayLabel(key: string): string {
  const d = new Date(`${key}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function utcDayKeysInclusive(fromIso: string, toIso: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(fromIso);
  cursor.setUTCHours(12, 0, 0, 0);
  const end = new Date(toIso);
  end.setUTCHours(12, 0, 0, 0);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) {
    return keys;
  }
  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

/**
 * Daily cash payout series for processed withdrawals, bucketed by processed_at (UTC).
 * Fills zero days across the inclusive range. Paginates past Supabase's 1000-row cap.
 */
export async function fetchWithdrawalPayoutSeries(
  supabase: SupabaseClient,
  opts: {
    processedFrom?: string | null;
    processedTo?: string | null;
  },
): Promise<{ error: string | null; data: WithdrawalPayoutSeriesPoint[] }> {
  const fromIso = opts.processedFrom || undefined;
  const toIso = opts.processedTo || undefined;

  const dayKeys =
    fromIso && toIso ? utcDayKeysInclusive(fromIso, toIso) : [];
  const buckets = new Map<string, { amountCents: number; count: number }>();
  for (const key of dayKeys) {
    buckets.set(key, { amountCents: 0, count: 0 });
  }

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
      return { error: error.message, data: [] };
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
      const prev = buckets.get(day) ?? { amountCents: 0, count: 0 };
      prev.amountCents += amount;
      prev.count += 1;
      buckets.set(day, prev);
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const orderedKeys =
    dayKeys.length > 0
      ? dayKeys
      : Array.from(buckets.keys()).sort((a, b) => a.localeCompare(b));

  return {
    error: null,
    data: orderedKeys.map((date) => {
      const b = buckets.get(date) ?? { amountCents: 0, count: 0 };
      return {
        date,
        label: formatPayoutDayLabel(date),
        amountCents: b.amountCents,
        count: b.count,
      };
    }),
  };
}
