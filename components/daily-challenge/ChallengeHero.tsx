"use client";

import { CheckCircle2, Clock3, Flame, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatContestInstantIst,
  getTimeUntil,
  number,
  perReelMinVerifiedPhrase,
  verifiedReelsPhrase,
} from "./utils";

type ChallengeHeroProps = {
  isDark: boolean;
  isAdmin: boolean;
  challengeTitle: string;
  modeHeadline: string;
  totalPrizePoolLabel: string;
  prizeLabel: string;
  config: {
    viewsMinViews: number;
    reelsMinReels: number;
    reelsMinViews: number;
    minViewsPerReel: number;
  } | null;
  effectiveRange: { start?: string; end?: string } | null;
  endsIn: string;
  rangeEnded: boolean;
  scopeWindowLabel: string;
};

export function ChallengeHero({
  isDark,
  isAdmin,
  challengeTitle,
  modeHeadline,
  totalPrizePoolLabel,
  prizeLabel,
  config,
  effectiveRange,
  endsIn,
  rangeEnded,
  scopeWindowLabel,
}: ChallengeHeroProps) {
  const hasWindow =
    typeof effectiveRange?.start === "string" &&
    typeof effectiveRange?.end === "string";
  const startsAt = hasWindow ? new Date(effectiveRange.start!).getTime() : Number.NaN;
  const startsSoon = Number.isFinite(startsAt) && startsAt > Date.now();
  const statusLabel = !hasWindow
    ? "Not active"
    : rangeEnded
      ? "Completed"
      : startsSoon
        ? "Starting soon"
        : "Live now";
  const statusIsLive = hasWindow && !rangeEnded && !startsSoon;

  return (
    <header
      className={cn(
        "relative overflow-hidden px-5 py-6 sm:px-8 sm:py-8",
        isDark ? "bg-[#17062f]" : "bg-white",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          rangeEnded ? "bg-slate-400" : "bg-violet-600",
        )}
        aria-hidden
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5">
              <Flame className="h-6 w-6 text-violet-600" aria-hidden />
              <h1
                className={cn(
                  "text-2xl font-bold tracking-[-0.025em] sm:text-3xl",
                  isDark ? "text-white" : "text-slate-950",
                )}
              >
                {challengeTitle}
              </h1>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em]",
                statusIsLive
                  ? isDark
                    ? "text-emerald-300"
                    : "text-emerald-700"
                  : "text-slate-500",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  statusIsLive ? "bg-emerald-500" : "bg-slate-400",
                )}
                aria-hidden
              />
              {statusLabel}
            </span>
          </div>
          <p
            className={cn(
              "max-w-xl text-sm leading-6 sm:text-base",
              isDark ? "text-slate-300" : "text-slate-600",
            )}
          >
            {isAdmin
              ? "Track the active creator competition, verify the leaders, and review completed challenge windows."
              : "Compete for cash rewards with verified reels and views. Climb the leaderboard before the window closes."}
          </p>

          <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-10">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
                {modeHeadline} prize pool
              </div>
              <p
                className={cn(
                  "mt-1 text-4xl font-black tracking-[-0.04em] sm:text-5xl",
                  isDark ? "text-white" : "text-slate-950",
                )}
              >
                {totalPrizePoolLabel}
              </p>
            </div>

            <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-7 gap-y-2 border-l-0 sm:border-l sm:pl-7">
              <div>
                <p className="text-xs text-muted-foreground">Most verified reels</p>
                <p className="mt-0.5 font-bold tabular-nums">{prizeLabel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Most verified views</p>
                <p className="mt-0.5 font-bold tabular-nums">{prizeLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-col justify-between border-t pt-5 lg:w-[290px] lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0",
            isDark ? "border-white/10" : "border-slate-200",
          )}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {!hasWindow || rangeEnded ? "Challenge status" : startsSoon ? "Starts in" : "Time remaining"}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Clock3
                className={cn(
                  "h-5 w-5",
                  !hasWindow || rangeEnded ? "text-slate-400" : "text-violet-600",
                )}
                aria-hidden
              />
              <p
                className={cn(
                  "text-2xl font-extrabold tracking-tight sm:text-3xl",
                  isDark ? "text-white" : "text-slate-950",
                )}
              >
                {!hasWindow
                  ? "Not active"
                  : rangeEnded
                    ? "Completed"
                    : startsSoon
                      ? getTimeUntil(effectiveRange.start)
                      : endsIn}
              </p>
            </div>
          </div>

          {typeof effectiveRange?.start === "string" &&
          typeof effectiveRange?.end === "string" ? (
            <div className="mt-5 space-y-1 text-xs leading-5 text-muted-foreground">
              <p>{formatContestInstantIst(effectiveRange.start)}</p>
              <p className="font-medium text-foreground">
                to {formatContestInstantIst(effectiveRange.end)}
              </p>
              <p>India Standard Time</p>
            </div>
          ) : (
            <p className="mt-5 text-xs leading-5 text-muted-foreground">
              The challenge window appears when this mode is active. Showing {scopeWindowLabel.toLowerCase()} posts.
            </p>
          )}
        </div>
      </div>

      {config && (
        <details
          className={cn(
            "group mt-7 border-t pt-4",
            isDark ? "border-white/10" : "border-slate-200",
          )}
        >
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
            <span className="text-xs font-semibold text-foreground">
              How to qualify and win
            </span>
            <span className="ml-auto text-xs font-medium text-violet-600 group-open:hidden">
              View rules
            </span>
            <span className="ml-auto hidden text-xs font-medium text-violet-600 group-open:inline">
              Hide rules
            </span>
          </summary>
          <div className="mt-4 grid gap-4 text-sm leading-6 text-muted-foreground sm:grid-cols-2 sm:gap-8">
            <div>
              <p className="font-semibold text-foreground">Most verified views</p>
              <div className="mt-1 space-y-1">
                <p>
                  Reach at least{" "}
                  <span className="font-semibold text-foreground">
                    {number(config.viewsMinViews)} combined verified views
                  </span>
                  .
                </p>
                <p>
                  Get more verified views than any other eligible creator and
                  finish #1 on the Views leaderboard to win.
                </p>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">Most verified reels</p>
              <div className="mt-1 space-y-1">
                <p>
                  Submit at least{" "}
                  <span className="font-semibold text-foreground">
                    {verifiedReelsPhrase(config.reelsMinReels)}
                  </span>
                  .
                </p>
                <p>
                  Each reel must have at least{" "}
                  <span className="font-semibold text-foreground">
                    {perReelMinVerifiedPhrase(config.minViewsPerReel)}
                  </span>
                  .
                </p>
                <p>
                  Submit more qualifying reels than any other eligible creator
                  and finish #1 on the Reels leaderboard to win.
                </p>
              </div>
            </div>
          </div>
        </details>
      )}
    </header>
  );
}
