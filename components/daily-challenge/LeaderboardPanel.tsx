"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Trophy,
  Upload,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { cn } from "@/lib/utils";
import { ScopeControl } from "./ChallengeFilters";
import {
  formatIsoIstDetailed,
  number,
  type BoardTab,
  type Scope,
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
  showScopeControl?: boolean;
  scope?: Scope;
  scopeOptions?: { value: Scope; label: string }[];
  onScopeChange?: (value: Scope) => void;
};

function formatSecondary(row: LeaderboardRow) {
  const reelsTotal =
    Number(row.verifiedReels || 0) + Number(row.pendingReels || 0);
  const viewsTotal =
    Number(row.verifiedViews || 0) + Number(row.pendingViews || 0);
  return `${number(row.verifiedReels || 0)} verified reels · ${number(row.verifiedViews || 0)} verified views · ${number(reelsTotal)} total reels · ${number(viewsTotal)} total views`;
}

function initials(name?: string) {
  const parts = (name || "A").replace(/^@/, "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function HexRank({ rank, first }: { rank: number; first?: boolean }) {
  return (
    <span
      className="relative inline-flex h-10 w-9 items-center justify-center"
      aria-hidden
    >
      {first && (
        <span
          className="absolute inset-[-3px] bg-[#e8b15a]"
          style={{
            clipPath:
              "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          }}
        />
      )}
      <span
        className="relative flex h-9 w-8 items-center justify-center bg-neutral-900 text-sm font-semibold text-white"
        style={{
          clipPath:
            "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        }}
      >
        {rank}
      </span>
    </span>
  );
}

function orderPodium(rows: LeaderboardRow[]) {
  const top = [...rows].sort((a, b) => (a.rank || 0) - (b.rank || 0));
  if (top.length < 2) return top;
  if (top.length === 2) return [top[1], top[0]];
  return [top[1], top[0], top[2]];
}

export function LeaderboardPanel({
  isDark,
  isAdmin,
  challengeTitle,
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
  showScopeControl = false,
  scope,
  scopeOptions,
  onScopeChange,
}: LeaderboardPanelProps) {
  const showLiveState = hasActiveEvent && !viewingPastPeriod;
  const boardHeading = viewingPastPeriod
    ? "Completed leaderboard"
    : "Live leaderboard";
  const onFirstPage = currentPage <= 1;
  const isPodiumRow = (row: LeaderboardRow) =>
    (row.rank || 0) > 0 && (row.rank || 0) <= 3;
  const podium = onFirstPage ? orderPodium(rows.filter(isPodiumRow)) : [];
  const list = onFirstPage ? rows.filter((row) => !isPodiumRow(row)) : rows;
  const refreshLabel = refreshing
    ? "Updating"
    : cooldownRemainingMs > 0
      ? `Available in ${cooldownMinsCeil}m`
      : "Refresh";
  const updatedLine = refreshing
    ? "Updating verified results…"
    : lastManualRefreshRelative
      ? `Updated ${lastManualRefreshRelative}`
      : "Showing the latest available verified results";

  const primaryValue = (row: LeaderboardRow) =>
    activeBoard === "views" ? row.totalViews || 0 : row.totalReels || 0;
  const primaryUnit = activeBoard === "views" ? "views" : "reels";

  const statusLine = (row: LeaderboardRow) => {
    if (row.rank === 1 && row.trophy) return `Leading · Expected ${prizeLabel}`;
    if (row.rank === 1 && !row.trophy) return "Not eligible";
    return null;
  };

  return (
    <section
      className={cn(
        "rounded-[22px] border px-4 py-5 shadow-[0_1px_2px_rgba(120,72,20,0.04)] sm:px-5 sm:py-6",
        isDark ? "border-white/10 bg-[#161018]" : "border-neutral-200 bg-white",
      )}
      aria-labelledby="live-leaderboard-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden>
              {showLiveState && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  showLiveState ? "bg-emerald-500" : "bg-neutral-400",
                )}
              />
            </span>
            <h2
              id="live-leaderboard-heading"
              className={cn(
                "text-lg font-semibold tracking-tight",
                isDark ? "text-white" : "text-neutral-950",
              )}
            >
              {boardHeading}
            </h2>
          </div>
          <p
            className={cn(
              "mt-1 text-base",
              isDark ? "text-neutral-100" : "text-[#292524]",
            )}
          >
            {viewingPastPeriod
              ? "Review the final ranking for this completed window."
              : "See who is leading right now."}
          </p>
          <p
            className={cn(
              "mt-1 text-sm",
              isDark ? "text-neutral-200" : "text-[#292524]",
            )}
            title={
              lastLeaderboardFreshIso
                ? formatIsoIstDetailed(lastLeaderboardFreshIso)
                : undefined
            }
          >
            {updatedLine}
            {cooldownRemainingMs > 0 && !refreshing
              ? ` · Refresh in ${cooldownMinsCeil}m`
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          {showScopeControl && scope && scopeOptions && onScopeChange && (
            <ScopeControl
              isDark={isDark}
              scope={scope}
              scopeOptions={scopeOptions}
              onScopeChange={onScopeChange}
            />
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={!canRefresh}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60",
              isDark
                ? "border-white/15 text-white hover:bg-white/5"
                : "border-neutral-200 text-neutral-700 hover:bg-neutral-50",
            )}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {refreshLabel}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "mt-5 flex gap-6 border-b",
          isDark ? "border-white/10" : "border-neutral-200",
        )}
        role="tablist"
        aria-label="Leaderboard"
      >
        {(
          [
            ["views", "Views"],
            ["reels", "Reels"],
          ] as const
        ).map(([value, label]) => {
          const active = activeBoard === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onBoardChange(value)}
              className={cn(
                "-mb-px border-b-2 pb-2 text-base font-semibold",
                active
                  ? isDark
                    ? "border-white text-white"
                    : "border-neutral-950 text-neutral-950"
                  : "border-transparent text-[#292524] hover:text-[#171717]",
              )}
            >
              {label} leaderboard{" "}
              <span
                className={cn(
                  "ml-1 font-medium tabular-nums",
                  isDark ? "text-neutral-200" : "text-[#292524]",
                )}
              >
                {totalItems}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-44 animate-pulse rounded-2xl",
                    isDark ? "bg-white/5" : "bg-neutral-100",
                  )}
                />
              ))}
            </div>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-14 animate-pulse rounded-xl",
                  isDark ? "bg-white/5" : "bg-neutral-100",
                )}
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-10 text-center",
              isDark ? "border-white/15" : "border-[#eadfd4]",
            )}
          >
            {!hasActiveEvent ? (
              <>
                <Trophy className="mb-3 h-8 w-8 text-neutral-400" aria-hidden />
                <p className="text-base font-semibold tracking-tight">
                  Leaderboard paused
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-base text-[#292524]">
                  {challengeTitle} is not running right now. Rankings will
                  resume when the next window opens.
                </p>
              </>
            ) : isAdmin && viewingPastPeriod ? (
              <>
                <Trophy className="mb-3 h-8 w-8 text-neutral-400" aria-hidden />
                <p className="text-base font-semibold tracking-tight">
                  No ranked creators
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-base text-[#292524]">
                  No creators ranked for this closed window with the selected
                  post filter.
                </p>
              </>
            ) : (
              <>
                <div
                  className="mb-4 flex items-end justify-center gap-1.5"
                  aria-hidden
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-t-md bg-neutral-200 text-xs font-bold text-neutral-600">
                    2
                  </span>
                  <span className="flex h-12 w-9 items-center justify-center rounded-t-md bg-amber-200 text-xs font-black text-amber-900">
                    1
                  </span>
                  <span className="flex h-6 w-8 items-center justify-center rounded-t-md bg-orange-200 text-xs font-bold text-orange-800">
                    3
                  </span>
                </div>
                <p className="text-base font-semibold tracking-tight">
                  The #1 spot is yours to claim.
                </p>
                <p className="mt-1.5 max-w-md text-base text-[#292524]">
                  No creators have entered yet. Upload a verified reel and take
                  the lead.
                </p>
                <Link
                  href="/dashboard/opportunities"
                  className="mt-5 inline-flex items-center justify-center rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#f56c0c]"
                >
                  <Upload className="mr-1 h-4 w-4" />
                  Upload your first reel
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        ) : (
          <div>
            {podium.length > 0 && (
              <div
                className={cn(
                  "grid items-end gap-3",
                  podium.length === 1
                    ? "mx-auto max-w-xs grid-cols-1"
                    : podium.length === 2
                      ? "mx-auto max-w-2xl grid-cols-2"
                      : "grid-cols-3",
                )}
              >
                {podium.map((row) => {
                  const first = row.rank === 1;
                  const note = statusLine(row);
                  return (
                    <div
                      key={`${activeBoard}-podium-${row.creatorId}`}
                      className={cn(
                        "flex flex-col items-center rounded-2xl border px-2 text-center",
                        first ? "py-6 sm:py-7" : "py-4",
                        first
                          ? isDark
                            ? "border-orange-300/30 bg-orange-400/10"
                            : "border-[#f0d3b0] bg-gradient-to-b from-white to-[#fff6ee]"
                          : isDark
                            ? "border-white/10 bg-white/[0.03]"
                            : "border-[#f3e6d8] bg-[#fafafa]",
                      )}
                    >
                      <HexRank rank={row.rank || 0} first={first} />
                      <Avatar
                        className={cn(
                          "mt-3 h-12 w-12 sm:h-14 sm:w-14",
                          first && "ring-2 ring-orange-200",
                        )}
                      >
                        <AvatarImage src={row.profilePictureUrl || undefined} />
                        <AvatarFallback
                          className={
                            isDark
                              ? "bg-white/10 text-white"
                              : "bg-[#f3f1ef] text-neutral-600"
                          }
                        >
                          {initials(row.username)}
                        </AvatarFallback>
                      </Avatar>
                      <p
                        className={cn(
                          "mt-3 max-w-full truncate px-2 text-base font-semibold",
                          isDark ? "text-white" : "text-[#171717]",
                        )}
                      >
                        {row.username}
                      </p>
                      <p
                        className={cn(
                          "mt-2 text-xl font-bold tabular-nums sm:text-2xl",
                          isDark ? "text-white" : "text-[#171717]",
                        )}
                      >
                        {number(primaryValue(row))}
                        <span
                          className={cn(
                            "ml-1 text-base font-semibold",
                            isDark ? "text-neutral-100" : "text-[#292524]",
                          )}
                        >
                          {primaryUnit}
                        </span>
                      </p>
                      <p
                        className={cn(
                          "mt-2 px-2 text-sm leading-6",
                          isDark ? "text-neutral-100" : "text-[#292524]",
                        )}
                      >
                        {formatSecondary(row)}
                      </p>
                      {note && (
                        <p
                          className={cn(
                            "mt-2 text-sm font-semibold",
                            first && row.trophy
                              ? "text-[#c2410c]"
                              : isDark
                                ? "text-neutral-100"
                                : "text-[#292524]",
                          )}
                        >
                          {note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {list.length > 0 && (
              <div
                className={cn(
                  podium.length > 0 && "mt-4",
                  isDark
                    ? "divide-y divide-white/10"
                    : "divide-y divide-neutral-100",
                )}
              >
                {list.map((row, index) => {
                  const note = statusLine(row);
                  return (
                    <div
                      key={`${activeBoard}-row-${row.creatorId}`}
                      className="flex items-center gap-3 py-3.5"
                    >
                      <span
                        className={cn(
                          "w-6 shrink-0 text-sm font-semibold tabular-nums",
                          isDark ? "text-neutral-200" : "text-[#292524]",
                        )}
                      >
                        {row.rank || index + 1}
                      </span>
                      <Avatar className="h-9 w-9 rounded-lg">
                        <AvatarImage src={row.profilePictureUrl || undefined} />
                        <AvatarFallback
                          className={cn(
                            "rounded-lg text-xs font-semibold",
                            isDark
                              ? "bg-white/10 text-white"
                              : "bg-[#f3f1ef] text-[#292524]",
                          )}
                        >
                          {initials(row.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-base font-semibold",
                            isDark ? "text-white" : "text-[#171717]",
                          )}
                        >
                          {row.username}
                        </p>
                        <p
                          className={cn(
                            "text-sm leading-6",
                            isDark ? "text-neutral-100" : "text-[#292524]",
                          )}
                        >
                          {formatSecondary(row)}
                        </p>
                        {note && (
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              isDark ? "text-orange-200" : "text-[#c2410c]",
                            )}
                          >
                            {note}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "text-lg font-bold tabular-nums",
                            isDark ? "text-white" : "text-[#171717]",
                          )}
                        >
                          {number(primaryValue(row))} {primaryUnit}
                        </p>
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isDark ? "text-neutral-100" : "text-[#292524]",
                          )}
                        >
                          {activeBoard === "views"
                            ? `${number(row.totalReels || 0)} reels`
                            : `${number(row.totalViews || 0)} views`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!loading && !error && rows.length > 0 && totalPages > 0 && (
          <div
            className={cn(
              "mt-4 border-t pt-4",
              isDark ? "border-white/10" : "border-neutral-200",
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
