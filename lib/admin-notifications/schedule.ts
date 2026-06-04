/** Parse `<input type="datetime-local">` value (always browser local wall clock). */
export function parseDatetimeLocalValue(value: string): Date | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Format a Date for `<input type="datetime-local">` in browser local time. */
export function toDatetimeLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Parse separate date + time fields as browser local time (not UTC toggle).
 * @deprecated Prefer datetime-local via parseDatetimeLocalValue
 */
export function parseScheduledAt(
  date: string,
  time: string,
  _timezoneLabel: "UTC" | "local",
): Date | null {
  if (!date.trim() || !time.trim()) return null;
  const normalizedTime =
    time.length === 5 && time.includes(":") ? `${time}:00` : time;
  const parsed = new Date(`${date}T${normalizedTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
