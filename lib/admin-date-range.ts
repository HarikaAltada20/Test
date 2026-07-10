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

/** Bucket timestamps into YYYY-MM-DD using the admin growth calendar (Kolkata). */
export function getGrowthDayKey(
  value: string | Date,
  tz: AdminGrowthTimezone = ADMIN_GROWTH_TIMEZONE,
): string {
  return getDateStrInTz(new Date(value), tz);
}

export function addDaysToDateKey(dateKey: string, days = 1): string {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, mo - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function formatGrowthDayLabel(dateKey: string): string {
  const [y, mo, d] = dateKey.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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
    (dateKey) =>
      map.get(dateKey) ??
      emptyPoint(dateKey),
  );
}
