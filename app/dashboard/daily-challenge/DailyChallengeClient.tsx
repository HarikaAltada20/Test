"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
  EnhancedTabsContent as TabsContent,
} from "@/components/ui/enhanced-tabs";
import { cn } from "@/lib/utils";
import {
  DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_ADMIN,
  DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_CREATOR,
} from "@/lib/constants";
import { ChallengeHero } from "@/components/daily-challenge/ChallengeHero";
import { ChallengeFilters } from "@/components/daily-challenge/ChallengeFilters";
import { CreatorProgressCard } from "@/components/daily-challenge/CreatorProgressCard";
import { LeaderboardPanel } from "@/components/daily-challenge/LeaderboardPanel";
import {
  RewardsOverview,
  type RewardsSummaryView,
  type TopCreatorView,
} from "@/components/daily-challenge/RewardsOverview";
import {
  WinnersArchive,
  type WinnerArchiveRow,
} from "@/components/daily-challenge/WinnersArchive";
import {
  ADMIN_PERIOD_OPTIONS,
  CREATOR_PERIOD_OPTIONS,
  PERIOD_CHALLENGE_TITLE,
  PERIOD_HEADLINE,
  SCOPE_OPTIONS,
  effectivePrizeMinorForPeriod,
  formatForDatetimeLocal,
  formatPrize,
  fromNow,
  getDefaultEventWindow,
  getTimeUntil,
  isPastLeaderboardPeriod,
  panelClassName,
  parseIstDatetimeLocal,
  type AdminPrimaryTab,
  type BoardTab,
  type CompetitionEventRow,
  type Scope,
  type UiLeaderboardPeriod,
  fmtEventRange,
} from "@/components/daily-challenge/utils";

export default function DailyChallengeClient({
  isAdmin,
}: {
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [leaderboardPeriod, setLeaderboardPeriod] =
    useState<UiLeaderboardPeriod>("today");
  const periodOptions = isAdmin ? ADMIN_PERIOD_OPTIONS : CREATOR_PERIOD_OPTIONS;
  const [scope, setScope] = useState<Scope>("verified");
  const [activeBoard, setActiveBoard] = useState<BoardTab>("views");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [winnersPage, setWinnersPage] = useState(1);
  const [winnersLimit, setWinnersLimit] = useState(10);
  const [archivePeriod, setArchivePeriod] = useState("all");
  const [archiveCategory, setArchiveCategory] = useState("all");
  const [archiveEventId, setArchiveEventId] = useState("all");
  const [archiveMonth, setArchiveMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [winnersLoading, setWinnersLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [winners, setWinners] = useState<WinnerArchiveRow[]>([]);
  const [winnersPagination, setWinnersPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0,
  });
  const [rewardsSummary, setRewardsSummary] = useState<RewardsSummaryView | null>(null);
  const [topCreators, setTopCreators] = useState<TopCreatorView[]>([]);
  const [archiveEvents, setArchiveEvents] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [refreshCooldownEndsAtMs, setRefreshCooldownEndsAtMs] = useState<number | null>(null);
  const [cooldownPollTick, setCooldownPollTick] = useState(0);
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
  const [countdownTick, setCountdownTick] = useState(0);
  const [adminPrimaryTab, setAdminPrimaryTab] = useState<AdminPrimaryTab>("live");

  useEffect(() => {
    const id = window.setInterval(() => setCountdownTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const latestQueryRef = useRef({
    leaderboardPeriod,
    scope,
    currentPage,
    limit,
  });
  latestQueryRef.current = { leaderboardPeriod, scope, currentPage, limit };
  const loadSeqRef = useRef(0);

  const loadLeaderboard = async (fresh = false, throwOnError = false): Promise<boolean> => {
    const seq = ++loadSeqRef.current;
    let freshGateConsumed = false;
    const captured = { leaderboardPeriod, scope, currentPage, limit };

    const responseStillRelevant = () => {
      const q = latestQueryRef.current;
      return (
        captured.leaderboardPeriod === q.leaderboardPeriod &&
        captured.scope === q.scope &&
        captured.currentPage === q.currentPage &&
        captured.limit === q.limit
      );
    };

    setLoading(true);
    setError(null);
    try {
      const baseQs = new URLSearchParams({
        period: captured.leaderboardPeriod,
        scope: captured.scope,
        page: String(captured.currentPage),
        limit: String(captured.limit),
      });
      let leaderboardParams = new URLSearchParams(baseQs);
      if (fresh) leaderboardParams.set("fresh", "1");

      let leaderboardRes = await fetch(
        `/api/competition/leaderboard?${leaderboardParams.toString()}`,
      );
      let recoveredFromFreshCooldown429 = false;
      if (leaderboardRes.status === 429 && fresh) {
        let body: {
          remainingMs?: number;
          nextRefreshAvailable?: string | null;
        } = {};
        try {
          body = await leaderboardRes.json();
        } catch {
          /* ignore */
        }
        const rem = Math.max(0, Number(body.remainingMs || 0));
        const next = body.nextRefreshAvailable
          ? new Date(body.nextRefreshAvailable).getTime()
          : Number.NaN;
        const endsMs =
          Number.isFinite(next) && next > Date.now() ? next : Date.now() + rem;
        setRefreshCooldownEndsAtMs(endsMs);
        recoveredFromFreshCooldown429 = true;
        leaderboardParams = new URLSearchParams(baseQs);
        leaderboardRes = await fetch(
          `/api/competition/leaderboard?${leaderboardParams.toString()}`,
        );
      }

      if (!leaderboardRes.ok) {
        const msg = await leaderboardRes.json().catch(() => ({}));
        throw new Error(msg?.error || "Failed to load Daily Challenge");
      }
      const leaderboard = await leaderboardRes.json();
      if (fresh && !recoveredFromFreshCooldown429) {
        setRefreshCooldownEndsAtMs(null);
      }
      freshGateConsumed = Boolean(fresh && !recoveredFromFreshCooldown429);

      if (!responseStillRelevant()) return false;
      setPayload(leaderboard);
    } catch (e: any) {
      freshGateConsumed = false;
      if (seq === loadSeqRef.current && responseStillRelevant()) {
        setError(e?.message || "Failed to load Daily Challenge");
        setPayload(null);
      }
      if (throwOnError) throw e;
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
    return freshGateConsumed;
  };

  const loadWinnersArchive = async () => {
    setWinnersLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(winnersPage),
        limit: String(winnersLimit),
      });
      if (archivePeriod !== "all") qs.set("period", archivePeriod);
      if (archiveCategory !== "all") qs.set("category", archiveCategory);
      if (archiveEventId !== "all") qs.set("event_id", archiveEventId);
      if (archiveMonth) qs.set("month", archiveMonth);

      const res = await fetch(`/api/competition/winners/daily?${qs.toString()}`);
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg?.error || "Failed to load winners archive");
      }
      const json = await res.json();
      setWinners(json.winners || []);
      setWinnersPagination(
        json.pagination || {
          page: winnersPage,
          limit: winnersLimit,
          totalItems: 0,
          totalPages: 0,
        },
      );
    } catch {
      setWinners([]);
      setWinnersPagination({
        page: winnersPage,
        limit: winnersLimit,
        totalItems: 0,
        totalPages: 0,
      });
    } finally {
      setWinnersLoading(false);
    }
  };

  const loadRewardsOverview = async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/competition/rewards/summary");
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg?.error || "Failed to load rewards overview");
      }
      const json = await res.json();
      setRewardsSummary(json.summary || null);
      setTopCreators(json.topCreators || []);
      setArchiveEvents(
        ((json.events || []) as Array<{ id: string; name: string | null }>).map((e) => ({
          id: e.id,
          name: e.name || "Daily Challenge",
        })),
      );
    } catch {
      setRewardsSummary(null);
      setTopCreators([]);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderboardPeriod, scope, currentPage, limit]);

  useEffect(() => {
    loadWinnersArchive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winnersPage, winnersLimit, archivePeriod, archiveCategory, archiveEventId, archiveMonth]);

  useEffect(() => {
    loadRewardsOverview();
  }, []);

  useLayoutEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      const currentMode = (modeElement?.getAttribute("data-mode") || "") as
        | "light"
        | "dark"
        | "";
      if (currentMode === "light" || currentMode === "dark") setMode(currentMode);
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

  useEffect(() => {
    const cooldownMsLocal = isAdmin
      ? DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_ADMIN
      : DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_CREATOR;
    let intervalId: number | undefined;
    const tick = () => {
      const now = Date.now();
      const serverRem = refreshCooldownEndsAtMs
        ? Math.max(0, refreshCooldownEndsAtMs - now)
        : 0;
      const clientRem = lastRefreshAt
        ? Math.max(0, cooldownMsLocal - Math.max(0, now - new Date(lastRefreshAt).getTime()))
        : 0;
      if (Math.max(serverRem, clientRem) <= 0) {
        if (intervalId !== undefined) clearInterval(intervalId);
        intervalId = undefined;
        return;
      }
      setCooldownPollTick((p) => p + 1);
    };
    const now0 = Date.now();
    const sr0 = refreshCooldownEndsAtMs
      ? Math.max(0, refreshCooldownEndsAtMs - now0)
      : 0;
    const cr0 = lastRefreshAt
      ? Math.max(0, cooldownMsLocal - Math.max(0, now0 - new Date(lastRefreshAt).getTime()))
      : 0;
    if (Math.max(sr0, cr0) <= 0) return undefined;
    intervalId = window.setInterval(tick, 1000) as unknown as number;
    tick();
    return () => {
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, [refreshCooldownEndsAtMs, lastRefreshAt, isAdmin]);

  const me = payload?.me;
  const config = payload?.config;
  const selectedLiveEvent = competitionEvents.find(
    (event) => event.phase === "live" && event.is_active === true,
  );
  const selectedEvent = competitionEvents.find((event) => event.is_active === true);
  const hasActiveEvent = Boolean(
    (payload?.hasActiveEvent && payload?.config) || selectedLiveEvent,
  );
  const hasSelectedEvent = Boolean(selectedEvent || payload?.event);
  const isDark = mode === "dark";
  const rows =
    activeBoard === "views"
      ? payload?.topCreatorsByViews || []
      : payload?.topCreatorsByReels || [];
  const pagination = payload?.pagination;
  const totalItems = pagination?.totalItems ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const lastLeaderboardFreshIso =
    typeof payload?.lastLeaderboardFreshAt === "string" &&
    payload.lastLeaderboardFreshAt.length > 0
      ? payload.lastLeaderboardFreshAt
      : null;
  const lastManualRefreshRelative = lastLeaderboardFreshIso
    ? fromNow(lastLeaderboardFreshIso)
    : null;
  const modeHeadline = PERIOD_HEADLINE[leaderboardPeriod];
  const challengeTitle = PERIOD_CHALLENGE_TITLE[leaderboardPeriod];
  const viewingPastPeriod = isPastLeaderboardPeriod(leaderboardPeriod);
  const scopeWindowLabel =
    scope === "verified" ? "Verified" : scope === "pending" ? "Pending" : "All";
  void countdownTick;
  const rangeEndIso =
    typeof payload?.effectiveRange?.end === "string" ? payload.effectiveRange.end : null;
  const rangeEnded = rangeEndIso ? new Date(rangeEndIso).getTime() <= Date.now() : false;
  const endsIn = rangeEndIso ? (rangeEnded ? "Ended" : getTimeUntil(rangeEndIso)) : "—";
  const activeEvent = (payload?.event ||
    selectedLiveEvent ||
    selectedEvent ||
    null) as Record<string, unknown> | null;
  const prizeAmountMinorUnits = effectivePrizeMinorForPeriod(activeEvent, leaderboardPeriod);
  const prizeCurrency = String(
    (activeEvent as { prizeCurrency?: string })?.prizeCurrency ||
      (activeEvent as { prize_currency?: string })?.prize_currency ||
      "INR",
  );
  const prizeLabel = formatPrize(prizeAmountMinorUnits, prizeCurrency);
  const totalPrizePoolLabel = formatPrize(
    Math.round(prizeAmountMinorUnits * 2),
    prizeCurrency,
  );
  const cooldownMs = isAdmin
    ? DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_ADMIN
    : DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_CREATOR;
  const elapsedMs = lastRefreshAt
    ? Date.now() - new Date(lastRefreshAt).getTime()
    : Number.POSITIVE_INFINITY;
  const remainingClientMs = Math.max(0, cooldownMs - Math.max(0, elapsedMs));
  const remainingServerMs = refreshCooldownEndsAtMs
    ? Math.max(0, refreshCooldownEndsAtMs - Date.now())
    : 0;
  const cooldownRemainingMs =
    Math.max(remainingClientMs, remainingServerMs) + cooldownPollTick * 0;
  const canRefresh = cooldownRemainingMs <= 0 && !refreshing;
  const cooldownMinsCeil = Math.max(1, Math.ceil(cooldownRemainingMs / 60000));
  const leaderboardMisaligned =
    payload != null && payload.period !== leaderboardPeriod;
  const showFullPageLoader = leaderboardMisaligned || (loading && payload === null);
  const panelClass = panelClassName(isDark);

  const refreshNow = async () => {
    if (!canRefresh) return;
    setRefreshing(true);
    try {
      const consumed = await loadLeaderboard(true, true);
      if (!consumed) return;
      const nowIso = new Date().toISOString();
      setLastRefreshAt(nowIso);
      if (typeof window !== "undefined") {
        const key = isAdmin
          ? "daily_challenge_refresh_admin"
          : "daily_challenge_refresh_creator";
        localStorage.setItem(key, nowIso);
      }
      await Promise.all([loadWinnersArchive(), loadRewardsOverview()]);
    } catch {
      /* keep last good leaderboard */
    } finally {
      setRefreshing(false);
    }
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
      if (eventForm.weeklyPrizeAmount.trim() !== "") {
        payloadBody.weeklyPrizeMinorUnits = Math.max(
          0,
          Math.round(Number(eventForm.weeklyPrizeAmount || 0) * 100),
        );
      }
      if (eventForm.monthlyPrizeAmount.trim() !== "") {
        payloadBody.monthlyPrizeMinorUnits = Math.max(
          0,
          Math.round(Number(eventForm.monthlyPrizeAmount || 0) * 100),
        );
      }

      const res = await fetch("/api/admin/competition/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create competition");
      setEventBootstrapMessage("Competition created. You can adjust eligibility rules below.");
      await loadLeaderboard(true);
      await loadCompetitionEvents();
      await loadRewardsOverview();
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
          prizeAmountMinorUnits: Math.max(
            0,
            Math.round(Number(editEventDraft.prizeAmount || 0) * 100),
          ),
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
      await loadLeaderboard(true);
      await loadCompetitionEvents();
      await loadRewardsOverview();
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
      await loadLeaderboard(true);
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

  if (showFullPageLoader) {
    return (
      <div
        className={cn(
          "max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 flex flex-col items-center justify-center gap-4 min-h-[52vh]",
          isDark ? "text-white" : "text-gray-900",
        )}
      >
        <Loader2 className="h-10 w-10 animate-spin text-violet-600 shrink-0" aria-hidden />
        <p className="text-sm sm:text-base text-muted-foreground text-center max-w-sm">
          Loading {challengeTitle}…
        </p>
      </div>
    );
  }

  const liveDashboard = (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-2xl border shadow-sm",
          isDark ? "border-white/10 bg-[#14052c]" : "border-slate-200 bg-white",
        )}
      >
        <ChallengeHero
          isDark={isDark}
          isAdmin={isAdmin}
          challengeTitle={challengeTitle}
          modeHeadline={modeHeadline}
          totalPrizePoolLabel={totalPrizePoolLabel}
          prizeLabel={prizeLabel}
          config={config}
          effectiveRange={payload?.effectiveRange || null}
          endsIn={endsIn}
          rangeEnded={rangeEnded}
          scopeWindowLabel={scopeWindowLabel}
        />

        <ChallengeFilters
          isDark={isDark}
          leaderboardPeriod={leaderboardPeriod}
          scope={scope}
          periodOptions={periodOptions}
          scopeOptions={SCOPE_OPTIONS}
          onPeriodChange={(v) => {
            setLeaderboardPeriod(v);
            setCurrentPage(1);
          }}
          onScopeChange={(v) => {
            setScope(v);
            setCurrentPage(1);
          }}
        />

        {!hasActiveEvent && !loading && !error && (
          <div
            className={cn(
              "mx-4 mt-5 flex gap-3 rounded-xl border p-4 sm:mx-6",
              isDark
                ? "border-amber-400/25 bg-amber-500/10"
                : "border-amber-200 bg-amber-50/90",
            )}
          >
            <AlertCircle
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0",
                isDark ? "text-amber-200" : "text-amber-700",
              )}
            />
            <div className="min-w-0">
              <p className={cn("font-semibold", isDark ? "text-amber-50" : "text-amber-950")}>
                No {challengeTitle} results
              </p>
              <p
                className={cn(
                  "mt-1.5 text-sm leading-relaxed",
                  isDark ? "text-amber-100/90" : "text-amber-900/85",
                )}
              >
                {isAdmin ? (
                  <>
                    There is no selected competition event covering this mode. Open{" "}
                    <span className="font-medium">Contest setup</span> to create or activate one.
                  </>
                ) : (
                  <>
                    There isn&apos;t an event for this mode yet. Try another mode or check back when
                    the next window opens.
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {!isAdmin && (
          <CreatorProgressCard
            isDark={isDark}
            hasActiveEvent={hasActiveEvent}
            me={me}
            activeBoard={activeBoard}
            thirdPlaceViews={rows[2]?.totalViews}
            thirdPlaceReels={rows[2]?.totalReels}
          />
        )}

        <LeaderboardPanel
          isDark={isDark}
          isAdmin={isAdmin}
          challengeTitle={challengeTitle}
          leaderboardPeriod={leaderboardPeriod}
          viewingPastPeriod={viewingPastPeriod}
          hasActiveEvent={hasActiveEvent}
          activeBoard={activeBoard}
          onBoardChange={setActiveBoard}
          rows={rows}
          prizeLabel={prizeLabel}
          loading={loading}
          error={error}
          refreshing={refreshing}
          canRefresh={canRefresh}
          cooldownRemainingMs={cooldownRemainingMs}
          cooldownMinsCeil={cooldownMinsCeil}
          lastManualRefreshRelative={lastManualRefreshRelative}
          lastLeaderboardFreshIso={lastLeaderboardFreshIso}
          onRefresh={refreshNow}
          currentPage={currentPage}
          limit={limit}
          totalItems={totalItems}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onLimitChange={(n) => {
            setLimit(n);
            setCurrentPage(1);
          }}
        />
      </div>

      <RewardsOverview
        isDark={isDark}
        loading={summaryLoading}
        summary={rewardsSummary}
        topCreators={topCreators}
      />

      <WinnersArchive
        isDark={isDark}
        loading={winnersLoading}
        winners={winners}
        page={winnersPagination.page}
        limit={winnersPagination.limit}
        totalItems={winnersPagination.totalItems}
        totalPages={winnersPagination.totalPages}
        periodFilter={archivePeriod}
        categoryFilter={archiveCategory}
        eventFilter={archiveEventId}
        monthFilter={archiveMonth}
        events={archiveEvents}
        boardPrizeMinor={prizeAmountMinorUnits}
        boardCurrency={prizeCurrency}
        onPeriodFilterChange={(v) => {
          setArchivePeriod(v);
          setWinnersPage(1);
        }}
        onCategoryFilterChange={(v) => {
          setArchiveCategory(v);
          setWinnersPage(1);
        }}
        onEventFilterChange={(v) => {
          setArchiveEventId(v);
          setWinnersPage(1);
        }}
        onMonthFilterChange={(v) => {
          setArchiveMonth(v);
          setWinnersPage(1);
        }}
        onPageChange={setWinnersPage}
        onLimitChange={(n) => {
          setWinnersLimit(n);
          setWinnersPage(1);
        }}
      />
    </>
  );

  const setupPanel = (
    <Card className={panelClass}>
      <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Competition windows</CardTitle>
          <p className="text-xs text-muted-foreground mt-1 font-normal">
            Launch Daily Challenge events with a start/end date and prize. Only one selected event
            can drive the creator leaderboard at a time.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadCompetitionEvents}
          disabled={loadingCompetitionEvents}
        >
          {loadingCompetitionEvents ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reload windows"}
        </Button>
      </CardHeader>
      <CardContent className="pt-1 space-y-6 text-sm">
        {!hasSelectedEvent && (
          <p className="text-xs text-amber-600 dark:text-amber-400 rounded-lg border border-amber-200/80 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 px-3 py-2">
            No event is selected for the leaderboard. Create one below, or select an event by
            editing it.
          </p>
        )}

        <div
          className={cn(
            "space-y-3 rounded-xl border p-3.5",
            isDark ? "border-white/10" : "border-gray-200",
          )}
        >
          <p className="text-sm font-semibold">Create new window</p>
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
                  onChange={(e) =>
                    setEventForm((p) => ({ ...p, weeklyPrizeAmount: e.target.value }))
                  }
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
                  onChange={(e) =>
                    setEventForm((p) => ({ ...p, monthlyPrizeAmount: e.target.value }))
                  }
                  className="h-10 text-sm"
                  placeholder="Same as daily"
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Currency</p>
              <Input
                value={eventForm.prizeCurrency}
                onChange={(e) =>
                  setEventForm((p) => ({
                    ...p,
                    prizeCurrency: e.target.value.toUpperCase().slice(0, 3),
                  }))
                }
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
                eventBootstrapMessage.toLowerCase().includes("fail")
                  ? "text-red-500"
                  : "text-emerald-600",
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
            <p className="text-sm text-muted-foreground py-2">No competition events yet.</p>
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
                            isDark
                              ? "border-white/10 bg-white/[0.03]"
                              : "border-gray-200 bg-gray-50/50",
                          )}
                        >
                          {editingEventId === row.id && editEventDraft ? (
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Name</p>
                                <Input
                                  value={editEventDraft.name}
                                  onChange={(e) =>
                                    setEditEventDraft((d) =>
                                      d ? { ...d, name: e.target.value } : d,
                                    )
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
                                    <p className="text-xs text-muted-foreground mb-1">
                                      Daily prize per winner
                                    </p>
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={editEventDraft.prizeAmount}
                                      onChange={(e) =>
                                        setEditEventDraft((d) =>
                                          d ? { ...d, prizeAmount: e.target.value } : d,
                                        )
                                      }
                                      className="h-10 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">
                                      Weekly prize per winner
                                    </p>
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
                                    <p className="text-xs text-muted-foreground mb-1">
                                      Monthly prize per winner
                                    </p>
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
                                        d
                                          ? {
                                              ...d,
                                              prizeCurrency: e.target.value
                                                .toUpperCase()
                                                .slice(0, 3),
                                            }
                                          : d,
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
                                    setEditEventDraft((d) =>
                                      d ? { ...d, is_active: Boolean(c) } : d,
                                    )
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
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditEvent}
                                  type="button"
                                >
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
                                      row.weekly_prize_minor_units ??
                                        row.prize_amount_minor_units ??
                                        5000,
                                    ),
                                    row.prize_currency || "INR",
                                  )}{" "}
                                  · M{" "}
                                  {formatPrize(
                                    Number(
                                      row.monthly_prize_minor_units ??
                                        row.prize_amount_minor_units ??
                                        5000,
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
                eventsPanelMessage.toLowerCase().includes("fail")
                  ? "text-red-500"
                  : "text-emerald-600",
              )}
            >
              {eventsPanelMessage}
            </p>
          )}
        </div>

        <div
          className={cn(
            "space-y-3 rounded-xl border p-4",
            isDark ? "border-white/10 bg-white/[0.02]" : "border-gray-200 bg-muted/40",
          )}
        >
          <div>
            <p className="text-sm font-semibold">Contest rules · selected event</p>
            <p className="text-xs text-muted-foreground mt-1">
              These thresholds drive eligibility on the live leaderboard.
            </p>
          </div>
          {!hasSelectedEvent && (
            <p className="text-xs text-amber-600 dark:text-amber-400 rounded-lg border border-amber-200/80 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 px-3 py-2">
              Create or select an event before saving eligibility rules.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Views winner min verified views</p>
              <Input
                type="number"
                min={0}
                value={adminRules.viewsMinViews}
                onChange={(e) =>
                  setAdminRules((prev) => ({ ...prev, viewsMinViews: e.target.value }))
                }
                className="h-10 text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Reels winner min verified reels</p>
              <Input
                type="number"
                min={0}
                value={adminRules.reelsMinReels}
                onChange={(e) =>
                  setAdminRules((prev) => ({ ...prev, reelsMinReels: e.target.value }))
                }
                className="h-10 text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Reels winner min verified views</p>
              <Input
                type="number"
                min={0}
                value={adminRules.reelsMinViews}
                onChange={(e) =>
                  setAdminRules((prev) => ({ ...prev, reelsMinViews: e.target.value }))
                }
                className="h-10 text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Min views per reel for reels board</p>
              <Input
                type="number"
                min={0}
                value={adminRules.minViewsPerReel}
                onChange={(e) =>
                  setAdminRules((prev) => ({ ...prev, minViewsPerReel: e.target.value }))
                }
                className="h-10 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border px-3 py-2">
            <p className="text-sm">Promote next eligible when rank #1 is not eligible</p>
            <Switch
              checked={adminRules.promoteNextEligible}
              onCheckedChange={(checked) =>
                setAdminRules((prev) => ({
                  ...prev,
                  promoteNextEligible: Boolean(checked),
                }))
              }
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Changes are versioned and apply immediately to the leaderboard.
            </p>
            <Button
              onClick={saveEligibilityRules}
              disabled={savingRules || !hasSelectedEvent}
              className="sm:w-auto w-full"
            >
              {savingRules ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Save contest rules
            </Button>
          </div>
          {rulesMessage && (
            <p
              className={cn(
                "text-xs",
                rulesMessage.includes("Failed") ? "text-red-500" : "text-emerald-600",
              )}
            >
              {rulesMessage}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 space-y-6">
      {isAdmin ? (
        <Tabs
          value={adminPrimaryTab}
          onValueChange={(v) => setAdminPrimaryTab(v as AdminPrimaryTab)}
          className="w-full space-y-6"
        >
          <TabsList
            className={cn(
              "min-h-0 w-full max-w-xl gap-1.5 rounded-xl border p-1.5 py-2",
              panelClass,
            )}
          >
            <TabsTrigger value="setup" className="rounded-lg text-xs sm:text-sm">
              Contest setup
            </TabsTrigger>
            <TabsTrigger value="live" className="rounded-lg text-xs sm:text-sm">
              Live event & leaderboard
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="setup"
            className="mt-0 space-y-6 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            {setupPanel}
          </TabsContent>
          <TabsContent
            value="live"
            className="mt-0 space-y-6 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            {liveDashboard}
          </TabsContent>
        </Tabs>
      ) : (
        liveDashboard
      )}
    </div>
  );
}
