/**
 * Pure helpers for Daily Challenge winners archive, pagination, and reward stats.
 * Keep side-effect free so unit tests can cover parsing and aggregation.
 */

export type SnapshotPeriod = "day" | "week" | "month";
export type SnapshotCategory = "views" | "reels";

export type WinnersHistoryFilters = {
  page: number;
  limit: number;
  period: SnapshotPeriod | null;
  category: SnapshotCategory | null;
  eventId: string | null;
  /** Inclusive YYYY-MM-DD (IST calendar day) */
  fromDate: string | null;
  /** Inclusive YYYY-MM-DD (IST calendar day) */
  toDate: string | null;
  /** Optional calendar month filter YYYY-MM */
  month: string | null;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type SnapshotRewardRow = {
  winner_creator_id?: string | null;
  is_eligible?: boolean | null;
  period?: string | null;
  prize_minor_units?: number | string | null;
  prize_currency?: string | null;
};

export type RewardsSummary = {
  totalPaidMinorUnits: number;
  dailyPaidMinorUnits: number;
  weeklyPaidMinorUnits: number;
  monthlyPaidMinorUnits: number;
  totalRewardCount: number;
  dailyRewardCount: number;
  weeklyRewardCount: number;
  monthlyRewardCount: number;
  prizeCurrency: string;
};

export type TopCreatorStat = {
  creatorId: string;
  username: string;
  fullName: string | null;
  profilePictureUrl: string | null;
  winCount: number;
  totalPaidMinorUnits: number;
  dailyWins: number;
  weeklyWins: number;
  monthlyWins: number;
  prizeCurrency: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parsePositiveInt(
  value: string | null | undefined,
  fallback: number,
  bounds?: { min?: number; max?: number },
): number {
  if (value == null || String(value).trim() === "") return fallback;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  const rounded = Math.floor(raw);
  const min = bounds?.min ?? Number.MIN_SAFE_INTEGER;
  const max = bounds?.max ?? Number.MAX_SAFE_INTEGER;
  return Math.min(max, Math.max(min, rounded));
}

export function parseSnapshotPeriod(
  value: string | null | undefined,
): SnapshotPeriod | null {
  if (value === "this_week" || value === "last_week" || value === "week") return "week";
  if (value === "this_month" || value === "last_month" || value === "month") return "month";
  if (
    value === "today" ||
    value === "yesterday" ||
    value === "day" ||
    value === "daily"
  ) {
    return "day";
  }
  return null;
}

export function parseSnapshotCategory(
  value: string | null | undefined,
): SnapshotCategory | null {
  if (value === "views" || value === "reels") return value;
  return null;
}

export function parseOptionalUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

export function parseOptionalDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return DATE_RE.test(trimmed) ? trimmed : null;
}

export function parseOptionalMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return MONTH_RE.test(trimmed) ? trimmed : null;
}

export function buildWinnersHistoryFilters(
  searchParams: URLSearchParams | Record<string, string | null | undefined>,
): WinnersHistoryFilters {
  const get =
    searchParams instanceof URLSearchParams
      ? (key: string) => searchParams.get(key)
      : (key: string) => searchParams[key] ?? null;

  return {
    page: parsePositiveInt(get("page"), 1, { min: 1 }),
    limit: parsePositiveInt(get("limit"), 10, { min: 5, max: 50 }),
    period: parseSnapshotPeriod(get("period")),
    category: parseSnapshotCategory(get("category")),
    eventId: parseOptionalUuid(get("event_id")),
    fromDate: parseOptionalDate(get("from")),
    toDate: parseOptionalDate(get("to")),
    month: parseOptionalMonth(get("month")),
  };
}

/** Expand YYYY-MM into inclusive IST calendar day bounds. */
export function monthToDateBounds(month: string): { from: string; to: string } | null {
  if (!MONTH_RE.test(month)) return null;
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    from: `${yearStr}-${monthStr}-01`,
    to: `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function resolveDateBounds(filters: Pick<WinnersHistoryFilters, "fromDate" | "toDate" | "month">): {
  fromDate: string | null;
  toDate: string | null;
} {
  let fromDate = filters.fromDate;
  let toDate = filters.toDate;
  if (filters.month) {
    const bounds = monthToDateBounds(filters.month);
    if (bounds) {
      fromDate = fromDate && fromDate > bounds.from ? fromDate : bounds.from;
      toDate = toDate && toDate < bounds.to ? toDate : bounds.to;
    }
  }
  if (fromDate && toDate && fromDate > toDate) {
    return { fromDate: toDate, toDate: fromDate };
  }
  return { fromDate, toDate };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  totalItems: number,
): PaginationMeta {
  const safeLimit = Math.max(1, limit);
  const safeTotal = Math.max(0, totalItems);
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / safeLimit);
  const safePage = Math.max(1, page);
  return {
    page: safePage,
    limit: safeLimit,
    totalItems: safeTotal,
    totalPages,
    hasNextPage: totalPages > 0 && safePage < totalPages,
    hasPreviousPage: safePage > 1 && totalPages > 0,
  };
}

export function isPaidWinnerRow(row: SnapshotRewardRow): boolean {
  return Boolean(row.winner_creator_id) && Boolean(row.is_eligible);
}

export function asNonNegativeMinorUnits(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

export function aggregateRewardsFromSnapshots(
  rows: SnapshotRewardRow[],
  fallbackCurrency = "INR",
): RewardsSummary {
  const summary: RewardsSummary = {
    totalPaidMinorUnits: 0,
    dailyPaidMinorUnits: 0,
    weeklyPaidMinorUnits: 0,
    monthlyPaidMinorUnits: 0,
    totalRewardCount: 0,
    dailyRewardCount: 0,
    weeklyRewardCount: 0,
    monthlyRewardCount: 0,
    prizeCurrency: fallbackCurrency,
  };

  const currencyCounts = new Map<string, number>();

  for (const row of rows) {
    if (!isPaidWinnerRow(row)) continue;
    const amount = asNonNegativeMinorUnits(row.prize_minor_units);
    const period = String(row.period || "day");
    const currency = String(row.prize_currency || fallbackCurrency)
      .trim()
      .toUpperCase() || fallbackCurrency;

    summary.totalPaidMinorUnits += amount;
    summary.totalRewardCount += 1;
    currencyCounts.set(currency, (currencyCounts.get(currency) || 0) + 1);

    if (period === "week") {
      summary.weeklyPaidMinorUnits += amount;
      summary.weeklyRewardCount += 1;
    } else if (period === "month") {
      summary.monthlyPaidMinorUnits += amount;
      summary.monthlyRewardCount += 1;
    } else {
      summary.dailyPaidMinorUnits += amount;
      summary.dailyRewardCount += 1;
    }
  }

  if (currencyCounts.size > 0) {
    summary.prizeCurrency = [...currencyCounts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })[0][0];
  }

  return summary;
}

export function rankTopCreatorsFromSnapshots(
  rows: Array<
    SnapshotRewardRow & {
      metrics_json?: {
        username?: string | null;
        fullName?: string | null;
        profilePictureUrl?: string | null;
      } | null;
    }
  >,
  limit = 10,
  fallbackCurrency = "INR",
): TopCreatorStat[] {
  const map = new Map<string, TopCreatorStat>();

  for (const row of rows) {
    if (!isPaidWinnerRow(row) || !row.winner_creator_id) continue;
    const creatorId = String(row.winner_creator_id);
    const amount = asNonNegativeMinorUnits(row.prize_minor_units);
    const period = String(row.period || "day");
    const currency =
      String(row.prize_currency || fallbackCurrency).trim().toUpperCase() ||
      fallbackCurrency;
    const existing = map.get(creatorId);
    if (!existing) {
      map.set(creatorId, {
        creatorId,
        username:
          row.metrics_json?.username ||
          row.metrics_json?.fullName ||
          "Creator",
        fullName: row.metrics_json?.fullName || null,
        profilePictureUrl: row.metrics_json?.profilePictureUrl || null,
        winCount: 1,
        totalPaidMinorUnits: amount,
        dailyWins: period === "day" ? 1 : 0,
        weeklyWins: period === "week" ? 1 : 0,
        monthlyWins: period === "month" ? 1 : 0,
        prizeCurrency: currency,
      });
      continue;
    }
    existing.winCount += 1;
    existing.totalPaidMinorUnits += amount;
    if (period === "day") existing.dailyWins += 1;
    if (period === "week") existing.weeklyWins += 1;
    if (period === "month") existing.monthlyWins += 1;
  }

  return [...map.values()]
    .sort((a, b) => {
      const paid = b.totalPaidMinorUnits - a.totalPaidMinorUnits;
      if (paid !== 0) return paid;
      const wins = b.winCount - a.winCount;
      if (wins !== 0) return wins;
      return a.creatorId.localeCompare(b.creatorId);
    })
    .slice(0, Math.max(1, Math.min(limit, 10)));
}

/** Professional status labels for archive rows (no internal slang). */
export function winnerArchiveStatusCopy(hasWinner: boolean): {
  prizeLabel: string;
  statusLabel: string;
} {
  if (hasWinner) {
    return {
      prizeLabel: "Prize awarded",
      statusLabel: "Winner recorded",
    };
  }
  return {
    prizeLabel: "No prize awarded",
    statusLabel: "Eligibility not met",
  };
}

export function formatPeriodLabel(period: string | null | undefined): string {
  if (period === "week") return "Weekly";
  if (period === "month") return "Monthly";
  return "Daily";
}

export function formatCategoryLabel(category: string | null | undefined): string {
  if (category === "reels") return "Most verified reels";
  return "Most verified views";
}
