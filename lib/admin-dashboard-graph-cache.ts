import { unstable_cache, revalidateTag } from "next/cache";
import { cache } from "react";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidateAdminAnalyticsCaches } from "@/lib/admin-analytics-cache";
import {
  addDaysToDateKey,
  formatGrowthDayLabel,
  formatGrowthWeekLabel,
  getGrowthDayKey,
  getGrowthMonthKey,
  getGrowthWeekKey,
  getGrowthYearKey,
  utcDateFromDayKey,
  type SubmissionCreatorsByDay,
} from "@/lib/admin-date-range";

export const ADMIN_DASHBOARD_GRAPH_CACHE_SECONDS = 30 * 60;

export type AdminUserGrowthPoint = {
  label: string;
  all: number;
  creators: number;
  brands: number;
  admins: number;
};

export type AdminUserGrowthPointWithDate = AdminUserGrowthPoint & {
  date: string;
};

export type AdminStatusGrowthPoint = {
  label: string;
  all: number;
  verified: number;
  pending: number;
  rejected: number;
  paid: number;
};

export type AdminStatusGrowthPointWithDate = AdminStatusGrowthPoint & {
  date: string;
};

export type AdminUserGrowthSeries = {
  byDay: AdminUserGrowthPoint[];
  byWeek: AdminUserGrowthPoint[];
  byMonth: AdminUserGrowthPoint[];
  byYear: AdminUserGrowthPoint[];
  byDayFull: AdminUserGrowthPointWithDate[];
};

export type AdminStatusGrowthSeries = {
  byDay: AdminStatusGrowthPoint[];
  byWeek: AdminStatusGrowthPoint[];
  byMonth: AdminStatusGrowthPoint[];
  byYear: AdminStatusGrowthPoint[];
  byDayFull: AdminStatusGrowthPointWithDate[];
};

export type AdminDashboardGraphData = {
  submissionGrowth: AdminStatusGrowthSeries;
  viewsGrowth: AdminStatusGrowthSeries;
  submissionCreatorsByDay: SubmissionCreatorsByDay[];
};

export type AdminDashboardCacheData = {
  userGrowth: AdminUserGrowthSeries;
  byContestType: Record<string, AdminDashboardGraphData>;
};

export const ADMIN_DASHBOARD_CACHE_TAG = "admin-dashboard-graph";

export function buildUserGrowth(
  users: { created_at: string; user_type: string }[],
): AdminUserGrowthSeries {
  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const byDayMap: Record<
    string,
    { all: number; creators: number; brands: number; admins: number }
  > = {};
  const byWeekMap: Record<
    string,
    { all: number; creators: number; brands: number; admins: number }
  > = {};
  const byMonthMap: Record<
    string,
    { all: number; creators: number; brands: number; admins: number }
  > = {};
  const byYearMap: Record<
    string,
    { all: number; creators: number; brands: number; admins: number }
  > = {};

  for (const u of users) {
    const d = new Date(u.created_at);
    if (d < twoYearsAgo) continue;
    const isCreator = u.user_type === "creator";
    const isBrand = u.user_type === "advertiser";
    const isAdmin = u.user_type === "admin";

    const dayKey = getGrowthDayKey(d);
    const weekKey = getGrowthWeekKey(d);
    const monthKey = getGrowthMonthKey(d);
    const yearKey = getGrowthYearKey(d);

    if (!byDayMap[dayKey])
      byDayMap[dayKey] = { all: 0, creators: 0, brands: 0, admins: 0 };
    byDayMap[dayKey].all++;
    if (isCreator) byDayMap[dayKey].creators++;
    if (isBrand) byDayMap[dayKey].brands++;
    if (isAdmin) byDayMap[dayKey].admins++;

    if (!byWeekMap[weekKey])
      byWeekMap[weekKey] = { all: 0, creators: 0, brands: 0, admins: 0 };
    byWeekMap[weekKey].all++;
    if (isCreator) byWeekMap[weekKey].creators++;
    if (isBrand) byWeekMap[weekKey].brands++;
    if (isAdmin) byWeekMap[weekKey].admins++;

    if (!byMonthMap[monthKey])
      byMonthMap[monthKey] = { all: 0, creators: 0, brands: 0, admins: 0 };
    byMonthMap[monthKey].all++;
    if (isCreator) byMonthMap[monthKey].creators++;
    if (isBrand) byMonthMap[monthKey].brands++;
    if (isAdmin) byMonthMap[monthKey].admins++;

    if (!byYearMap[yearKey])
      byYearMap[yearKey] = { all: 0, creators: 0, brands: 0, admins: 0 };
    byYearMap[yearKey].all++;
    if (isCreator) byYearMap[yearKey].creators++;
    if (isBrand) byYearMap[yearKey].brands++;
    if (isAdmin) byYearMap[yearKey].admins++;
  }

  const toGrowthPoint = (
    key: string,
    m: Record<
      string,
      { all: number; creators: number; brands: number; admins: number }
    >,
  ): AdminUserGrowthPoint => {
    const v = m[key] || { all: 0, creators: 0, brands: 0, admins: 0 };
    return {
      label: key,
      all: v.all,
      creators: v.creators,
      brands: v.brands,
      admins: v.admins,
    };
  };

  const byDay: AdminUserGrowthPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = getGrowthDayKey(d);
    const pt = toGrowthPoint(key, byDayMap);
    pt.label = formatGrowthDayLabel(key);
    byDay.push(pt);
  }

  const byWeek: AdminUserGrowthPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const key = getGrowthWeekKey(d);
    const pt = toGrowthPoint(key, byWeekMap);
    pt.label = formatGrowthWeekLabel(key);
    byWeek.push(pt);
  }

  const byMonth: AdminUserGrowthPoint[] = [];
  const monthShort: string[] = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  for (let i = 11; i >= 0; i--) {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() - i;
    const year = y + Math.floor(m / 12);
    const month = ((m % 12) + 12) % 12;
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const label = `${monthShort[month]} '${String(year).slice(-2)}`;
    byMonth.push({
      ...toGrowthPoint(key, byMonthMap),
      label,
    });
  }

  const byYear: AdminUserGrowthPoint[] = [];
  const yearStart = now.getUTCFullYear() - 4;
  for (let y = yearStart; y <= now.getUTCFullYear(); y++) {
    const key = String(y);
    const v = byYearMap[key] || { all: 0, creators: 0, brands: 0, admins: 0 };
    byYear.push({
      label: key,
      all: v.all,
      creators: v.creators,
      brands: v.brands,
      admins: v.admins,
    });
  }

  const byDayFull: AdminUserGrowthPointWithDate[] = [];
  let walkKey = getGrowthDayKey(twoYearsAgo);
  const endKey = getGrowthDayKey(now);
  while (walkKey <= endKey) {
    const pt = toGrowthPoint(walkKey, byDayMap);
    byDayFull.push({
      ...pt,
      date: walkKey,
      label: formatGrowthDayLabel(walkKey),
    });
    if (walkKey === endKey) break;
    walkKey = addDaysToDateKey(walkKey);
  }

  return { byDay, byWeek, byMonth, byYear, byDayFull };
}

const emptyStatusBuckets = () => ({
  all: 0,
  verified: 0,
  pending: 0,
  rejected: 0,
  paid: 0,
});

function addToStatusBuckets(
  buckets: ReturnType<typeof emptyStatusBuckets>,
  status: string,
  value: number,
) {
  buckets.all += value;
  if (status === "verified") buckets.verified += value;
  else if (status === "pending") buckets.pending += value;
  else if (status === "rejected") buckets.rejected += value;
  else if (status === "paid") buckets.paid += value;
}

type StatusBucketMaps = {
  byDayMap: Record<string, ReturnType<typeof emptyStatusBuckets>>;
  byWeekMap: Record<string, ReturnType<typeof emptyStatusBuckets>>;
  byMonthMap: Record<string, ReturnType<typeof emptyStatusBuckets>>;
  byYearMap: Record<string, ReturnType<typeof emptyStatusBuckets>>;
};

function createEmptyStatusBucketMaps(): StatusBucketMaps {
  return {
    byDayMap: {},
    byWeekMap: {},
    byMonthMap: {},
    byYearMap: {},
  };
}

function addDailyStatusRowToMaps(
  maps: StatusBucketMaps,
  dayKey: string,
  status: string,
  value: number,
) {
  const d = utcDateFromDayKey(dayKey);
  const weekKey = getGrowthWeekKey(d);
  const monthKey = getGrowthMonthKey(d);
  const yearKey = getGrowthYearKey(d);

  if (!maps.byDayMap[dayKey]) maps.byDayMap[dayKey] = emptyStatusBuckets();
  addToStatusBuckets(maps.byDayMap[dayKey], status, value);

  if (!maps.byWeekMap[weekKey]) maps.byWeekMap[weekKey] = emptyStatusBuckets();
  addToStatusBuckets(maps.byWeekMap[weekKey], status, value);

  if (!maps.byMonthMap[monthKey]) {
    maps.byMonthMap[monthKey] = emptyStatusBuckets();
  }
  addToStatusBuckets(maps.byMonthMap[monthKey], status, value);

  if (!maps.byYearMap[yearKey]) maps.byYearMap[yearKey] = emptyStatusBuckets();
  addToStatusBuckets(maps.byYearMap[yearKey], status, value);
}

function finalizeStatusGrowthSeries(
  maps: StatusBucketMaps,
): AdminStatusGrowthSeries {
  const { byDayMap, byWeekMap, byMonthMap, byYearMap } = maps;
  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const toStatusGrowthPoint = (
    key: string,
    m: Record<string, ReturnType<typeof emptyStatusBuckets>>,
  ): AdminStatusGrowthPoint => {
    const v = m[key] || emptyStatusBuckets();
    return {
      label: key,
      all: v.all,
      verified: v.verified,
      pending: v.pending,
      rejected: v.rejected,
      paid: v.paid,
    };
  };

  const byDay: AdminStatusGrowthPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = getGrowthDayKey(d);
    const pt = toStatusGrowthPoint(key, byDayMap);
    pt.label = formatGrowthDayLabel(key);
    byDay.push(pt);
  }

  const byWeek: AdminStatusGrowthPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const key = getGrowthWeekKey(d);
    const pt = toStatusGrowthPoint(key, byWeekMap);
    pt.label = formatGrowthWeekLabel(key);
    byWeek.push(pt);
  }

  const byMonth: AdminStatusGrowthPoint[] = [];
  const monthShort: string[] = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  for (let i = 11; i >= 0; i--) {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() - i;
    const year = y + Math.floor(m / 12);
    const month = ((m % 12) + 12) % 12;
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const label = `${monthShort[month]} '${String(year).slice(-2)}`;
    byMonth.push({
      ...toStatusGrowthPoint(key, byMonthMap),
      label,
    });
  }

  const byYear: AdminStatusGrowthPoint[] = [];
  const yearStart = now.getUTCFullYear() - 4;
  for (let y = yearStart; y <= now.getUTCFullYear(); y++) {
    const key = String(y);
    const v = byYearMap[key] || emptyStatusBuckets();
    byYear.push({
      label: key,
      all: v.all,
      verified: v.verified,
      pending: v.pending,
      rejected: v.rejected,
      paid: v.paid,
    });
  }

  const byDayFull: AdminStatusGrowthPointWithDate[] = [];
  let statusWalkKey = getGrowthDayKey(twoYearsAgo);
  const statusEndKey = getGrowthDayKey(now);
  while (statusWalkKey <= statusEndKey) {
    const pt = toStatusGrowthPoint(statusWalkKey, byDayMap);
    byDayFull.push({
      ...pt,
      date: statusWalkKey,
      label: formatGrowthDayLabel(statusWalkKey),
    });
    if (statusWalkKey === statusEndKey) break;
    statusWalkKey = addDaysToDateKey(statusWalkKey);
  }

  return { byDay, byWeek, byMonth, byYear, byDayFull };
}

function buildStatusGrowthFromDailyBuckets(
  rows: {
    day_key: string;
    status: string;
    submission_count: number;
    views_sum: number;
  }[],
  mode: "count" | "views",
): AdminStatusGrowthSeries {
  const maps = createEmptyStatusBucketMaps();
  for (const row of rows) {
    const value =
      mode === "count" ? Number(row.submission_count) : Number(row.views_sum);
    addDailyStatusRowToMaps(maps, row.day_key, row.status, value);
  }
  return finalizeStatusGrowthSeries(maps);
}

export function buildStatusGrowth(
  records: { created_at: string; status: string; views?: number | null }[],
  mode: "count" | "views",
): AdminStatusGrowthSeries {
  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const maps = createEmptyStatusBucketMaps();

  for (const record of records) {
    const d = new Date(record.created_at);
    if (d < twoYearsAgo) continue;
    const value = mode === "count" ? 1 : record.views || 0;
    addDailyStatusRowToMaps(maps, getGrowthDayKey(d), record.status, value);
  }

  return finalizeStatusGrowthSeries(maps);
}

function dedupeById<T extends { id?: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of rows) {
    const id = row.id;
    if (!id) {
      result.push(row);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(row);
  }
  return result;
}

async function fetchAllRows<T extends { id?: string }>(
  table: string,
  select: string,
  orderColumns: { column: string; ascending?: boolean }[],
): Promise<T[]> {
  const supabase = createAdminClient();
  const CHUNK = 1000;
  let all: T[] = [];
  let rangeFrom = 0;

  while (true) {
    let query = supabase.from(table).select(select);
    for (const { column, ascending = true } of orderColumns) {
      query = query.order(column, { ascending });
    }

    const { data: chunk, error } = await query.range(
      rangeFrom,
      rangeFrom + CHUNK - 1,
    );
    if (error) {
      throw new Error(`Failed to fetch ${table} for admin dashboard: ${error.message}`);
    }
    if (!chunk || chunk.length === 0) break;
    all = all.concat(chunk as unknown as T[]);
    if (chunk.length < CHUNK) break;
    rangeFrom += CHUNK;
  }

  return dedupeById(all);
}

async function loadAdminUserGrowth(): Promise<AdminUserGrowthSeries> {
  const supabase = createAdminClient();
  const twoYearsAgoIso = new Date(
    Date.now() - 2 * 365 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const CHUNK = 1000;
  let usersForGrowth: {
    id: string;
    created_at: string;
    user_type: string;
  }[] = [];
  let rangeFrom = 0;

  while (true) {
    const { data: chunk, error } = await supabase
      .from("users")
      .select("id, created_at, user_type")
      .gte("created_at", twoYearsAgoIso)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(rangeFrom, rangeFrom + CHUNK - 1);
    if (error) {
      throw new Error(`Failed to fetch users for graph cache: ${error.message}`);
    }
    if (!chunk || chunk.length === 0) break;
    usersForGrowth = usersForGrowth.concat(chunk);
    if (chunk.length < CHUNK) break;
    rangeFrom += CHUNK;
  }

  return buildUserGrowth(dedupeById(usersForGrowth));
}

async function loadAdminSubmissions(): Promise<
  {
    id: string;
    created_at: string;
    status: string;
    views: number | null;
    contest_id: string;
    creator_id: string | null;
  }[]
> {
  return fetchAllRows("submissions", "id, created_at, status, views, contest_id, creator_id", [
    { column: "created_at", ascending: true },
    { column: "id", ascending: true },
  ]);
}

/** Uncached — raw rows exceed Next.js 2MB data-cache limit. Deduped per request via React cache(). */
export const fetchAdminSubmissions = cache(loadAdminSubmissions);

function getAdminGraphSinceIso(): string {
  const twoYearsAgo = new Date();
  twoYearsAgo.setUTCFullYear(twoYearsAgo.getUTCFullYear() - 2);
  return twoYearsAgo.toISOString();
}

function normalizeSqlDayKey(dayKey: string): string {
  return dayKey.slice(0, 10);
}

type SqlDailyGrowthRow = {
  day_key: string;
  contest_type: string | null;
  status: string;
  submission_count: number;
  views_sum: number;
};

type SqlDailyCreatorsRow = {
  day_key: string;
  contest_type: string | null;
  creator_ids: string[] | null;
};

function filterRowsByContestType<T extends { contest_type: string | null }>(
  rows: T[],
  contestTypeFilter: string,
): T[] {
  if (contestTypeFilter === "all") return rows;
  return rows.filter((row) => row.contest_type === contestTypeFilter);
}

function aggregateDailyGrowthRows(
  rows: SqlDailyGrowthRow[],
): {
  day_key: string;
  status: string;
  submission_count: number;
  views_sum: number;
}[] {
  const map = new Map<
    string,
    { submission_count: number; views_sum: number }
  >();

  for (const row of rows) {
    const dayKey = normalizeSqlDayKey(row.day_key);
    const key = `${dayKey}|${row.status}`;
    const existing = map.get(key) ?? { submission_count: 0, views_sum: 0 };
    map.set(key, {
      submission_count:
        existing.submission_count + Number(row.submission_count || 0),
      views_sum: existing.views_sum + Number(row.views_sum || 0),
    });
  }

  return Array.from(map.entries()).map(([key, totals]) => {
    const [day_key, status] = key.split("|");
    return {
      day_key,
      status,
      submission_count: totals.submission_count,
      views_sum: totals.views_sum,
    };
  });
}

function buildSubmissionCreatorsByDayFromSqlRows(
  rows: SqlDailyCreatorsRow[],
): SubmissionCreatorsByDay[] {
  const byDay = new Map<string, Set<string>>();

  for (const row of rows) {
    const dayKey = normalizeSqlDayKey(row.day_key);
    if (!byDay.has(dayKey)) byDay.set(dayKey, new Set());
    for (const creatorId of row.creator_ids ?? []) {
      if (creatorId) byDay.get(dayKey)!.add(creatorId);
    }
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ids]) => ({ date, creatorIds: [...ids] }));
}

async function loadAdminSubmissionGraphSql(): Promise<{
  dailyGrowthRows: SqlDailyGrowthRow[];
  dailyCreatorsRows: SqlDailyCreatorsRow[];
}> {
  const supabase = createAdminClient();
  const pSince = getAdminGraphSinceIso();

  const [growthRes, creatorsRes] = await Promise.all([
    supabase.rpc("admin_submission_growth_daily", { p_since: pSince }),
    supabase.rpc("admin_submission_creators_by_day", { p_since: pSince }),
  ]);

  if (growthRes.error) {
    throw new Error(
      `Failed to aggregate submission growth for admin dashboard: ${growthRes.error.message}`,
    );
  }
  if (creatorsRes.error) {
    throw new Error(
      `Failed to aggregate submission creators for admin dashboard: ${creatorsRes.error.message}`,
    );
  }

  return {
    dailyGrowthRows: (growthRes.data ?? []) as SqlDailyGrowthRow[],
    dailyCreatorsRows: (creatorsRes.data ?? []) as SqlDailyCreatorsRow[],
  };
}

function buildGraphForFilterFromSql(
  contestTypeFilter: string,
  dailyGrowthRows: SqlDailyGrowthRow[],
  dailyCreatorsRows: SqlDailyCreatorsRow[],
): AdminDashboardGraphData {
  const growthRowsForFilter = filterRowsByContestType(
    dailyGrowthRows,
    contestTypeFilter,
  );
  const creatorsRowsForFilter = filterRowsByContestType(
    dailyCreatorsRows,
    contestTypeFilter,
  );
  const aggregatedGrowthRows = aggregateDailyGrowthRows(growthRowsForFilter);

  return {
    submissionGrowth: buildStatusGrowthFromDailyBuckets(
      aggregatedGrowthRows,
      "count",
    ),
    viewsGrowth: buildStatusGrowthFromDailyBuckets(
      aggregatedGrowthRows,
      "views",
    ),
    submissionCreatorsByDay:
      buildSubmissionCreatorsByDayFromSqlRows(creatorsRowsForFilter),
  };
}

async function loadAdminDashboardCache(): Promise<AdminDashboardCacheData> {
  const supabase = createAdminClient();
  const CHUNK = 1000;

  const [userGrowth, sqlGraphData] = await Promise.all([
    loadAdminUserGrowth(),
    loadAdminSubmissionGraphSql(),
  ]);

  let contests: { id: string; contest_type: string }[] = [];
  let contestRangeFrom = 0;
  while (true) {
    const { data: chunk, error } = await supabase
      .from("contests_with_status")
      .select("id, contest_type")
      .order("id", { ascending: true })
      .range(contestRangeFrom, contestRangeFrom + CHUNK - 1);
    if (error) {
      throw new Error(
        `Failed to fetch contests for admin dashboard cache: ${error.message}`,
      );
    }
    if (!chunk || chunk.length === 0) break;
    contests = contests.concat(chunk);
    if (chunk.length < CHUNK) break;
    contestRangeFrom += CHUNK;
  }

  // Orphan submissions (missing/deleted contest) have null contest_type in SQL and
  // only appear under the "all" filter — same as the pre-RPC contestIdSet behavior.
  const contestTypeFilters = new Set<string>([
    "all",
    ...contests.map((c) => c.contest_type).filter(Boolean),
    ...knownContestTypesFromGrowthRows(sqlGraphData.dailyGrowthRows),
  ]);
  const byContestType: Record<string, AdminDashboardGraphData> = {};
  for (const filter of contestTypeFilters) {
    byContestType[filter] = buildGraphForFilterFromSql(
      filter,
      sqlGraphData.dailyGrowthRows,
      sqlGraphData.dailyCreatorsRows,
    );
  }

  return { userGrowth, byContestType };
}

/** Contest types present in submission aggregates but not orphaned rows (null contest_type). */
function knownContestTypesFromGrowthRows(rows: SqlDailyGrowthRow[]): string[] {
  return [
    ...new Set(
      rows
        .map((row) => row.contest_type)
        .filter((type): type is string => Boolean(type)),
    ),
  ];
}

async function loadAdminDashboardCacheEntry(): Promise<AdminDashboardCacheData> {
  return loadAdminDashboardCache();
}

async function getCachedAdminDashboardCache(): Promise<AdminDashboardCacheData> {
  return unstable_cache(
    () => loadAdminDashboardCacheEntry(),
    [ADMIN_DASHBOARD_CACHE_TAG],
    {
      revalidate: ADMIN_DASHBOARD_GRAPH_CACHE_SECONDS,
      tags: [ADMIN_DASHBOARD_CACHE_TAG],
    },
  )();
}

/** Single 30-min cache for all admin dashboard graph series (users + submissions/views per contest type). */
export async function getCachedAdminDashboardData(
  contestTypeFilter: string,
): Promise<AdminDashboardGraphData & { userGrowth: AdminUserGrowthSeries }> {
  const cache = await getCachedAdminDashboardCache();
  const graph =
    cache.byContestType[contestTypeFilter] ?? cache.byContestType.all;

  return {
    userGrowth: cache.userGrowth,
    ...graph,
  };
}

/** @deprecated Use getCachedAdminDashboardData(contestTypeFilter).userGrowth */
export async function getCachedAdminUserGrowth(): Promise<AdminUserGrowthSeries> {
  const cache = await getCachedAdminDashboardCache();
  return cache.userGrowth;
}

/** @deprecated Use getCachedAdminDashboardData(contestTypeFilter) */
export async function getCachedAdminDashboardGraphData(
  contestTypeFilter: string,
): Promise<AdminDashboardGraphData> {
  const data = await getCachedAdminDashboardData(contestTypeFilter);
  return {
    submissionGrowth: data.submissionGrowth,
    viewsGrowth: data.viewsGrowth,
    submissionCreatorsByDay: data.submissionCreatorsByDay,
  };
}

/** @deprecated Use ADMIN_DASHBOARD_CACHE_TAG */
export function adminDashboardGraphCacheTag(_contestTypeFilter?: string) {
  return ADMIN_DASHBOARD_CACHE_TAG;
}

/** Bust the single admin dashboard graph cache after user/submission mutations. */
export function revalidateAdminDashboardCaches(): void {
  try {
    revalidateTag(ADMIN_DASHBOARD_CACHE_TAG);
  } catch (e) {
    console.warn("[admin-dashboard-graph-cache] revalidateTag failed:", e);
  }
  revalidateAdminAnalyticsCaches();
}
