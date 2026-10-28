"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Clapperboard, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatContestInstantIst,
  getTimeUntil,
  number,
  perReelMinVerifiedPhrase,
  verifiedReelsPhrase,
  type UiLeaderboardPeriod,
} from "./utils";

type PeriodOption = { value: UiLeaderboardPeriod; label: string };

type ChallengeHeroProps = {
  isDark: boolean;
  isAdmin: boolean;
  challengeTitle: string;
  modeHeadline: string;
  leaderboardPeriod: UiLeaderboardPeriod;
  periodOptions: PeriodOption[];
  onPeriodChange: (value: UiLeaderboardPeriod) => void;
  totalPrizePoolLabel: string;
  prizeLabel: string;
  config: {
    viewsMinViews: number;
    reelsMinReels: number;
    reelsMinViews: number;
    minViewsPerReel: number;
  } | null;
  me?: {
    viewsRank?: number | null;
    reelsRank?: number | null;
    remaining?: { views?: string; reels?: string };
  } | null;
  effectiveRange: { start?: string; end?: string } | null;
  endsIn: string;
  rangeEnded: boolean;
  scopeWindowLabel: string;
};

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  if (days > 0) return `${days}d ${hh}:${mm}:${ss}`;
  return `${hh}:${mm}:${ss}`;
}

function leftCaption(period: UiLeaderboardPeriod) {
  if (period === "this_week" || period === "last_week") return "left this week";
  if (period === "this_month" || period === "last_month")
    return "left this month";
  if (period === "yesterday") return "for yesterday";
  return "left today";
}

function formatShortIst(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function standingLine(rank: number | null | undefined, remaining?: string) {
  const detail = remaining?.trim();
  const onBoard = typeof rank === "number" && rank > 0;
  if (!onBoard && !detail) return "You're not on the board yet.";
  if (!onBoard) return detail || "You're not on the board yet.";
  if (!detail) return `You're #${rank}.`;
  return `You're #${rank}. ${detail}`;
}

function CountdownDial({
  progress,
  time,
  caption,
  isDark,
}: {
  progress: number;
  time: string;
  caption: string;
  isDark: boolean;
}) {
  const size = 228;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 78;
  const ticks = 56;
  const clamped = Math.max(0, Math.min(1, progress));
  const circumference = 2 * Math.PI * radius;
  const dash = Math.max(clamped, 0.02) * circumference;
  const angle = -Math.PI / 2 + clamped * Math.PI * 2;
  const dotX = cx + radius * Math.cos(angle);
  const dotY = cy + radius * Math.sin(angle);
  const longTime = time.length > 8;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[240px]">
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        {Array.from({ length: ticks }).map((_, index) => {
          const tickAngle = (index / ticks) * Math.PI * 2 - Math.PI / 2;
          const active = index / ticks <= clamped + 0.001;
          const inner = 92;
          const outer = 104;
          return (
            <line
              key={index}
              x1={cx + inner * Math.cos(tickAngle)}
              y1={cy + inner * Math.sin(tickAngle)}
              x2={cx + outer * Math.cos(tickAngle)}
              y2={cy + outer * Math.sin(tickAngle)}
              stroke={
                active
                  ? "#f97316"
                  : isDark
                    ? "rgba(255,255,255,0.18)"
                    : "#d6d3d1"
              }
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          );
        })}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={isDark ? "rgba(255,255,255,0.08)" : "#f3f1ef"}
          strokeWidth="8"
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#f97316"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {clamped > 0 && (
          <>
            <circle
              cx={dotX}
              cy={dotY}
              r="8"
              fill={isDark ? "#0e0e0e" : "#fff7f2"}
            />
            <circle cx={dotX} cy={dotY} r="5" fill="#f97316" />
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
        <p
          className={cn(
            "font-bold leading-none tracking-tight text-[#171717] tabular-nums",
            longTime
              ? "text-[20px] sm:text-[22px]"
              : "text-[26px] sm:text-[30px]",
            isDark && "text-white",
          )}
        >
          {time}
        </p>
        <p
          className={cn(
            "mt-2 text-base font-medium",
            isDark ? "text-neutral-200" : "text-[#292524]",
          )}
        >
          {caption}
        </p>
      </div>
    </div>
  );
}

export function ChallengeHero({
  isDark,
  isAdmin,
  challengeTitle,
  modeHeadline,
  leaderboardPeriod,
  periodOptions,
  onPeriodChange,
  totalPrizePoolLabel,
  prizeLabel,
  config,
  me,
  effectiveRange,
  endsIn,
  rangeEnded,
  scopeWindowLabel,
}: ChallengeHeroProps) {
  const [now, setNow] = useState(() => Date.now());
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const hasWindow =
    typeof effectiveRange?.start === "string" &&
    typeof effectiveRange?.end === "string";
  const startsAt = hasWindow
    ? new Date(effectiveRange.start!).getTime()
    : Number.NaN;
  const endsAt = hasWindow
    ? new Date(effectiveRange.end!).getTime()
    : Number.NaN;
  const startsSoon = Number.isFinite(startsAt) && startsAt > now;
  const statusLabel = !hasWindow
    ? "Not active"
    : rangeEnded
      ? "Completed"
      : startsSoon
        ? "Starting soon"
        : "Live now";
  const statusIsLive = hasWindow && !rangeEnded && !startsSoon;

  let clock = "—";
  let caption = "Not active";
  let progress = 0;
  if (!hasWindow) {
    clock = "—";
    caption = "Not active";
  } else if (rangeEnded) {
    clock = "Done";
    caption = "Completed";
    progress = 1;
  } else if (startsSoon) {
    const remain = Math.max(0, startsAt - now);
    clock = formatClock(remain);
    caption = "until start";
    progress = 1;
  } else {
    const remain = Math.max(0, endsAt - now);
    const total = Math.max(1, endsAt - startsAt);
    clock = formatClock(remain);
    caption = leftCaption(leaderboardPeriod);
    progress = remain / total;
  }

  const openRules = () => {
    setRulesOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById("daily-challenge-rules")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  };

  const prizeCards = [
    {
      key: "views",
      title: "Most views",
      icon: Eye,
      status: standingLine(me?.viewsRank, me?.remaining?.views),
    },
    {
      key: "reels",
      title: "Most reels",
      icon: Clapperboard,
      status: standingLine(me?.reelsRank, me?.remaining?.reels),
    },
  ];

  const intro = isAdmin
    ? "Track the active creator competition, verify the leaders, and review completed challenge windows."
    : "Compete for cash rewards with verified reels and views. Climb the leaderboard before the window closes.";

  return (
    <header
      className={cn(
        "rounded-[22px] border px-4 py-4 shadow-[0_1px_2px_rgba(120,72,20,0.04)] sm:px-5 sm:py-5",
        isDark ? "border-white/10 bg-[#161616]" : "border-[#f0e2d2] bg-white",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium",
                statusIsLive
                  ? isDark
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-[#e7f8ee] text-[#178a45]"
                  : isDark
                    ? "bg-white/10 text-neutral-300"
                    : "bg-neutral-100 text-[#292524]",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  statusIsLive ? "bg-[#22a85a]" : "bg-neutral-400",
                )}
                aria-hidden
              />
              {statusLabel}
            </span>
            <h1
              className={cn(
                "text-base font-semibold",
                isDark ? "text-white" : "text-neutral-950",
              )}
            >
              {challengeTitle}
            </h1>
          </div>
          <p
            className={cn(
              "mt-2 max-w-xl text-base leading-7",
              isDark ? "text-neutral-200" : "text-[#292524]",
            )}
          >
            {intro}
          </p>
        </div>

        <div
          className={cn(
            "inline-flex max-w-full items-center gap-0.5 self-start overflow-x-auto rounded-full p-1",
            isDark ? "bg-white/10" : "bg-[#f3f1ef]",
          )}
          role="tablist"
          aria-label="Competition window"
        >
          {periodOptions.map((option) => {
            const active = leaderboardPeriod === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onPeriodChange(option.value)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? isDark
                      ? "bg-white/15 text-white shadow-sm"
                      : "bg-white text-neutral-950 shadow-sm"
                    : isDark
                      ? "text-neutral-300 hover:text-white"
                      : "text-[#292524] hover:text-[#171717]",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div
          className={cn(
            "flex min-h-[280px] items-center justify-center rounded-2xl border px-4 py-6",
            isDark
              ? "border-white/10 bg-[#0e0e0e]"
              : "border-[#f3e6d8] bg-gradient-to-b from-white to-[#fff8f3]",
          )}
        >
          <CountdownDial
            progress={progress}
            time={clock}
            caption={caption}
            isDark={isDark}
          />
          <p className="sr-only">
            {startsSoon
              ? `Starts in ${getTimeUntil(effectiveRange?.start)}`
              : endsIn}
          </p>
        </div>

        {prizeCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className={cn(
                "flex min-h-[280px] flex-col justify-between rounded-2xl border p-5 sm:p-6",
                isDark
                  ? "border-[#c4a15a]/30 bg-[linear-gradient(180deg,rgba(196,161,90,0.22)_0%,rgba(14,14,14,0.55)_52%,#0e0e0e_100%)]"
                  : "border-[#f3e6d8] bg-gradient-to-b from-white to-[#fff8f3]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p
                  className={cn(
                    "flex items-center gap-2 text-base font-semibold",
                    isDark ? "text-white" : "text-[#171717]",
                  )}
                >
                  <Icon className={cn("h-4 w-4", isDark ? "text-[#c4a15a]" : "text-[#78716c]")} aria-hidden />
                  {card.title}
                </p>
                <button
                  type="button"
                  onClick={openRules}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm font-medium",
                    isDark
                      ? "text-neutral-200 hover:text-white"
                      : "text-[#292524] hover:text-[#171717]",
                  )}
                >
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px]">
                    i
                  </span>
                  How to win
                </button>
              </div>
              <div>
                <p
                  className={cn(
                    "text-4xl font-semibold tracking-tight",
                    isDark ? "text-white" : "text-[#171717]",
                  )}
                >
                  {prizeLabel}
                </p>
                <p
                  className={cn(
                    "mt-2 text-base font-medium",
                    isDark ? "text-neutral-200" : "text-[#292524]",
                  )}
                >
                  {card.status}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-4 border-t pt-3",
          isDark ? "border-white/10" : "border-[#f3ebe3]",
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 text-base font-semibold",
              isDark ? "text-white" : "text-neutral-950",
            )}
            aria-expanded={rulesOpen}
            aria-controls="daily-challenge-rules"
            onClick={() => setRulesOpen((open) => !open)}
          >
            How it works
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                rulesOpen && "rotate-180",
              )}
            />
          </button>
          <div
            className={cn(
              "text-base sm:text-right",
              isDark ? "text-neutral-200" : "text-[#292524]",
            )}
          >
            <p>
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.12em]",
                  isDark ? "text-neutral-300" : "text-[#292524]",
                )}
              >
                {modeHeadline} prize pool
              </span>
            </p>
            <p>
              <span
                className={cn(
                  "font-semibold",
                  isDark ? "text-white" : "text-neutral-950",
                )}
              >
                {totalPrizePoolLabel}
              </span>
              <span className={isDark ? "text-neutral-200" : "text-[#292524]"}>
                {" "}
                in prizes {modeHeadline.toLowerCase()}
                {hasWindow
                  ? ` · Ends ${formatShortIst(effectiveRange.end!)} IST`
                  : ""}
              </span>
            </p>
          </div>
        </div>

        {rulesOpen && (
          <div id="daily-challenge-rules" className="mt-3">
            <ol
              className={cn(
                "space-y-2.5 text-base leading-7",
                isDark ? "text-neutral-100" : "text-[#292524]",
              )}
            >
              <li>
                <span
                  className={cn(
                    "font-medium",
                    isDark ? "text-white" : "text-neutral-900",
                  )}
                >
                  1.{" "}
                </span>
                {intro} You&apos;re in automatically: every submission you make
                to any campaign during the window counts. There&apos;s nothing
                to join.
              </li>
              {config && (
                <li>
                  <span
                    className={cn(
                      "font-medium",
                      isDark ? "text-white" : "text-neutral-900",
                    )}
                  >
                    2.{" "}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      isDark ? "text-white" : "text-neutral-900",
                    )}
                  >
                    Most verified views.
                  </span>{" "}
                  Reach at least{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-neutral-900",
                    )}
                  >
                    {number(config.viewsMinViews)} combined verified views
                  </span>
                  . Get more verified views than any other eligible creator and
                  finish #1 on the Views leaderboard to win {prizeLabel}.
                </li>
              )}
              {config && (
                <li>
                  <span
                    className={cn(
                      "font-medium",
                      isDark ? "text-white" : "text-neutral-900",
                    )}
                  >
                    3.{" "}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      isDark ? "text-white" : "text-neutral-900",
                    )}
                  >
                    Most verified reels.
                  </span>{" "}
                  Submit at least{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-neutral-900",
                    )}
                  >
                    {verifiedReelsPhrase(config.reelsMinReels)}
                  </span>
                  . Each reel must have at least{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-neutral-900",
                    )}
                  >
                    {perReelMinVerifiedPhrase(config.minViewsPerReel)}
                  </span>
                  . Combined verified views for this board must reach at least{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-neutral-900",
                    )}
                  >
                    {number(config.reelsMinViews)}
                  </span>
                  . Submit more qualifying reels than any other eligible creator
                  and finish #1 on the Reels leaderboard to win {prizeLabel}.
                </li>
              )}
              <li>
                <span
                  className={cn(
                    "font-medium",
                    isDark ? "text-white" : "text-neutral-900",
                  )}
                >
                  {config ? "4. " : "2. "}
                </span>
                Windows run on India Standard Time: daily, Monday to Monday, or
                the calendar month.{" "}
                {hasWindow ? (
                  <>
                    This one runs{" "}
                    {formatContestInstantIst(effectiveRange.start!)} to{" "}
                    {formatContestInstantIst(effectiveRange.end!)}.
                  </>
                ) : (
                  <>The challenge window appears when this mode is active.</>
                )}{" "}
                Showing {scopeWindowLabel.toLowerCase()} posts.
              </li>
            </ol>
          </div>
        )}
      </div>
    </header>
  );
}
