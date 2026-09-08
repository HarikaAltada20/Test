"use client";

import { Archive, CalendarDays, SlidersHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { cn } from "@/lib/utils";
import {
  formatCategoryLabel,
  formatPeriodLabel,
} from "@/lib/daily-challenge-history";
import {
  formatPrize,
  fmtEventRange,
  number,
  snapshotWinnerPrize,
} from "./utils";

export type WinnerArchiveRow = {
  id: string;
  event_id: string;
  event_name?: string | null;
  snapshot_date?: string | null;
  period?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  category?: string | null;
  winner_creator_id?: string | null;
  is_eligible?: boolean | null;
  prize_minor_units?: number | string | null;
  prize_currency?: string | null;
  metrics_json?: {
    username?: string;
    fullName?: string;
    verifiedViews?: number;
    verifiedReels?: number;
    totalViews?: number;
    totalReels?: number;
  } | null;
  winner?: {
    id: string;
    username: string;
    fullName?: string | null;
    profilePictureUrl?: string | null;
  } | null;
  rules_json?: Record<string, unknown> | null;
};

type ArchiveEventOption = { id: string; name: string };

type WinnersArchiveProps = {
  isDark: boolean;
  loading: boolean;
  winners: WinnerArchiveRow[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  periodFilter: string;
  categoryFilter: string;
  eventFilter: string;
  monthFilter: string;
  events: ArchiveEventOption[];
  boardPrizeMinor: number;
  boardCurrency: string;
  onPeriodFilterChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onEventFilterChange: (value: string) => void;
  onMonthFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
};

function formatWinnerPeriod(row: WinnerArchiveRow) {
  const label = formatPeriodLabel(row.period || "day");
  if (row.period_start && row.period_end) {
    return `${label} · ${fmtEventRange(row.period_start, row.period_end)}`;
  }
  return `${label} · ${row.snapshot_date || "Snapshot"}`;
}

export function WinnersArchive({
  isDark,
  loading,
  winners,
  page,
  limit,
  totalItems,
  totalPages,
  periodFilter,
  categoryFilter,
  eventFilter,
  monthFilter,
  events,
  boardPrizeMinor,
  boardCurrency,
  onPeriodFilterChange,
  onCategoryFilterChange,
  onEventFilterChange,
  onMonthFilterChange,
  onPageChange,
  onLimitChange,
}: WinnersArchiveProps) {
  const hasActiveFilters =
    periodFilter !== "all" ||
    categoryFilter !== "all" ||
    eventFilter !== "all" ||
    Boolean(monthFilter);

  const clearFilters = () => {
    onPeriodFilterChange("all");
    onCategoryFilterChange("all");
    onEventFilterChange("all");
    onMonthFilterChange("");
  };

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border shadow-sm",
        isDark ? "border-white/10 bg-[#14052c]" : "border-slate-200 bg-white",
      )}
      aria-labelledby="winner-archive-heading"
    >
      <div className="px-5 py-6 sm:px-7">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              isDark ? "bg-white/[0.06]" : "bg-slate-100",
            )}
          >
            <Archive className="h-4 w-4 text-slate-500" aria-hidden />
          </div>
          <div>
            <h2 id="winner-archive-heading" className="text-lg font-extrabold tracking-tight">
              Historical results
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore winners from completed Daily, Weekly, and Monthly challenges.
            </p>
          </div>
        </div>

        <div
          className={cn(
            "mt-5 flex items-center justify-between border-t pt-4",
            isDark ? "border-white/10" : "border-slate-200",
          )}
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5 text-violet-600" aria-hidden />
            Filter results
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              className="text-xs font-semibold text-violet-600 hover:text-violet-700"
              onClick={clearFilters}
            >
              Clear all
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Period
            </p>
            <Select value={periodFilter} onValueChange={onPeriodFilterChange}>
              <SelectTrigger isDark={isDark} className="h-9 bg-background text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                <SelectItem value="all" isDark={isDark}>
                  All periods
                </SelectItem>
                <SelectItem value="day" isDark={isDark}>
                  Daily
                </SelectItem>
                <SelectItem value="week" isDark={isDark}>
                  Weekly
                </SelectItem>
                <SelectItem value="month" isDark={isDark}>
                  Monthly
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Category
            </p>
            <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
              <SelectTrigger isDark={isDark} className="h-9 bg-background text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                <SelectItem value="all" isDark={isDark}>
                  All categories
                </SelectItem>
                <SelectItem value="views" isDark={isDark}>
                  Views
                </SelectItem>
                <SelectItem value="reels" isDark={isDark}>
                  Reels
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Event
            </p>
            <Select value={eventFilter} onValueChange={onEventFilterChange}>
              <SelectTrigger isDark={isDark} className="h-9 bg-background text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                <SelectItem value="all" isDark={isDark}>
                  All events
                </SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id} isDark={isDark}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Month
            </p>
            <Input
              type="month"
              value={monthFilter}
              onChange={(e) => onMonthFilterChange(e.target.value)}
              className="h-9 bg-background text-sm"
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "border-t",
          isDark ? "border-white/10" : "border-slate-200",
        )}
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "mx-5 h-16 animate-pulse border-b bg-muted/20 sm:mx-7",
                isDark ? "border-white/10" : "border-slate-100",
              )}
            />
          ))
        ) : winners.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <CalendarDays className="h-7 w-7 text-slate-400" aria-hidden />
            <p className="mt-3 text-sm font-semibold">No matching results</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try another period, category, event, or month.
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "divide-y",
              isDark ? "divide-white/10" : "divide-slate-100",
            )}
          >
            {winners.map((w) => {
            const verifiedViews = Number(
              w?.metrics_json?.verifiedViews ?? w?.metrics_json?.totalViews ?? 0,
            );
            const verifiedReels = Number(
              w?.metrics_json?.verifiedReels ?? w?.metrics_json?.totalReels ?? 0,
            );
            const hasWinner = Boolean(w?.winner_creator_id) && Boolean(w?.is_eligible);
            const winnerName = hasWinner
              ? w?.winner?.username ||
                w?.metrics_json?.username ||
                w?.metrics_json?.fullName ||
                "Winner"
              : "—";
            const { minor: snapMinor, currency: snapCur } = snapshotWinnerPrize(
              w as Record<string, unknown>,
              boardPrizeMinor,
              boardCurrency,
            );
            const rewardLabel = formatPrize(snapMinor, snapCur);
            const metricStats =
              w.category === "reels"
                ? [
                    { value: verifiedReels, label: "verified reels" },
                    { value: verifiedViews, label: "verified views" },
                  ]
                : [
                    { value: verifiedViews, label: "verified views" },
                    { value: verifiedReels, label: "verified reels" },
                  ];

            return (
              <div
                key={w.id}
                className={cn(
                  "px-5 py-4 text-sm transition-colors sm:px-7 sm:py-5",
                  isDark ? "hover:bg-white/[0.025]" : "hover:bg-slate-50/60",
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  {hasWinner ? (
                    <Avatar className="mt-0.5 h-10 w-10 shrink-0 ring-2 ring-amber-200 ring-offset-2">
                      <AvatarImage src={w.winner?.profilePictureUrl || undefined} />
                      <AvatarFallback>
                        {(winnerName || "W").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                        isDark
                          ? "bg-white/[0.05] text-slate-500"
                          : "bg-slate-100 text-slate-400",
                      )}
                    >
                      —
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="font-bold">{formatCategoryLabel(w.category)}</p>
                        <Badge
                          variant="outline"
                          className="h-5 rounded-md px-1.5 text-[10px] font-semibold text-muted-foreground"
                        >
                          {formatPeriodLabel(w.period)}
                        </Badge>
                      </div>
                      {hasWinner && (
                        <Badge className="shrink-0 border border-amber-200 bg-amber-50 font-bold text-amber-900 hover:bg-amber-50">
                          {rewardLabel}
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatWinnerPeriod(w).replace(`${formatPeriodLabel(w.period)} · `, "")}
                    </p>
                    {w.event_name && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {w.event_name}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                      <span
                        className={cn(
                          "font-semibold",
                          hasWinner
                            ? isDark
                              ? "text-emerald-300"
                              : "text-emerald-700"
                            : "text-muted-foreground",
                        )}
                      >
                        {hasWinner ? `Winner · ${winnerName}` : "No eligible winner"}
                      </span>
                      {metricStats.map((metric) => (
                        <span key={metric.label} className="text-muted-foreground">
                          <strong className="font-semibold text-foreground">
                            {number(metric.value)}
                          </strong>{" "}
                          {metric.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}

        {!loading && totalItems > 0 && (
          <div
            className={cn(
              "border-t px-5 py-4 sm:px-7",
              isDark ? "border-white/10" : "border-gray-200",
            )}
          >
            <PaginationControls
              page={page}
              limit={limit}
              isDark={isDark}
              total={totalItems}
              totalPages={Math.max(1, totalPages)}
              hasNextPage={page < totalPages}
              hasPreviousPage={page > 1}
              onPageChange={onPageChange}
              onLimitChange={onLimitChange}
              loading={loading}
              hide200Option
              pageSizeOptions={[5, 10, 25, 50]}
            />
          </div>
        )}
      </div>
    </section>
  );
}
