import { unstable_cache, revalidateTag } from "next/cache";
import { cache } from "react";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  addDaysToDateKey,
  buildSubmissionCreatorsByDay,
  formatGrowthDayLabel,
  formatGrowthWeekLabel,
  getGrowthDayKey,
  getGrowthMonthKey,
  getGrowthWeekKey,
  getGrowthYearKey,
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

export function buildStatusGrowth(
  records: { created_at: string; status: string; views?: number | null }[],
  mode: "count" | "views",
): AdminStatusGrowthSeries {
  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const byDayMap: Record<string, ReturnType<typeof emptyStatusBuckets>> = {};
  const byWeekMap: Record<string, ReturnType<typeof emptyStatusBuckets>> = {};
  const byMonthMap: Record<string, ReturnType<typeof emptyStatusBuckets>> = {};
  const byYearMap: Record<string, ReturnType<typeof emptyStatusBuckets>> = {};

  for (const record of records) {
    const d = new Date(record.created_at);
    if (d < twoYearsAgo) continue;
    const value = mode === "count" ? 1 : record.views || 0;

    const dayKey = getGrowthDayKey(d);
    const weekKey = getGrowthWeekKey(d);
    const monthKey = getGrowthMonthKey(d);
    const yearKey = getGrowthYearKey(d);

    if (!byDayMap[dayKey]) byDayMap[dayKey] = emptyStatusBuckets();
    addToStatusBuckets(byDayMap[dayKey], record.status, value);

    if (!byWeekMap[weekKey]) byWeekMap[weekKey] = emptyStatusBuckets();
    addToStatusBuckets(byWeekMap[weekKey], record.status, value);

    if (!byMonthMap[monthKey]) byMonthMap[monthKey] = emptyStatusBuckets();
    addToStatusBuckets(byMonthMap[monthKey], record.status, value);

    if (!byYearMap[yearKey]) byYearMap[yearKey] = emptyStatusBuckets();
    addToStatusBuckets(byYearMap[yearKey], record.status, value);
  }

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

function buildGraphForFilter(
  contestTypeFilter: string,
  contests: { id: string; contest_type: string }[],
  allSubmissions: Awaited<ReturnType<typeof loadAdminSubmissions>>,
): AdminDashboardGraphData {
  const contestsForFilter =
    contestTypeFilter === "all"
      ? contests
      : contests.filter((c) => c.contest_type === contestTypeFilter);
  const contestIdSet = new Set(contestsForFilter.map((c) => c.id));
  const filteredSubmissions =
    contestTypeFilter === "all"
      ? allSubmissions
      : allSubmissions.filter((s) => contestIdSet.has(s.contest_id));

  return {
    submissionGrowth: buildStatusGrowth(filteredSubmissions, "count"),
    viewsGrowth: buildStatusGrowth(filteredSubmissions, "views"),
    submissionCreatorsByDay: buildSubmissionCreatorsByDay(filteredSubmissions),
  };
}

async function loadAdminDashboardCache(): Promise<AdminDashboardCacheData> {
  const supabase = createAdminClient();
  const CHUNK = 1000;

  const [userGrowth, allSubmissions] = await Promise.all([
    loadAdminUserGrowth(),
    fetchAdminSubmissions(),
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

  const contestTypeFilters = new Set<string>([
    "all",
    ...contests.map((c) => c.contest_type).filter(Boolean),
  ]);
  const byContestType: Record<string, AdminDashboardGraphData> = {};
  for (const filter of contestTypeFilters) {
    byContestType[filter] = buildGraphForFilter(
      filter,
      contests,
      allSubmissions,
    );
  }

  return { userGrowth, byContestType };
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
}
