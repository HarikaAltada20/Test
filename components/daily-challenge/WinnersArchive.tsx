"use client";

import { useState } from "react";
import { CalendarDays, SlidersHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  RewardsOverview,
  RewardsPaidSummary,
  type RewardsSummaryView,
  type TopCreatorView,
} from "./RewardsOverview";
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
  summary: RewardsSummaryView | null;
  summaryLoading: boolean;
  topCreators: TopCreatorView[];
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

function shortDay(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

const fieldTriggerClass = (isDark: boolean) =>
  cn(
    "h-11 w-full rounded-full px-4 text-base font-medium shadow-none [&>svg]:opacity-80",
    isDark
      ? "border-white/15 bg-white/5 text-white"
      : "border-[#e7e5e4] bg-white text-[#171717] hover:bg-[#fafaf9]",
  );

function FieldSelect({
  isDark,
  label,
  value,
  onChange,
  options,
}: {
  isDark: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.12em]",
          isDark ? "text-neutral-200" : "text-[#292524]",
        )}
      >
        {label}
      </p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          isDark={isDark}
          aria-label={label}
          className={fieldTriggerClass(isDark)}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent isDark={isDark}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} isDark={isDark}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
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
  summary,
  summaryLoading,
  topCreators,
  onPeriodFilterChange,
  onCategoryFilterChange,
  onEventFilterChange,
  onMonthFilterChange,
  onPageChange,
  onLimitChange,
}: WinnersArchiveProps) {
  const [tab, setTab] = useState<"results" | "earners">("results");
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
        "rounded-[22px] border px-4 py-5 shadow-[0_1px_2px_rgba(120,72,20,0.04)] sm:px-5 sm:py-6",
        isDark ? "border-white/10 bg-[#161018]" : "border-neutral-200 bg-white",
      )}
      aria-labelledby="winner-archive-heading"
    >
      <h2
        id="winner-archive-heading"
        className={cn(
          "text-lg font-semibold",
          isDark ? "text-white" : "text-neutral-950",
        )}
      >
        Winners
      </h2>
      <p
        className={cn(
          "mt-1 text-base",
          isDark ? "text-neutral-200" : "text-[#292524]",
        )}
      >
        Historical results from completed Daily, Weekly, and Monthly challenges.
      </p>
      <RewardsPaidSummary
        isDark={isDark}
        loading={summaryLoading}
        summary={summary}
      />

      <div
        className={cn(
          "mt-5 flex gap-6 border-b",
          isDark ? "border-white/10" : "border-neutral-200",
        )}
        role="tablist"
      >
        {(
          [
            ["results", "Past results"],
            ["earners", "Top earners"],
          ] as const
        ).map(([value, label]) => {
          const active = tab === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(value)}
              className={cn(
                "-mb-px border-b-2 pb-2 text-base font-semibold",
                active
                  ? isDark
                    ? "border-white text-white"
                    : "border-neutral-950 text-neutral-950"
                  : "border-transparent text-[#292524] hover:text-[#171717]",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "earners" ? (
        <div className="pt-5">
          <RewardsOverview
            embedded
            isDark={isDark}
            loading={summaryLoading}
            summary={summary}
            topCreators={topCreators}
          />
        </div>
      ) : (
        <div className="pt-4">
          <p
            className={cn(
              "text-base",
              isDark ? "text-neutral-100" : "text-[#292524]",
            )}
          >
            Explore winners from completed Daily, Weekly, and Monthly
            challenges.
          </p>
          <div
            className={cn(
              "mt-4 flex items-center justify-between border-t pt-4",
              isDark ? "border-white/10" : "border-[#f3ebe3]",
            )}
          >
            <p
              className={cn(
                "flex items-center gap-1.5 text-sm font-semibold",
                isDark ? "text-white" : "text-[#171717]",
              )}
            >
              <SlidersHorizontal
                className="h-3.5 w-3.5 text-[#f97316]"
                aria-hidden
              />
              Filter results
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="text-sm font-semibold text-[#c2410c] hover:text-[#9a3412]"
                onClick={clearFilters}
              >
                Clear all
              </button>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <FieldSelect
              isDark={isDark}
              label="Period"
              value={periodFilter}
              onChange={onPeriodFilterChange}
              options={[
                { value: "all", label: "All periods" },
                { value: "day", label: "Daily" },
                { value: "week", label: "Weekly" },
                { value: "month", label: "Monthly" },
              ]}
            />
            <FieldSelect
              isDark={isDark}
              label="Category"
              value={categoryFilter}
              onChange={onCategoryFilterChange}
              options={[
                { value: "all", label: "All categories" },
                { value: "views", label: "Views" },
                { value: "reels", label: "Reels" },
              ]}
            />
            <FieldSelect
              isDark={isDark}
              label="Event"
              value={eventFilter}
              onChange={onEventFilterChange}
              options={[
                { value: "all", label: "All events" },
                ...events.map((event) => ({
                  value: event.id,
                  label: event.name,
                })),
              ]}
            />
            <div className="space-y-1.5">
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.12em]",
                  isDark ? "text-neutral-200" : "text-[#292524]",
                )}
              >
                Month
              </p>
              <Input
                type="month"
                value={monthFilter}
                onChange={(event) => onMonthFilterChange(event.target.value)}
                aria-label="Month"
                className={cn(
                  "h-11 rounded-full px-4 text-base shadow-none",
                  isDark
                    ? "border-white/15 bg-white/5 text-white"
                    : "border-[#e7e5e4] bg-white text-[#171717]",
                )}
              />
            </div>
          </div>

          <div
            className={cn(
              "mt-2 border-t",
              isDark ? "border-white/10" : "border-neutral-100",
            )}
          >
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-14 animate-pulse border-b",
                    isDark
                      ? "border-white/10 bg-white/5"
                      : "border-neutral-100 bg-neutral-50",
                  )}
                />
              ))
            ) : winners.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <CalendarDays
                  className="h-7 w-7 text-neutral-400"
                  aria-hidden
                />
                <p className="mt-3 text-sm font-semibold">
                  No matching results
                </p>
                <p className="mt-1 text-base text-[#292524]">
                  Try another period, category, event, or month.
                </p>
              </div>
            ) : (
              <div
                className={cn(
                  "divide-y",
                  isDark ? "divide-white/10" : "divide-neutral-100",
                )}
              >
                {winners.map((winner) => {
                  const verifiedViews = Number(
                    winner.metrics_json?.verifiedViews ??
                      winner.metrics_json?.totalViews ??
                      0,
                  );
                  const verifiedReels = Number(
                    winner.metrics_json?.verifiedReels ??
                      winner.metrics_json?.totalReels ??
                      0,
                  );
                  const hasWinner =
                    Boolean(winner.winner_creator_id) &&
                    Boolean(winner.is_eligible);
                  const winnerName = hasWinner
                    ? winner.winner?.username ||
                      winner.metrics_json?.username ||
                      winner.metrics_json?.fullName ||
                      "Winner"
                    : "No eligible winner";
                  const { minor, currency } = snapshotWinnerPrize(
                    winner as Record<string, unknown>,
                    boardPrizeMinor,
                    boardCurrency,
                  );
                  const rewardLabel = formatPrize(minor, currency);
                  const primaryDate = shortDay(
                    winner.period_start || winner.snapshot_date,
                  );

                  return (
                    <div
                      key={winner.id}
                      className="grid gap-2 py-3.5 md:grid-cols-[210px_minmax(140px,180px)_minmax(0,1fr)_auto] md:items-center md:gap-4"
                    >
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-base font-medium",
                            isDark ? "text-white" : "text-[#171717]",
                          )}
                        >
                          {formatPeriodLabel(winner.period)}
                          {primaryDate ? ` · ${primaryDate}` : ""}
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 text-sm leading-6",
                            isDark ? "text-neutral-200" : "text-[#292524]",
                          )}
                        >
                          {formatWinnerPeriod(winner)}
                        </p>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        {hasWinner ? (
                          <Avatar className="h-7 w-7">
                            <AvatarImage
                              src={
                                winner.winner?.profilePictureUrl || undefined
                              }
                            />
                            <AvatarFallback>
                              {winnerName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <span
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full text-xs",
                              isDark
                                ? "bg-white/10 text-neutral-400"
                                : "bg-neutral-100 text-neutral-400",
                            )}
                          >
                            —
                          </span>
                        )}
                        <p
                          className={cn(
                            "truncate text-base font-semibold",
                            hasWinner
                              ? isDark
                                ? "text-white"
                                : "text-[#171717]"
                              : "font-medium text-[#292524]",
                          )}
                        >
                          {winnerName}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "min-w-0 truncate text-base",
                          isDark ? "text-neutral-100" : "text-[#292524]",
                        )}
                      >
                        {formatCategoryLabel(winner.category)} ·{" "}
                        {number(verifiedViews)} verified views ·{" "}
                        {number(verifiedReels)} verified reels
                        {winner.event_name ? ` · ${winner.event_name}` : ""}
                      </p>
                      <p
                        className={cn(
                          "text-base font-semibold tabular-nums md:text-right",
                          isDark ? "text-white" : "text-[#171717]",
                        )}
                      >
                        {hasWinner ? rewardLabel : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!loading && totalItems > 0 && (
            <div
              className={cn(
                "mt-2 border-t pt-4",
                isDark ? "border-white/10" : "border-neutral-200",
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
      )}
    </section>
  );
}
