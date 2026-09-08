"use client";

import Link from "next/link";
import { AlertCircle, ArrowUpRight, Eye, Flame, Loader2, Medal, RefreshCw, Trophy, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { cn } from "@/lib/utils";
import {
  formatIsoIstDetailed,
  number,
  type BoardTab,
  type UiLeaderboardPeriod,
} from "./utils";

type LeaderboardRow = {
  creatorId: string;
  username?: string;
  profilePictureUrl?: string | null;
  rank?: number;
  trophy?: boolean;
  eligible?: boolean;
  totalViews?: number;
  totalReels?: number;
  verifiedViews?: number;
  verifiedReels?: number;
  pendingViews?: number;
  pendingReels?: number;
};

type LeaderboardPanelProps = {
  isDark: boolean;
  isAdmin: boolean;
  challengeTitle: string;
  leaderboardPeriod: UiLeaderboardPeriod;
  viewingPastPeriod: boolean;
  hasActiveEvent: boolean;
  activeBoard: BoardTab;
  onBoardChange: (board: BoardTab) => void;
  rows: LeaderboardRow[];
  prizeLabel: string;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  canRefresh: boolean;
  cooldownRemainingMs: number;
  cooldownMinsCeil: number;
  lastManualRefreshRelative: string | null;
  lastLeaderboardFreshIso: string | null;
  onRefresh: () => void;
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
};

function formatSecondary(row: LeaderboardRow) {
  const reelsTotal = Number(row.verifiedReels || 0) + Number(row.pendingReels || 0);
  const viewsTotal = Number(row.verifiedViews || 0) + Number(row.pendingViews || 0);
  return `${number(row.verifiedReels || 0)} verified reels · ${number(row.verifiedViews || 0)} verified views · ${number(reelsTotal)} total reels · ${number(viewsTotal)} total views`;
}

export function LeaderboardPanel({
  isDark,
  isAdmin,
  challengeTitle,
  leaderboardPeriod,
  viewingPastPeriod,
  hasActiveEvent,
  activeBoard,
  onBoardChange,
  rows,
  prizeLabel,
  loading,
  error,
  refreshing,
  canRefresh,
  cooldownRemainingMs,
  cooldownMinsCeil,
  lastManualRefreshRelative,
  lastLeaderboardFreshIso,
  onRefresh,
  currentPage,
  limit,
  totalItems,
  totalPages,
  onPageChange,
  onLimitChange,
}: LeaderboardPanelProps) {
  const showLiveState = hasActiveEvent && !viewingPastPeriod;
  const boardHeading = viewingPastPeriod ? "Completed leaderboard" : "Live leaderboard";

  return (
    <section
      className={cn("px-4 py-6 sm:px-6 sm:py-7", isDark ? "bg-[#14052c]" : "bg-white")}
      aria-labelledby="live-leaderboard-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              {showLiveState && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-2.5 w-2.5 rounded-full",
                  showLiveState ? "bg-emerald-500" : "bg-slate-400",
                )}
              />
            </span>
            <h2
              id="live-leaderboard-heading"
              className={cn(
                "text-xl font-extrabold tracking-[-0.02em] sm:text-2xl",
                isDark ? "text-white" : "text-slate-950",
              )}
            >
              {boardHeading}
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {viewingPastPeriod
              ? "Review the final ranking for this completed window."
              : "See who is leading right now."}
          </p>
          <p
            className="mt-1 text-xs text-muted-foreground"
            title={lastLeaderboardFreshIso ? formatIsoIstDetailed(lastLeaderboardFreshIso) : undefined}
          >
            {refreshing
              ? "Updating verified results…"
              : lastManualRefreshRelative
                ? `Updated ${lastManualRefreshRelative}`
                : "Showing the latest available verified results"}
            {cooldownRemainingMs > 0 && !refreshing
              ? ` · Refresh in ${cooldownMinsCeil}m`
              : ""}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={!canRefresh}
          className={cn(
            "h-9 shrink-0 gap-2 rounded-lg px-3.5",
            isDark && "border-white/15 bg-transparent text-white hover:bg-white/5",
          )}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {refreshing
            ? "Updating"
            : cooldownRemainingMs > 0
              ? `Available in ${cooldownMinsCeil}m`
              : "Refresh"}
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        <Tabs value={activeBoard} onValueChange={(v) => onBoardChange(v as BoardTab)}>
          <TabsList
            className={cn(
              "grid w-full grid-cols-2 gap-0 rounded-lg border p-1 sm:max-w-md",
              isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50",
            )}
          >
            <TabsTrigger
              value="views"
              className={cn(
                "w-full rounded-md border-0 px-3 py-2 text-xs font-semibold shadow-none transition-colors sm:text-sm",
                isDark ? "text-slate-300" : "text-slate-600",
              )}
            >
              <Eye className="w-3 h-3 mr-1" />
              Views leaderboard
            </TabsTrigger>
            <TabsTrigger
              value="reels"
              className={cn(
                "w-full rounded-md border-0 px-3 py-2 text-xs font-semibold shadow-none transition-colors sm:text-sm",
                isDark ? "text-slate-300" : "text-slate-600",
              )}
            >
              <Flame className="w-3 h-3 mr-1" />
              Reels leaderboard
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : loading ? (
          <div
            className={cn(
              "divide-y overflow-hidden rounded-xl border",
              isDark ? "divide-white/10 border-white/10" : "divide-slate-200 border-slate-200",
            )}
          >
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className="flex animate-pulse flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="h-4 w-36 sm:w-40 bg-gray-200 rounded" />
                <div className="h-4 w-20 sm:w-24 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div
            className={cn(
              rows.length > 0 &&
                "divide-y overflow-hidden rounded-xl border",
              rows.length > 0 && (isDark ? "divide-white/10 border-white/10" : "divide-slate-200 border-slate-200"),
            )}
          >
            {rows.map((row, index) => (
              <div
                key={`${activeBoard}-${row.creatorId}`}
                className={cn(
                  "group relative flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-5",
                  row.rank === 1
                    ? isDark
                      ? "bg-amber-500/[0.08]"
                      : "bg-amber-50/80"
                    : row.rank === 2
                      ? isDark
                        ? "bg-white/[0.025]"
                        : "bg-slate-50/70"
                      : row.rank === 3
                        ? isDark
                          ? "bg-orange-500/[0.04]"
                          : "bg-orange-50/40"
                        : isDark
                          ? "bg-transparent hover:bg-white/[0.025]"
                          : "bg-white hover:bg-slate-50/60",
                )}
              >
                <div className="flex items-center gap-3 min-w-0 w-full">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black",
                      row.rank === 1
                        ? "bg-amber-200/80 text-amber-900"
                        : row.rank === 2
                          ? "bg-slate-200 text-slate-700"
                          : row.rank === 3
                            ? "bg-orange-200/70 text-orange-900"
                            : isDark
                              ? "bg-white/10 text-slate-300"
                              : "bg-slate-100 text-slate-600",
                    )}
                  >
                    #{row.rank || index + 1}
                  </div>
                  <Avatar className={cn("h-10 w-10", row.rank === 1 && "ring-2 ring-amber-300 ring-offset-2")}>
                    <AvatarImage src={row.profilePictureUrl || undefined} />
                    <AvatarFallback>
                      {(row.username || "A").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-bold">
                      <span className="truncate">{row.username}</span>
                      {row.rank === 1 && row.trophy && (
                        <Badge className="text-[10px]">
                          <Medal className="w-3 h-3 mr-1" />
                          Leading
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
                    <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground sm:truncate">
                      {formatSecondary(row)}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0 min-w-[110px] w-full sm:w-auto">
                  <p className="text-xl font-black leading-none tracking-tight sm:text-2xl">
                    {activeBoard === "views"
                      ? `${number(row.totalViews || 0)} views`
                      : `${number(row.totalReels || 0)} reels`}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {activeBoard === "views"
                      ? `${number(row.totalReels || 0)} reels`
                      : `${number(row.totalViews || 0)} views`}
                  </p>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center sm:py-10",
                  isDark ? "border-white/15 bg-white/[0.02]" : "border-slate-300 bg-slate-50/50",
                )}
              >
                {!hasActiveEvent ? (
                  <>
                    <Trophy className="mb-3 h-8 w-8 text-slate-400" aria-hidden />
                    <p className="text-base sm:text-lg font-semibold tracking-tight">
                      Leaderboard paused
                    </p>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                      {challengeTitle} is not running right now. Rankings will resume when the next window opens.
                    </p>
                  </>
                ) : isAdmin && viewingPastPeriod ? (
                  <>
                    <Trophy className="mb-3 h-8 w-8 text-slate-400" aria-hidden />
                    <p className="text-base sm:text-lg font-semibold tracking-tight">
                      No ranked creators
                    </p>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                      No creators ranked for this closed window with the selected post filter.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex items-end justify-center gap-1.5" aria-hidden>
                      <span className="flex h-8 w-8 items-center justify-center rounded-t-md bg-slate-200 text-xs font-bold text-slate-600">2</span>
                      <span className="flex h-12 w-9 items-center justify-center rounded-t-md bg-amber-200 text-xs font-black text-amber-900">1</span>
                      <span className="flex h-6 w-8 items-center justify-center rounded-t-md bg-orange-200 text-xs font-bold text-orange-800">3</span>
                    </div>
                    <p className="text-base sm:text-lg font-semibold tracking-tight">
                      The #1 spot is yours to claim.
                    </p>
                    <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                      No creators have entered yet. Upload a verified reel and
                      take the lead.
                    </p>
                    <Button asChild className="mt-5 w-full rounded-lg bg-violet-600 hover:bg-violet-700 sm:w-auto">
                      <Link
                        href="/dashboard/opportunities"
                        className="inline-flex items-center justify-center w-full sm:w-auto"
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        Upload your first reel
                        <ArrowUpRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {!loading && !error && rows.length > 0 && totalPages > 0 && (
          <div
            className={cn(
              "border-t pt-4 sm:pt-6 mt-4 sm:mt-6",
              isDark ? "border-white/10" : "border-gray-200",
            )}
          >
            <PaginationControls
              page={currentPage}
              limit={limit}
              isDark={isDark}
              total={totalItems}
              totalPages={totalPages}
              hasNextPage={currentPage < totalPages}
              hasPreviousPage={currentPage > 1}
              onPageChange={onPageChange}
              onLimitChange={onLimitChange}
              loading={loading}
              hide200Option
            />
          </div>
        )}
      </div>
    </section>
  );
}
