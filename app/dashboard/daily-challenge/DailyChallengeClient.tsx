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

/** Daily Challenge only surfaces same-day and prior IST day ranges. */
type Period = "today" | "yesterday";
type Scope = "pending" | "verified" | "all";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
];

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
  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const nextMidnight = new Date(istNow);
  nextMidnight.setHours(24, 0, 0, 0);
  const diffMs = nextMidnight.getTime() - istNow.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
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

type BoardTab = "views" | "reels";
const DAILY_WINNER_REWARD_INR = 50;
const CREATOR_REFRESH_COOLDOWN_MS = 30 * 60 * 1000;
const ADMIN_REFRESH_COOLDOWN_MS = 1 * 60 * 1000;

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
  const [adminRules, setAdminRules] = useState({
    viewsMinViews: "1000",
    reelsMinReels: "3",
    reelsMinViews: "1000",
    minViewsPerReel: "100",
    promoteNextEligible: false,
  });

  const load = async (fresh = false) => {
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
        fetch("/api/competition/winners/daily?days=15"),
      ]);
      if (!leaderboardRes.ok) {
        const msg = await leaderboardRes.json();
        throw new Error(msg?.error || "Failed to load Daily Challenge");
      }
      const leaderboard = await leaderboardRes.json();
      const winnersJson = await winnersRes.json();
      setPayload(leaderboard);
      setWinners(winnersJson.winners || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load Daily Challenge");
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
        await fetch("/api/admin/competition/refresh", { method: "POST" });
      }
      await load(true);
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
  const isDark = mode === "dark";
  const rows = activeBoard === "views" ? payload?.topCreatorsByViews || [] : payload?.topCreatorsByReels || [];
  const pagination = payload?.pagination;
  const totalItems = pagination?.totalItems ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const lastUpdated = fromNow(payload?.generatedAt);
  const endsIn = getHoursUntilIstMidnight();
  const cooldownMs = isAdmin
    ? ADMIN_REFRESH_COOLDOWN_MS
    : CREATOR_REFRESH_COOLDOWN_MS;
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

  const saveEligibilityRules = async () => {
    if (!isAdmin || savingRules) return;
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
    } catch (e: any) {
      setRulesMessage(e?.message || "Failed to save eligibility rules");
    } finally {
      setSavingRules(false);
    }
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
              Compete daily for two independent trophies: Most Views and Most Verified Reels.
              Refreshes hourly; eligibility affects winners, not visibility.
            </p>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className={cn("rounded-xl px-3.5 py-3 border", isDark ? "border-violet-500/25 bg-violet-500/10" : "border-violet-200/90 bg-violet-50/80")}>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Daily Winners</p>
                <p className="font-semibold flex items-center gap-1.5 mt-1">
                  <Trophy className="w-4 h-4" /> 2 winners every day
                </p>
              </div>
              <div className={cn("rounded-xl px-3.5 py-3 border", isDark ? "border-amber-500/25 bg-amber-500/10" : "border-amber-200/90 bg-amber-50/80")}>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Round Ends</p>
                <p className="font-semibold flex items-center gap-1.5 mt-1">
                  <Clock3 className="w-4 h-4" /> Ends in {endsIn}
                </p>
              </div>
              <div className={cn("rounded-xl px-3.5 py-3 border", isDark ? "border-emerald-500/25 bg-emerald-500/10" : "border-emerald-200/90 bg-emerald-50/80")}>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Motivation</p>
                <p className="font-semibold mt-1">Auto-lock at 12:05 AM IST</p>
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

      {isAdmin && (
        <Card className={panelClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Admin Eligibility Settings</CardTitle>
          </CardHeader>
          <CardContent className="pt-1 space-y-3">
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
              <Button onClick={saveEligibilityRules} disabled={savingRules} className="sm:w-auto w-full">
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
          <Card className={panelClass}>
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

        <Card className={cn("lg:col-span-2", panelClass)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your Progress</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-3 text-sm pt-1">
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
                  <p className="text-base sm:text-lg font-semibold tracking-tight">Be the first to take the lead</p>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Upload one strong reel today and climb into the winners zone.
                  </p>
                  <Button asChild className="mt-5 rounded-lg w-full sm:w-auto">
                    <Link href="/dashboard/opportunities" className="inline-flex items-center justify-center w-full sm:w-auto">
                      <Upload className="w-4 h-4 mr-1" />
                      Upload your first reel
                    </Link>
                  </Button>
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
            Daily Winners (Recent)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {winners.length === 0 ? (
            <div className="py-8 text-sm text-muted-foreground text-center">
              No winner snapshots yet. Daily winners are auto-locked after IST day close.
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
                      const rewardInr = hasWinner ? DAILY_WINNER_REWARD_INR : 0;
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
                              {w.snapshot_date} - <span className="capitalize">{w.category}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 break-words sm:truncate">
                              Winner:{" "}
                              <span className="font-medium text-foreground">{winnerName}</span>
                              {statsSuffix}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <Badge variant="outline" className="whitespace-nowrap">
                              ₹{rewardInr}
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
