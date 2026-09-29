import { cn } from "@/lib/utils";

export type UiLeaderboardPeriod =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month";

export type Scope = "pending" | "verified" | "all";
export type BoardTab = "views" | "reels";
export type AdminPrimaryTab = "setup" | "live";

export type CompetitionEventRow = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  is_active: boolean;
  prize_amount_minor_units?: number | string | null;
  weekly_prize_minor_units?: number | string | null;
  monthly_prize_minor_units?: number | string | null;
  prize_currency?: string | null;
  phase: "live" | "upcoming" | "past";
};

export const CREATOR_PERIOD_OPTIONS: { value: UiLeaderboardPeriod; label: string }[] = [
  { value: "today", label: "Daily" },
  { value: "this_week", label: "Weekly" },
  { value: "this_month", label: "Monthly" },
];

export const ADMIN_PERIOD_OPTIONS: { value: UiLeaderboardPeriod; label: string }[] = [
  { value: "today", label: "Daily" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "Weekly" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "Monthly" },
  { value: "last_month", label: "Last month" },
];

export const PERIOD_HEADLINE: Record<UiLeaderboardPeriod, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_month: "Last month",
};

export const PERIOD_CHALLENGE_TITLE: Record<UiLeaderboardPeriod, string> = {
  today: "Daily Challenge",
  yesterday: "Daily Challenge",
  this_week: "Weekly Challenge",
  last_week: "Weekly Challenge",
  this_month: "Monthly Challenge",
  last_month: "Monthly Challenge",
};

export const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "all", label: "All" },
];

export function isPastLeaderboardPeriod(period: UiLeaderboardPeriod): boolean {
  return period === "yesterday" || period === "last_week" || period === "last_month";
}

export function prizeTierForPeriod(period: UiLeaderboardPeriod): "day" | "week" | "month" {
  if (period === "this_week" || period === "last_week") return "week";
  if (period === "this_month" || period === "last_month") return "month";
  return "day";
}

export function number(v: number) {
  return (v || 0).toLocaleString();
}

export function panelClassName(isDark: boolean) {
  return cn(
    "rounded-2xl border shadow-sm",
    isDark ? "bg-[#14052c] border-white/10" : "bg-white border-gray-200/90",
  );
}

export function formatPrize(amountMinorUnits: number, currency: string) {
  const code = currency.trim().toUpperCase();
  const numeric = amountMinorUnits / 100;
  const maxFrac = amountMinorUnits % 100 === 0 ? 0 : 2;
  if (!/^[A-Z]{3}$/.test(code)) {
    const digits = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFrac,
    }).format(numeric);
    return code.length > 0 ? `${code} ${digits}` : digits;
  }
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFrac,
    }).format(numeric);
  } catch {
    const digits = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFrac,
    }).format(numeric);
    return `${code} ${digits}`;
  }
}

export function formatContestInstantIst(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

export function formatIsoIstDetailed(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  });
}

export function fromNow(iso?: string) {
  if (!iso) return "just now";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "just now";
  const diffMin = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const hrs = Math.floor(diffMin / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function getHoursUntilIstMidnight() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  const nextMidnightUtcMs =
    Date.UTC(get("year"), get("month") - 1, get("day") + 1, 0, 0, 0) -
    330 * 60 * 1000;
  const diffMs = nextMidnightUtcMs - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

export function getTimeUntil(iso?: string | null) {
  const end = iso ? new Date(iso).getTime() : Number.NaN;
  if (!Number.isFinite(end)) return getHoursUntilIstMidnight();
  const diffMs = Math.max(0, end - Date.now());
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatForDatetimeLocal(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value || "00";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

export function parseIstDatetimeLocal(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return new Date(Number.NaN);
  const [, year, month, day, hour, minute] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    ) -
      330 * 60 * 1000,
  );
}

export function getDefaultEventWindow() {
  const starts = new Date();
  const ends = new Date(starts.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    startsLocal: formatForDatetimeLocal(starts),
    endsLocal: formatForDatetimeLocal(ends),
  };
}

export function effectivePrizeMinorForPeriod(
  activeEvent: Record<string, unknown> | null,
  period: UiLeaderboardPeriod,
): number {
  const eff = Number((activeEvent as { effectivePrizeMinorUnits?: number })?.effectivePrizeMinorUnits);
  if (Number.isFinite(eff) && !isPastLeaderboardPeriod(period)) return Math.round(eff);
  const daily = Number(
    (activeEvent as { prizeAmountMinorUnits?: number })?.prizeAmountMinorUnits ??
      (activeEvent as { prize_amount_minor_units?: number })?.prize_amount_minor_units ??
      5000,
  );
  const weekly = Number(
    (activeEvent as { weeklyPrizeMinorUnits?: number })?.weeklyPrizeMinorUnits ??
      (activeEvent as { weekly_prize_minor_units?: number })?.weekly_prize_minor_units ??
      daily,
  );
  const monthly = Number(
    (activeEvent as { monthlyPrizeMinorUnits?: number })?.monthlyPrizeMinorUnits ??
      (activeEvent as { monthly_prize_minor_units?: number })?.monthly_prize_minor_units ??
      daily,
  );
  const tier = prizeTierForPeriod(period);
  if (tier === "week") return weekly;
  if (tier === "month") return monthly;
  return daily;
}

export function snapshotWinnerPrize(
  w: Record<string, unknown>,
  boardMinor: number,
  boardCurrency: string,
): { minor: number; currency: string } {
  const prizeMinorUnits = Number(w?.prize_minor_units);
  if (Number.isFinite(prizeMinorUnits)) {
    return {
      minor: Math.round(prizeMinorUnits),
      currency: String(w.prize_currency || boardCurrency),
    };
  }
  const ev = w?.rules_json as { event?: Record<string, unknown> } | undefined;
  const e = ev?.event;
  const d = Number(e?.prizeAmountMinorUnits ?? e?.prize_amount_minor_units ?? boardMinor);
  const we = Number(e?.weeklyPrizeMinorUnits ?? e?.weekly_prize_minor_units ?? d);
  const mo = Number(e?.monthlyPrizeMinorUnits ?? e?.monthly_prize_minor_units ?? d);
  const tier = String(w.period || "day");
  const minor =
    tier === "week" ? Math.round(we) : tier === "month" ? Math.round(mo) : Math.round(d);
  return {
    minor,
    currency: String(e?.prizeCurrency || e?.prize_currency || boardCurrency),
  };
}

export function perReelMinVerifiedPhrase(minViewsPerReel: number) {
  const n = Number(minViewsPerReel || 0);
  return n === 1 ? "1 verified view" : `${number(n)} verified views`;
}

export function verifiedReelsPhrase(count: number) {
  const n = Math.round(Number(count || 0));
  return n === 1 ? `${number(n)} verified reel` : `${number(n)} verified reels`;
}

export function fmtEventRange(isoStart: string, isoEnd: string) {
  const opts: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  };
  return `${new Date(isoStart).toLocaleString("en-IN", opts)} → ${new Date(isoEnd).toLocaleString("en-IN", opts)}`;
}
