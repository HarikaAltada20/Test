/** Admin dashboard growth charts bucket by UTC calendar days (matches Supabase timestamps). */
export const ADMIN_GROWTH_TIMEZONE = "utc" as const;
export type AdminGrowthTimezone = "utc" | "local";

export const KOLKATA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export function getDateStrInTz(
  date: Date,
  tz: AdminGrowthTimezone = ADMIN_GROWTH_TIMEZONE,
): string {
  if (tz === "utc") {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const kolkata = new Date(date.getTime() + KOLKATA_OFFSET_MS);
  const y = kolkata.getUTCFullYear();
  const mo = String(kolkata.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kolkata.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function getTimeStrInTz(
  date: Date,
  tz: AdminGrowthTimezone = ADMIN_GROWTH_TIMEZONE,
): string {
  if (tz === "utc") {
    const h = date.getUTCHours();
    const m = date.getUTCMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }
  const kolkata = new Date(date.getTime() + KOLKATA_OFFSET_MS);
  const h = kolkata.getUTCHours();
  const m = kolkata.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function parseTime12To24(timeStr: string): { h: number; m: number } | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

export function setTimeInTz(
  existing: Date,
  dateStr: string,
  timeStr: string,
  tz: AdminGrowthTimezone = ADMIN_GROWTH_TIMEZONE,
): Date | null {
  const parsed = parseTime12To24(timeStr);
  if (!parsed) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (!y || !mo || !d) return null;
  if (tz === "utc") {
    return new Date(Date.UTC(y, mo - 1, d, parsed.h, parsed.m, 0, 0));
  }
  const localKolkata = new Date(
    Date.UTC(y, mo - 1, d, parsed.h, parsed.m, 0, 0),
  );
  return new Date(localKolkata.getTime() - KOLKATA_OFFSET_MS);
}

/** Bucket timestamps into YYYY-MM-DD using UTC (admin growth calendar). */
export function getGrowthDayKey(
  value: string | Date,
  tz: AdminGrowthTimezone = ADMIN_GROWTH_TIMEZONE,
): string {
  return getDateStrInTz(new Date(value), tz);
}

/** Monday-start week key in UTC (YYYY-MM-DD of week start). */
export function getGrowthWeekKey(value: string | Date): string {
  const d = new Date(value);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff),
  );
  return getDateStrInTz(weekStart);
}

export function getGrowthMonthKey(value: string | Date): string {
  const d = new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getGrowthYearKey(value: string | Date): string {
  return String(new Date(value).getUTCFullYear());
}

export function utcDateFromDayKey(
  dateKey: string,
  endOfDay = false,
): Date {
  const [y, mo, d] = dateKey.split("-").map(Number);
  return endOfDay
    ? new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999))
    : new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

/** Inclusive day range for the last N calendar days (today included). */
export function dayRangeFromKeys(
  fromKey: string,
  toKey: string,
  tz: AdminGrowthTimezone = ADMIN_GROWTH_TIMEZONE,
): { from: Date; to: Date } {
  const from =
    setTimeInTz(new Date(), fromKey, "12:00 AM", tz) ??
    utcDateFromDayKey(fromKey);
  const to =
    setTimeInTz(new Date(), toKey, "11:59 PM", tz) ??
    utcDateFromDayKey(toKey, true);
  return { from, to };
}

export function getLastNDaysRange(
  days: number,
  tz: AdminGrowthTimezone = ADMIN_GROWTH_TIMEZONE,
): { from: Date; to: Date } {
  const todayKey = getGrowthDayKey(new Date(), tz);
  const fromKey = addDaysToDateKey(todayKey, -(days - 1));
  return dayRangeFromKeys(fromKey, todayKey, tz);
}

/** @deprecated Use getLastNDaysRange(days, "utc") */
export function getLastNDaysUtcRange(days: number): { from: Date; to: Date } {
  return getLastNDaysRange(days, "utc");
}

export function getMonthsAgoRange(
  months: number,
  tz: AdminGrowthTimezone = ADMIN_GROWTH_TIMEZONE,
): { from: Date; to: Date } {
  const todayKey = getGrowthDayKey(new Date(), tz);
  const [y, mo, d] = todayKey.split("-").map(Number);
  const fromAnchor = new Date(Date.UTC(y, mo - 1 - months, d));
  const fromKey = getGrowthDayKey(fromAnchor, tz);
  return dayRangeFromKeys(fromKey, todayKey, tz);
}

/** @deprecated Use getMonthsAgoRange(months, "utc") */
export function getUtcMonthsAgoRange(months: number): { from: Date; to: Date } {
  return getMonthsAgoRange(months, "utc");
}

export function addDaysToDateKey(dateKey: string, days = 1): string {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, mo - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function formatGrowthDayLabel(dateKey: string): string {
  const [y, mo, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatGrowthWeekLabel(weekKey: string): string {
  const [y, mo, d] = weekKey.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Inclusive list of calendar day keys between two dates (growth timezone). */
export function listGrowthDayKeys(
  from: Date,
  to: Date,
  tz: AdminGrowthTimezone = ADMIN_GROWTH_TIMEZONE,
): string[] {
  const keys: string[] = [];
  let cur = getDateStrInTz(from, tz);
  const end = getDateStrInTz(to, tz);
  while (cur <= end) {
    keys.push(cur);
    if (cur === end) break;
    cur = addDaysToDateKey(cur, 1);
  }
  return keys;
}

export function filterAndFillGrowthByRange<
  T extends { date: string; label: string },
>(points: T[], from: Date, to: Date, emptyPoint: (dateKey: string) => T): T[] {
  const fromStr = getDateStrInTz(from);
  const toStr = getDateStrInTz(to);
  const map = new Map(points.map((p) => [p.date, p]));
  return listGrowthDayKeys(from, to).map(
    (dateKey) => map.get(dateKey) ?? emptyPoint(dateKey),
  );
}

export type SubmissionCreatorsByDay = { date: string; creatorIds: string[] };

/** Distinct creator IDs per UTC day (compact vs shipping every submission row). */
export function buildSubmissionCreatorsByDay(
  records: { created_at: string; creator_id: string | null }[],
): SubmissionCreatorsByDay[] {
  const byDay = new Map<string, Set<string>>();
  const twoYearsAgo = new Date();
  twoYearsAgo.setUTCFullYear(twoYearsAgo.getUTCFullYear() - 2);

  for (const record of records) {
    if (!record.creator_id) continue;
    const d = new Date(record.created_at);
    if (d < twoYearsAgo) continue;
    const dayKey = getGrowthDayKey(d);
    if (!byDay.has(dayKey)) byDay.set(dayKey, new Set());
    byDay.get(dayKey)!.add(record.creator_id);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ids]) => ({ date, creatorIds: [...ids] }));
}

export function countUniqueCreatorsFromByDay(
  byDay: SubmissionCreatorsByDay[],
  from: Date,
  to: Date,
): number {
  const fromStr = getDateStrInTz(from);
  const toStr = getDateStrInTz(to);
  const ids = new Set<string>();
  for (const { date, creatorIds } of byDay) {
    if (date < fromStr || date > toStr) continue;
    for (const id of creatorIds) ids.add(id);
  }
  return ids.size;
}
