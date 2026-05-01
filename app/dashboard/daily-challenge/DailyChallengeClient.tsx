"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Award,
  Clock3,
  CheckCircle2,
  Crown,
  Eye,
  Flame,
  Loader2,
  Medal,
  PencilLine,
  RefreshCw,
  Trophy,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_ADMIN,
  DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_CREATOR,
} from "@/lib/constants";

type Period = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month";
type Scope = "pending" | "verified" | "all";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
];

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  last_week: "Last Week",
  this_month: "This Month",
  last_month: "Last Month",
};

const SNAPSHOT_PERIOD_LABELS: Record<string, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "all", label: "All" },
];

function number(v: number) {
  return (v || 0).toLocaleString();
}

function getHoursUntilIstMidnight() {
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

function getTimeUntil(iso?: string | null) {
  const end = iso ? new Date(iso).getTime() : Number.NaN;
  if (!Number.isFinite(end)) return getHoursUntilIstMidnight();
  const diffMs = Math.max(0, end - Date.now());
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${mins}m`;
}

function fromNow(iso?: string) {
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

function formatForDatetimeLocal(d: Date) {
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
  const y = value("year");
  const m = value("month");
  const day = value("day");
  const h = value("hour");
  const min = value("minute");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function parseIstDatetimeLocal(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  );
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

type CompetitionEventRow = {
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

type BoardTab = "views" | "reels";

function formatPrize(amountMinorUnits: number, currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase();
  const symbolByCurrency: Record<string, string> = {
    INR: "₹",
    USD: "$",
  };
  const amount = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: amountMinorUnits % 100 === 0 ? 0 : 2,
  }).format(amountMinorUnits / 100);
  return `${symbolByCurrency[normalizedCurrency] || `${normalizedCurrency} `}${amount}`;
}

/** Minor units shown for leaderboard / badges for the selected period (matches server effectivePrizeMinorUnits when present). */
function effectivePrizeMinorForPeriod(activeEvent: Record<string, unknown> | null, p: Period): number {
  const eff = Number((activeEvent as { effectivePrizeMinorUnits?: number })?.effectivePrizeMinorUnits);
  if (Number.isFinite(eff)) return Math.round(eff);
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
  if (p === "this_week" || p === "last_week") return weekly;
  if (p === "this_month" || p === "last_month") return monthly;
  return daily;
}

function snapshotWinnerPrize(
  w: Record<string, unknown>,
  boardMinor: number,
  boardCurrency: string,
): { minor: number; currency: string } {
  const prizeMinorUnits = Number(w?.prize_minor_units);
  if (Number.isFinite(prizeMinorUnits)) {
    return { minor: Math.round(prizeMinorUnits), currency: String(w.prize_currency || boardCurrency) };
  }
  const ev = w?.rules_json as { event?: Record<string, unknown> } | undefined;
  const e = ev?.event;
  const d = Number(
    e?.prizeAmountMinorUnits ?? e?.prize_amount_minor_units ?? boardMinor,
  );
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

function getDefaultEventWindow() {
  const starts = new Date();
  const ends = new Date(starts.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    startsLocal: formatForDatetimeLocal(starts),
    endsLocal: formatForDatetimeLocal(ends),
  };
}

export default function DailyChallengeClient({
  isAdmin,
}: {
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [period, setPeriod] = useState<Period>("today");
  const [scope, setScope] = useState<Scope>("verified");
  const [activeBoard, setActiveBoard] = useState<BoardTab>("views");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [winnersPage, setWinnersPage] = useState(1);
  const [winnersLimit, setWinnersLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [winners, setWinners] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesMessage, setRulesMessage] = useState<string | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventBootstrapMessage, setEventBootstrapMessage] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState(() => ({
    name: "Daily Challenge",
    ...getDefaultEventWindow(),
    prizeAmount: "50",
    weeklyPrizeAmount: "",
    monthlyPrizeAmount: "",
    prizeCurrency: "INR",
  }));
  const [competitionEvents, setCompetitionEvents] = useState<CompetitionEventRow[]>([]);
  const [loadingCompetitionEvents, setLoadingCompetitionEvents] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventDraft, setEditEventDraft] = useState<{
    name: string;
    startsLocal: string;
    endsLocal: string;
    is_active: boolean;
    prizeAmount: string;
    weeklyPrizeAmount: string;
    monthlyPrizeAmount: string;
    prizeCurrency: string;
  } | null>(null);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [eventsPanelMessage, setEventsPanelMessage] = useState<string | null>(null);
  const [adminRules, setAdminRules] = useState({
    viewsMinViews: "1000",
    reelsMinReels: "3",
    reelsMinViews: "1000",
    minViewsPerReel: "100",
    promoteNextEligible: false,
  });

  const load = async (fresh = false, throwOnError = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        period,
        scope,
        page: String(currentPage),
        limit: String(limit),
      });
      if (fresh) params.set("fresh", "1");
      const [leaderboardRes, winnersRes] = await Promise.all([
        fetch(`/api/competition/leaderboard?${params.toString()}`),
        fetch(`/api/competition/winners/daily?days=15&period=${period}`),
      ]);
      if (!leaderboardRes.ok) {
        const msg = await leaderboardRes.json();
        throw new Error(msg?.error || "Failed to load Daily Challenge");
      }
      const leaderboard = await leaderboardRes.json();
      if (!winnersRes.ok) {
        const msg = await winnersRes.json();
        throw new Error(msg?.error || "Failed to load Daily Challenge winners");
      }
      const winnersJson = await winnersRes.json();
      setPayload(leaderboard);
      setWinners(winnersJson.winners || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load Daily Challenge");
      if (throwOnError) throw e;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, scope, currentPage, limit]);

  useEffect(() => {
    setCurrentPage(1);
  }, [period, scope]);

  useLayoutEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      const currentMode = (modeElement?.getAttribute("data-mode") || "") as
        | "light"
        | "dark"
        | "";
      if (currentMode === "light" || currentMode === "dark") {
        setMode(currentMode);
      }
    };
    checkMode();
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = isAdmin
      ? "daily_challenge_refresh_admin"
      : "daily_challenge_refresh_creator";
    const saved = localStorage.getItem(key);
    if (saved) setLastRefreshAt(saved);
  }, [isAdmin]);

  const refreshNow = async () => {
    if (!canRefresh) return;
    setRefreshing(true);
    try {
      if (isAdmin) {
        const adminRefreshRes = await fetch("/api/admin/competition/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period }),
        });
        if (!adminRefreshRes.ok) {
          const msg = await adminRefreshRes.json().catch(() => ({}));
          throw new Error(msg?.error || "Failed to refresh Daily Challenge");
        }
      }
      await load(true, true);
      const nowIso = new Date().toISOString();
      setLastRefreshAt(nowIso);
      if (typeof window !== "undefined") {
        const key = isAdmin
          ? "daily_challenge_refresh_admin"
          : "daily_challenge_refresh_creator";
        localStorage.setItem(key, nowIso);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const me = payload?.me;
  const config = payload?.config;
  const selectedLiveEvent = competitionEvents.find(
    (event) =>
      event.phase === "live" &&
      event.is_active === true,
  );
  const selectedEvent = competitionEvents.find((event) => event.is_active === true);
  const hasActiveEvent = Boolean(
    (payload?.hasActiveEvent && payload?.config) || selectedLiveEvent,
  );
  const hasSelectedEvent = Boolean(selectedEvent || payload?.event);
  const isDark = mode === "dark";
  const rows = activeBoard === "views" ? payload?.topCreatorsByViews || [] : payload?.topCreatorsByReels || [];
  const pagination = payload?.pagination;
  const totalItems = pagination?.totalItems ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const lastUpdated = fromNow(payload?.generatedAt);
  const selectedPeriodLabel = PERIOD_LABELS[period];
  const endsIn = getTimeUntil(payload?.effectiveRange?.end);
  const activeEvent =
    (payload?.event || selectedLiveEvent || selectedEvent || null) as Record<string, unknown> | null;
  const prizeAmountMinorUnits = effectivePrizeMinorForPeriod(activeEvent, period);
  const prizeCurrency = String(
    (activeEvent as { prizeCurrency?: string })?.prizeCurrency ||
      (activeEvent as { prize_currency?: string })?.prize_currency ||
      "INR",
  );
  const prizeLabel = formatPrize(prizeAmountMinorUnits, prizeCurrency);
  const cooldownMs = isAdmin
    ? DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_ADMIN
    : DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_CREATOR;
  const elapsedMs = lastRefreshAt
    ? Date.now() - new Date(lastRefreshAt).getTime()
    : Number.POSITIVE_INFINITY;
  const remainingMs = Math.max(0, cooldownMs - Math.max(0, elapsedMs));
  const canRefresh = remainingMs <= 0 && !refreshing;
  const cooldownText =
    remainingMs <= 0
      ? "Refresh available"
      : `${Math.ceil(remainingMs / 60000)}m cooldown`;
  const panelClass = cn(
    "rounded-2xl border shadow-sm",
    isDark ? "bg-[#14052c] border-white/10" : "bg-white border-gray-200/90",
  );

  const formatSecondary = (row: any) => {
    const reelsTotal = Number(row.verifiedReels || 0) + Number(row.pendingReels || 0);
    const viewsTotal = Number(row.verifiedViews || 0) + Number(row.pendingViews || 0);
    return `Reels - ${number(reelsTotal)} (${number(row.verifiedReels)} verified / ${number(
      row.pendingReels,
    )} pending) • Views - ${number(viewsTotal)} (${number(row.verifiedViews)} verified / ${number(
      row.pendingViews,
    )} pending)`;
  };

  useEffect(() => {
    if (!config) return;
    setAdminRules({
      viewsMinViews: String(Number(config.viewsMinViews ?? 1000)),
      reelsMinReels: String(Number(config.reelsMinReels ?? 3)),
      reelsMinViews: String(Number(config.reelsMinViews ?? 1000)),
      minViewsPerReel: String(Number(config.minViewsPerReel ?? 100)),
      promoteNextEligible: Boolean(config.promoteNextEligible),
    });
  }, [config]);

  const loadCompetitionEvents = async () => {
    if (!isAdmin) return;
    setLoadingCompetitionEvents(true);
    setEventsPanelMessage(null);
    try {
      const res = await fetch("/api/admin/competition/events");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load competition windows");
      setCompetitionEvents(json.events || []);
    } catch (e: any) {
      setEventsPanelMessage(e?.message || "Failed to load competition windows");
    } finally {
      setLoadingCompetitionEvents(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadCompetitionEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const createCompetitionEvent = async () => {
    if (!isAdmin || creatingEvent) return;
    setCreatingEvent(true);
    setEventBootstrapMessage(null);
    try {
      const startsAt = parseIstDatetimeLocal(eventForm.startsLocal);
      const endsAt = parseIstDatetimeLocal(eventForm.endsLocal);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        throw new Error("Invalid start or end date");
      }
      if (endsAt.getTime() <= startsAt.getTime()) {
        throw new Error("End date must be after start date");
      }
      const dailyMu = Math.max(0, Math.round(Number(eventForm.prizeAmount || 0) * 100));
      const payloadBody: Record<string, unknown> = {
        name: eventForm.name.trim() || "Daily Challenge",
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        prizeAmountMinorUnits: dailyMu,
        prizeCurrency: eventForm.prizeCurrency,
      };
      const wWeekly = eventForm.weeklyPrizeAmount.trim();
      if (wWeekly !== "") {
        payloadBody.weeklyPrizeMinorUnits = Math.max(0, Math.round(Number(wWeekly || 0) * 100));
      }
      const wMonthly = eventForm.monthlyPrizeAmount.trim();
      if (wMonthly !== "") {
        payloadBody.monthlyPrizeMinorUnits = Math.max(0, Math.round(Number(wMonthly || 0) * 100));
      }

      const res = await fetch("/api/admin/competition/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create competition");
      setEventBootstrapMessage("Competition created. You can adjust eligibility rules below.");
      await load(true);
      await loadCompetitionEvents();
    } catch (e: any) {
      setEventBootstrapMessage(e?.message || "Failed to create competition");
    } finally {
      setCreatingEvent(false);
    }
  };

  const beginEditEvent = (row: CompetitionEventRow) => {
    setEditingEventId(row.id);
    const dailyMu = Number(row.prize_amount_minor_units ?? 5000);
    const weeklyMu = Number(row.weekly_prize_minor_units ?? dailyMu);
    const monthlyMu = Number(row.monthly_prize_minor_units ?? dailyMu);
    setEditEventDraft({
      name: row.name,
      startsLocal: formatForDatetimeLocal(new Date(row.starts_at)),
      endsLocal: formatForDatetimeLocal(new Date(row.ends_at)),
      is_active: row.is_active,
      prizeAmount: String(dailyMu / 100),
      weeklyPrizeAmount: String(weeklyMu / 100),
      monthlyPrizeAmount: String(monthlyMu / 100),
      prizeCurrency: row.prize_currency || "INR",
    });
    setEventsPanelMessage(null);
  };

  const cancelEditEvent = () => {
    setEditingEventId(null);
    setEditEventDraft(null);
  };

  const saveEditedEvent = async (id: string, makeSoleActive?: boolean) => {
    if (!editEventDraft || savingEventId) return;
    setSavingEventId(id);
    setEventsPanelMessage(null);
    try {
      const starts = parseIstDatetimeLocal(editEventDraft.startsLocal);
      const ends = parseIstDatetimeLocal(editEventDraft.endsLocal);
      if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
        throw new Error("Invalid start or end date");
      }
      const res = await fetch(`/api/admin/competition/event/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editEventDraft.name.trim() || "Daily Challenge",
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          is_active: editEventDraft.is_active,
          makeSoleActive: makeSoleActive === true,
          prizeAmountMinorUnits: Math.max(0, Math.round(Number(editEventDraft.prizeAmount || 0) * 100)),
          weeklyPrizeMinorUnits: Math.max(
            0,
            Math.round(Number(editEventDraft.weeklyPrizeAmount || 0) * 100),
          ),
          monthlyPrizeMinorUnits: Math.max(
            0,
            Math.round(Number(editEventDraft.monthlyPrizeAmount || 0) * 100),
          ),
          prizeCurrency: editEventDraft.prizeCurrency,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update competition");
      setEventsPanelMessage("Competition window updated.");
      cancelEditEvent();
      await load(true);
      await loadCompetitionEvents();
    } catch (e: any) {
      setEventsPanelMessage(e?.message || "Failed to update competition");
    } finally {
      setSavingEventId(null);
    }
  };

  const saveEligibilityRules = async () => {
    if (!isAdmin || savingRules || !hasSelectedEvent) return;
    setSavingRules(true);
    setRulesMessage(null);
    try {
      const res = await fetch("/api/admin/competition/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewsMinViews: Number(adminRules.viewsMinViews || 0),
          reelsMinReels: Number(adminRules.reelsMinReels || 0),
          reelsMinViews: Number(adminRules.reelsMinViews || 0),
          minViewsPerReel: Number(adminRules.minViewsPerReel || 0),
          promoteNextEligible: adminRules.promoteNextEligible,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save eligibility rules");
      setRulesMessage("Eligibility rules updated.");
      await load(true);
      await loadCompetitionEvents();
    } catch (e: any) {
      setRulesMessage(e?.message || "Failed to save eligibility rules");
    } finally {
      setSavingRules(false);
    }
  };

  const eventsByPhase = {
    live: competitionEvents.filter((e) => e.phase === "live"),
    upcoming: competitionEvents.filter((e) => e.phase === "upcoming"),
    past: competitionEvents.filter((e) => e.phase === "past"),
  };

  const fmtEventRange = (isoStart: string, isoEnd: string) => {
    const opts: Intl.DateTimeFormatOptions = {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    };
    return `${new Date(isoStart).toLocaleString("en-IN", opts)} → ${new Date(isoEnd).toLocaleString("en-IN", opts)}`;
  };

  const fmtWinnerPeriod = (row: any) => {
    const label = SNAPSHOT_PERIOD_LABELS[row?.period || "day"] || "Period";
    if (row?.period_start && row?.period_end) {
      return `${label} • ${fmtEventRange(row.period_start, row.period_end)}`;
    }
    return `${label} • ${row?.snapshot_date || "Snapshot"}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 space-y-6">
      <div>
        <div className={cn(panelClass, "relative overflow-hidden p-5 sm:p-6 md:p-7")}>
          <div className="relative">
            <div className="flex items-center gap-2.5 sm:gap-3 mb-2.5">
              <div className="p-1.5">
                <Flame
                  className={cn(
                    "w-6 h-6 sm:w-7 sm:h-7",
                    isDark ? "text-white" : "text-gray-900",
                  )}
                />
              </div>
              <h1
                className={cn(
                  "text-3xl sm:text-4xl font-bold leading-tight tracking-tight",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Daily Challenge
              </h1>
            </div>
            <p
              className={cn(
                "text-sm sm:text-base leading-relaxed max-w-4xl",
                isDark ? "text-gray-300" : "text-gray-700",
              )}
            >
              Compete across daily, weekly, and monthly windows for two independent trophies: Most Views and Most
              Verified Reels. Refreshes hourly; eligibility affects winners, not visibility.
            </p>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className={cn("rounded-xl px-3.5 py-3 border", isDark ? "border-violet-500/25 bg-violet-500/10" : "border-violet-200/90 bg-violet-50/80")}>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Expected Earning</p>
                <p className="font-semibold flex items-center gap-1.5 mt-1">
                  <Trophy className="w-4 h-4" /> {selectedPeriodLabel}: 2 winners • {prizeLabel} each
                </p>
              </div>
              <div className={cn("rounded-xl px-3.5 py-3 border", isDark ? "border-amber-500/25 bg-amber-500/10" : "border-amber-200/90 bg-amber-50/80")}>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Period Ends</p>
                <p className="font-semibold flex items-center gap-1.5 mt-1">
                  <Clock3 className="w-4 h-4" /> Ends in {endsIn}
                </p>
              </div>
              <div className={cn("rounded-xl px-3.5 py-3 border", isDark ? "border-emerald-500/25 bg-emerald-500/10" : "border-emerald-200/90 bg-emerald-50/80")}>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Motivation</p>
                <p className="font-semibold mt-1">
                  Daily: locks the whole previous IST day (job ~00:05 IST) · Weekly Sun UTC · Monthly (IST rollover)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={cn(panelClass, "py-4 px-3 sm:px-4")}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:items-end">
            <div className="space-y-1">
              <p className={cn("text-[11px] font-semibold uppercase tracking-wider", isDark ? "text-gray-300" : "text-gray-500")}>
                Time range
              </p>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger isDark={isDark} className="h-10 text-sm">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent isDark={isDark}>
                  {PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} isDark={isDark}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className={cn("text-[11px] font-semibold uppercase tracking-wider", isDark ? "text-gray-300" : "text-gray-500")}>
                Submission status
              </p>
              <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                <SelectTrigger isDark={isDark} className="h-10 text-sm">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent isDark={isDark}>
                  {SCOPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} isDark={isDark}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 w-full md:w-auto md:justify-self-end md:min-w-[170px]">
              <Button
                size="sm"
                variant="outline"
                onClick={refreshNow}
                disabled={!canRefresh}
                className="border-gray-500 h-10 w-full md:w-auto rounded-lg inline-flex items-center justify-center gap-1"
              >
                {refreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isAdmin ? "Refresh now" : "Refresh"}
              </Button>
              <div className="text-[11px] text-muted-foreground text-center md:text-right space-y-0.5">
                <p>Updated {lastUpdated}</p>
                <p>{cooldownText}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!hasActiveEvent && !loading && !error && (
        <div
          className={cn(
            "rounded-2xl border p-4 sm:p-5 flex gap-3",
            isDark ? "border-amber-400/35 bg-amber-500/10" : "border-amber-200 bg-amber-50/90",
          )}
        >
          <AlertCircle className={cn("w-5 h-5 shrink-0 mt-0.5", isDark ? "text-amber-200" : "text-amber-700")} />
          <div className="min-w-0">
            <p className={cn("font-semibold", isDark ? "text-amber-50" : "text-amber-950")}>
              No Daily Challenge results
            </p>
            <p className={cn("text-sm mt-1.5 leading-relaxed", isDark ? "text-amber-100/90" : "text-amber-900/85")}>
              {isAdmin ? (
                <>
                  There is no selected competition event covering this period. Use{" "}
                  <span className="font-medium">Competition windows</span> below to create one or mark one as selected
                  for the leaderboard.
                </>
              ) : (
                <>
                  There isn&apos;t a Daily Challenge event covering this period, so rankings and eligibility are paused.
                  Check another time range or come back once the next event opens.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {isAdmin && (
        <Card className={panelClass}>
          <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Competition windows</CardTitle>
              <p className="text-xs text-muted-foreground mt-1 font-normal">
                Launch Daily Challenge events with a start/end date and prize. Only one selected event can drive the
                creator leaderboard at a time; dates decide whether it is upcoming, live, or ended.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={loadCompetitionEvents} disabled={loadingCompetitionEvents}>
              {loadingCompetitionEvents ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reload windows"}
            </Button>
          </CardHeader>
          <CardContent className="pt-1 space-y-6 text-sm">
            {!hasSelectedEvent && (
              <p className="text-xs text-amber-600 dark:text-amber-400 rounded-lg border border-amber-200/80 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 px-3 py-2">
                No event is selected for the leaderboard. Create one below, or select an event by editing it.
              </p>
            )}

            <div
              className={cn(
                "space-y-3 rounded-xl border p-3.5",
                isDark ? "border-white/10" : "border-gray-200",
              )}
            >
              <p className="text-sm font-semibold">Create new window</p>
              <p className="text-xs text-muted-foreground">
                Choose when this Daily Challenge event starts and ends. If it is selected for leaderboard and today's
                date is inside this window, creators will see it as the live Daily Challenge.
              </p>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Event name</p>
                <Input
                  value={eventForm.name}
                  onChange={(e) => setEventForm((p) => ({ ...p, name: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Start date & time (IST)</p>
                  <Input
                    type="datetime-local"
                    value={eventForm.startsLocal}
                    onChange={(e) => setEventForm((p) => ({ ...p, startsLocal: e.target.value }))}
                    className="h-10 text-sm"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">End date & time (IST)</p>
                  <Input
                    type="datetime-local"
                    value={eventForm.endsLocal}
                    onChange={(e) => setEventForm((p) => ({ ...p, endsLocal: e.target.value }))}
                    className="h-10 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Daily prize per winner</p>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={eventForm.prizeAmount}
                      onChange={(e) => setEventForm((p) => ({ ...p, prizeAmount: e.target.value }))}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Weekly prize (optional, defaults to daily)
                    </p>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={eventForm.weeklyPrizeAmount}
                      onChange={(e) => setEventForm((p) => ({ ...p, weeklyPrizeAmount: e.target.value }))}
                      className="h-10 text-sm"
                      placeholder="Same as daily"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Monthly prize (optional, defaults to daily)
                    </p>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={eventForm.monthlyPrizeAmount}
                      onChange={(e) => setEventForm((p) => ({ ...p, monthlyPrizeAmount: e.target.value }))}
                      className="h-10 text-sm"
                      placeholder="Same as daily"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Currency</p>
                  <Input
                    value={eventForm.prizeCurrency}
                    onChange={(e) => setEventForm((p) => ({ ...p, prizeCurrency: e.target.value.toUpperCase().slice(0, 3) }))}
                    className="h-10 text-sm"
                  />
                </div>
              </div>
              <Button onClick={createCompetitionEvent} disabled={creatingEvent} className="w-full sm:w-auto">
                {creatingEvent ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Launch Daily Challenge event
              </Button>
              {eventBootstrapMessage && (
                <p
                  className={cn(
                    "text-xs",
                    eventBootstrapMessage.toLowerCase().includes("fail") ? "text-red-500" : "text-emerald-600",
                  )}
                >
                  {eventBootstrapMessage}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">All events</p>
              {loadingCompetitionEvents ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading…
                </div>
              ) : competitionEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No rows in competition_event yet.</p>
              ) : (
                <div className="space-y-6">
                  {(
                    [
                      { key: "live" as const, label: "Live now" },
                      { key: "upcoming" as const, label: "Upcoming" },
                      { key: "past" as const, label: "Past" },
                    ] as const
                  ).map(({ key, label }) => {
                    const items = eventsByPhase[key];
                    if (items.length === 0) return null;
                    return (
                      <div key={key}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {label}
                        </p>
                        <div className="mt-2 space-y-2">
                          {items.map((row) => (
                            <div
                              key={row.id}
                              className={cn(
                                "rounded-xl border p-3 space-y-2",
                                isDark ? "border-white/10 bg-white/[0.03]" : "border-gray-200 bg-gray-50/50",
                              )}
                            >
                              {editingEventId === row.id && editEventDraft ? (
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Name</p>
                                    <Input
                                      value={editEventDraft.name}
                                      onChange={(e) =>
                                        setEditEventDraft((d) => (d ? { ...d, name: e.target.value } : d))
                                      }
                                      className="h-10 text-sm"
                                    />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Starts (IST)</p>
                                      <Input
                                        type="datetime-local"
                                        value={editEventDraft.startsLocal}
                                        onChange={(e) =>
                                          setEditEventDraft((d) =>
                                            d ? { ...d, startsLocal: e.target.value } : d,
                                          )
                                        }
                                        className="h-10 text-sm"
                                      />
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Ends (IST)</p>
                                      <Input
                                        type="datetime-local"
                                        value={editEventDraft.endsLocal}
                                        onChange={(e) =>
                                          setEditEventDraft((d) =>
                                            d ? { ...d, endsLocal: e.target.value } : d,
                                          )
                                        }
                                        className="h-10 text-sm"
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
                                    <div className="space-y-2">
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Daily prize per winner</p>
                                        <Input
                                          type="number"
                                          min={0}
                                          step="0.01"
                                          value={editEventDraft.prizeAmount}
                                          onChange={(e) =>
                                            setEditEventDraft((d) => (d ? { ...d, prizeAmount: e.target.value } : d))
                                          }
                                          className="h-10 text-sm"
                                        />
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Weekly prize per winner</p>
                                        <Input
                                          type="number"
                                          min={0}
                                          step="0.01"
                                          value={editEventDraft.weeklyPrizeAmount}
                                          onChange={(e) =>
                                            setEditEventDraft((d) =>
                                              d ? { ...d, weeklyPrizeAmount: e.target.value } : d,
                                            )
                                          }
                                          className="h-10 text-sm"
                                        />
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Monthly prize per winner</p>
                                        <Input
                                          type="number"
                                          min={0}
                                          step="0.01"
                                          value={editEventDraft.monthlyPrizeAmount}
                                          onChange={(e) =>
                                            setEditEventDraft((d) =>
                                              d ? { ...d, monthlyPrizeAmount: e.target.value } : d,
                                            )
                                          }
                                          className="h-10 text-sm"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Currency</p>
                                      <Input
                                        value={editEventDraft.prizeCurrency}
                                        onChange={(e) =>
                                          setEditEventDraft((d) =>
                                            d ? { ...d, prizeCurrency: e.target.value.toUpperCase().slice(0, 3) } : d,
                                          )
                                        }
                                        className="h-10 text-sm"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                                    <span className="text-sm">Selected for leaderboard</span>
                                    <Switch
                                      checked={editEventDraft.is_active}
                                      onCheckedChange={(c) =>
                                        setEditEventDraft((d) => (d ? { ...d, is_active: Boolean(c) } : d))
                                      }
                                    />
                                  </div>
                                  <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => saveEditedEvent(row.id, false)}
                                      disabled={savingEventId === row.id}
                                    >
                                      {savingEventId === row.id ? (
                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                      ) : null}
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => saveEditedEvent(row.id, true)}
                                      disabled={savingEventId === row.id}
                                    >
                                      Select as active event
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={cancelEditEvent} type="button">
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium truncate">{row.name}</p>
                                      <Badge variant="outline" className="text-[10px] shrink-0">
                                        {row.phase === "live"
                                          ? "Live"
                                          : row.phase === "upcoming"
                                            ? "Upcoming"
                                            : "Ended"}
                                      </Badge>
                                      {row.is_active ? (
                                        <Badge className="text-[10px] shrink-0">Active</Badge>
                                      ) : null}
                                    </div>
                                    <p className="text-xs text-muted-foreground break-words">
                                      {fmtEventRange(row.starts_at, row.ends_at)} · {row.timezone}
                                      {" · "}D{" "}
                                      {formatPrize(
                                        Number(row.prize_amount_minor_units ?? 5000),
                                        row.prize_currency || "INR",
                                      )}{" "}
                                      · W{" "}
                                      {formatPrize(
                                        Number(
                                          row.weekly_prize_minor_units ?? row.prize_amount_minor_units ?? 5000,
                                        ),
                                        row.prize_currency || "INR",
                                      )}{" "}
                                      · M{" "}
                                      {formatPrize(
                                        Number(
                                          row.monthly_prize_minor_units ?? row.prize_amount_minor_units ?? 5000,
                                        ),
                                        row.prize_currency || "INR",
                                      )}{" "}
                                      (per winner)
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0"
                                    onClick={() => beginEditEvent(row)}
                                    type="button"
                                  >
                                    <PencilLine className="w-4 h-4 mr-1" />
                                    Edit
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {eventsPanelMessage && (
                <p
                  className={cn(
                    "text-xs",
                    eventsPanelMessage.toLowerCase().includes("fail") ? "text-red-500" : "text-emerald-600",
                  )}
                >
                  {eventsPanelMessage}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className={panelClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Eligibility Rules for Selected Event</CardTitle>
          </CardHeader>
          <CardContent className="pt-1 space-y-3">
            {!hasSelectedEvent && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Create or select a Daily Challenge event above before saving event-specific rules. Defaults are applied
                when an event is created.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Views winner min verified views</p>
                <Input
                  type="number"
                  min={0}
                  value={adminRules.viewsMinViews}
                  onChange={(e) => setAdminRules((prev) => ({ ...prev, viewsMinViews: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reels winner min verified reels</p>
                <Input
                  type="number"
                  min={0}
                  value={adminRules.reelsMinReels}
                  onChange={(e) => setAdminRules((prev) => ({ ...prev, reelsMinReels: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reels winner min verified views</p>
                <Input
                  type="number"
                  min={0}
                  value={adminRules.reelsMinViews}
                  onChange={(e) => setAdminRules((prev) => ({ ...prev, reelsMinViews: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Min views per reel for reels board</p>
                <Input
                  type="number"
                  min={0}
                  value={adminRules.minViewsPerReel}
                  onChange={(e) => setAdminRules((prev) => ({ ...prev, minViewsPerReel: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border px-3 py-2">
              <p className="text-sm">Promote next eligible when rank #1 is not eligible</p>
              <Switch
                checked={adminRules.promoteNextEligible}
                onCheckedChange={(checked) =>
                  setAdminRules((prev) => ({ ...prev, promoteNextEligible: Boolean(checked) }))
                }
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Changes are versioned and become effective immediately.
              </p>
              <Button
                onClick={saveEligibilityRules}
                disabled={savingRules || !hasSelectedEvent}
                className="sm:w-auto w-full"
              >
                {savingRules ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Save Rules
              </Button>
            </div>
            {rulesMessage && (
              <p className={cn("text-xs", rulesMessage.includes("Failed") ? "text-red-500" : "text-emerald-600")}>
                {rulesMessage}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {config && (
          <Card className={cn(panelClass, isAdmin ? "lg:col-span-3" : "")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Eligibility Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2.5 text-muted-foreground pt-1">
              <p>Views winner: at least <span className="font-semibold text-foreground">{number(config.viewsMinViews)}</span> verified views.</p>
              <p>
                Reels winner: at least <span className="font-semibold text-foreground">{number(config.reelsMinReels)}</span> verified reels and{" "}
                <span className="font-semibold text-foreground">{number(config.reelsMinViews)}</span> verified views.
              </p>
            </CardContent>
          </Card>
        )}

        {!isAdmin && (
          <Card className={cn("lg:col-span-2", panelClass)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Your Progress</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-3 text-sm pt-1">
              {!hasActiveEvent && (
                <p className="md:col-span-2 text-xs text-muted-foreground rounded-lg border px-3 py-2 bg-muted/30">
                  No Daily Challenge event covers this period. Ranks and eligibility below will populate when a matching
                  event is available.
                </p>
              )}
              <div className={cn("rounded-xl border p-3.5", isDark ? "border-white/10" : "border-gray-200")}>
                <p className="font-semibold">Views Board Rank #{me?.viewsRank ?? "-"}</p>
                <p className="text-muted-foreground mt-1">
                  {me?.remaining?.views || "Submit and verify reels to see your progress."}
                </p>
                <Badge
                  variant={String(me?.remaining?.views || "").toLowerCase().includes("eligible") ? "default" : "outline"}
                  className="mt-2 text-[10px]"
                >
                  {String(me?.remaining?.views || "").toLowerCase().includes("eligible")
                    ? "Eligible"
                    : "Needs more"}
                </Badge>
                {typeof me?.viewsRank === "number" && me.viewsRank > 3 && rows[2] && activeBoard === "views" && (
                  <p className="text-xs mt-2.5 text-violet-600">
                    You need {number(Math.max(0, (rows[2].totalViews || 0) - (me.views || 0)))} more views to reach #3.
                  </p>
                )}
              </div>
              <div className={cn("rounded-xl border p-3.5", isDark ? "border-white/10" : "border-gray-200")}>
                <p className="font-semibold">Reels Board Rank #{me?.reelsRank ?? "-"}</p>
                <p className="text-muted-foreground mt-1">
                  {me?.remaining?.reels || "Maintain daily consistency to climb faster."}
                </p>
                <Badge
                  variant={String(me?.remaining?.reels || "").toLowerCase().includes("eligible") ? "default" : "outline"}
                  className="mt-2 text-[10px]"
                >
                  {String(me?.remaining?.reels || "").toLowerCase().includes("eligible")
                    ? "Eligible"
                    : "Needs more"}
                </Badge>
                {typeof me?.reelsRank === "number" && me.reelsRank > 3 && rows[2] && activeBoard === "reels" && (
                  <p className="text-xs mt-2.5 text-violet-600">
                    You need {number(Math.max(0, (rows[2].totalReels || 0) - (me.reels || 0)))} more reels to reach #3.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className={panelClass}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Competition Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeBoard} onValueChange={(v) => setActiveBoard(v as BoardTab)}>
            <TabsList className="grid grid-cols-1 sm:grid-cols-2 gap-2 -mx-1 px-1">
              <TabsTrigger
                value="views"
                className={cn(
                  "border w-full text-xs sm:text-sm inline-flex items-center justify-center px-3 py-2 rounded-full transition-all duration-200",
                  isDark ? "text-white border-gray-500" : "text-gray-700 border-gray-600",
                )}
              >
                <Eye className="w-3 h-3 mr-1" />
                Views Leaderboard
              </TabsTrigger>
              <TabsTrigger
                value="reels"
                className={cn(
                  "border w-full text-xs sm:text-sm inline-flex items-center justify-center px-3 py-2 rounded-full transition-all duration-200",
                  isDark ? "text-white border-gray-500" : "text-gray-700 border-gray-600",
                )}
              >
                <Flame className="w-3 h-3 mr-1" />
                Reels Leaderboard
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {error ? (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-pulse">
                  <div className="h-4 w-36 sm:w-40 bg-gray-200 rounded" />
                  <div className="h-4 w-20 sm:w-24 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row: any) => (
                <div
                  key={`${activeBoard}-${row.creatorId}`}
                  className={cn(
                    "group relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 sm:p-4 rounded-xl border transition-all duration-200",
                    row.rank === 1
                      ? isDark
                        ? "bg-amber-500/10 border-amber-400/45 hover:border-amber-300"
                        : "bg-amber-50 border-amber-300 hover:shadow-lg"
                      : row.rank === 2
                        ? isDark
                          ? "bg-slate-500/10 border-slate-300/40 hover:border-slate-200"
                          : "bg-slate-50 border-slate-300 hover:shadow-lg"
                        : row.rank === 3
                          ? isDark
                            ? "bg-orange-500/10 border-orange-400/40 hover:border-orange-300"
                            : "bg-orange-50 border-orange-300 hover:shadow-lg"
                          : isDark
                      ? "bg-[#170337] border-white/10 hover:border-violet-400"
                      : "bg-white border-gray-200 hover:border-violet-300 hover:shadow-md",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 w-full">
                    <div
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold",
                        row.rank === 1
                          ? "border-amber-400 text-amber-700 bg-amber-100"
                          : row.rank === 2
                            ? "border-slate-400 text-slate-700 bg-slate-100"
                            : row.rank === 3
                              ? "border-orange-400 text-orange-700 bg-orange-100"
                          : isDark
                            ? "border-gray-500 text-gray-100"
                            : "border-gray-300 text-gray-700",
                      )}
                    >
                      {row.rank}
                    </div>
                    <Avatar className="w-10 h-10 ring-2 ring-violet-200">
                      <AvatarImage src={row.profilePictureUrl || undefined} />
                      <AvatarFallback>{(row.username || "A").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate flex items-center gap-2 flex-wrap">
                        {row.username}
                        {row.rank === 1 && row.trophy && (
                          <Badge className="text-[10px]">
                            <Medal className="w-3 h-3 mr-1" />
                            Winner
                          </Badge>
                        )}
                        {row.rank === 1 && row.trophy && (
                          <Badge variant="outline" className="text-[10px]">
                            Expected {prizeLabel}
                          </Badge>
                        )}
                        {row.rank === 1 && !row.trophy && (
                          <Badge variant="outline" className="text-[10px]">
                            Not eligible
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed break-words sm:truncate">
                        {formatSecondary(row)}
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0 min-w-[110px] w-full sm:w-auto">
                    <p className="text-xl sm:text-2xl font-bold leading-none">
                      {activeBoard === "views"
                        ? `${number(row.totalViews)} views`
                        : `${number(row.totalReels)} reels`}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {activeBoard === "views"
                        ? `${number(row.totalReels)} reels`
                        : `${number(row.totalViews)} views`}
                    </p>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="py-10 sm:py-12 text-center px-2">
                  {!hasActiveEvent ? (
                    <>
                      <p className="text-base sm:text-lg font-semibold tracking-tight">Leaderboard paused</p>
                      <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                        The Daily Challenge is not running at the moment. When the next season opens, verified
                        submissions in the window will rank here again.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base sm:text-lg font-semibold tracking-tight">Be the first to take the lead</p>
                      <p className="text-sm text-muted-foreground mt-1.5">
                        Upload one strong reel today and climb into the winners zone.
                      </p>
                      <Button asChild className="mt-5 rounded-lg w-full sm:w-auto">
                        <Link
                          href="/dashboard/opportunities"
                          className="inline-flex items-center justify-center w-full sm:w-auto"
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Upload your first reel
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {!loading && !error && rows.length > 0 && totalPages > 0 && (
            <div className={cn("border-t pt-4 sm:pt-6 mt-4 sm:mt-6", isDark ? "border-white/10" : "border-gray-200")}>
              <PaginationControls
                page={currentPage}
                limit={limit}
                isDark={isDark}
                total={totalItems}
                totalPages={totalPages}
                hasNextPage={currentPage < totalPages}
                hasPreviousPage={currentPage > 1}
                onPageChange={setCurrentPage}
                onLimitChange={setLimit}
                loading={loading}
                hide200Option
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={panelClass}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Winners (Recent)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {winners.length === 0 ? (
            <div className="py-8 text-sm text-muted-foreground text-center">
              No winner snapshots yet. Winners are locked after each configured period closes.
            </div>
          ) : (
            (() => {
              const totalWinners = winners.length;
              const winnersTotalPages = Math.max(1, Math.ceil(totalWinners / winnersLimit));
              const offset = (winnersPage - 1) * winnersLimit;
              const pageRows = winners.slice(offset, offset + winnersLimit);
              return (
                <>
                  {pageRows.map((w) =>
                    (() => {
                      const verifiedViews = Number(
                        w?.metrics_json?.verifiedViews ?? w?.metrics_json?.totalViews ?? 0,
                      );
                      const verifiedReels = Number(
                        w?.metrics_json?.verifiedReels ?? w?.metrics_json?.totalReels ?? 0,
                      );
                      const hasWinner = Boolean(w?.winner_creator_id) && Boolean(w?.is_eligible);
                      const winnerName = hasWinner
                        ? w?.metrics_json?.username || w?.metrics_json?.fullName || "Winner"
                        : "N/A";
                      const { minor: snapMinor, currency: snapCur } = snapshotWinnerPrize(
                        w as Record<string, unknown>,
                        prizeAmountMinorUnits,
                        prizeCurrency,
                      );
                      const rewardLabel = formatPrize(snapMinor, snapCur);
                      const statsSuffix =
                        w.category === "views"
                          ? ` • ${number(verifiedViews)} verified views • ${number(verifiedReels)} verified reels`
                          : ` • ${number(verifiedReels)} verified reels • ${number(verifiedViews)} verified views`;
                      return (
                        <div
                          key={w.id}
                          className={cn(
                            "border rounded-xl p-3.5 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
                            isDark ? "border-white/10" : "border-gray-200",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="font-medium">
                              {fmtWinnerPeriod(w)} - <span className="capitalize">{w.category}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 break-words sm:truncate">
                              Winner:{" "}
                              <span className="font-medium text-foreground">{winnerName}</span>
                              {statsSuffix}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <Badge variant="outline" className="whitespace-nowrap">
                              {hasWinner ? `Earned ${rewardLabel}` : "No earning"}
                            </Badge>
                            <Badge variant={hasWinner ? "default" : "outline"}>
                              {hasWinner ? "Winner Locked" : "No Eligible Winner"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })(),
                  )}
                  {totalWinners > 0 && winnersTotalPages > 1 && (
                    <div className={cn("border-t pt-4 mt-4", isDark ? "border-white/10" : "border-gray-200")}>
                      <PaginationControls
                        page={winnersPage}
                        limit={winnersLimit}
                        isDark={isDark}
                        total={totalWinners}
                        totalPages={winnersTotalPages}
                        hasNextPage={winnersPage < winnersTotalPages}
                        hasPreviousPage={winnersPage > 1}
                        onPageChange={setWinnersPage}
                        onLimitChange={(n) => {
                          setWinnersLimit(n);
                          setWinnersPage(1);
                        }}
                        loading={false}
                        hide200Option
                        pageSizeOptions={[5, 10, 25, 50]}
                      />
                    </div>
                  )}
                </>
              );
            })()
          )}
        </CardContent>
      </Card>
    </div>
  );
}
