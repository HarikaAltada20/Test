"use client";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { number, type Scope } from "./utils";

type CreatorProgressCardProps = {
  isDark: boolean;
  hasActiveEvent: boolean;
  me: {
    viewsRank?: number | null;
    reelsRank?: number | null;
    views?: number;
    reels?: number;
    eligibility?: { views?: boolean; reels?: boolean };
    remaining?: { views?: string; reels?: string };
  } | null;
  activeBoard: "views" | "reels";
  thirdPlaceViews?: number;
  thirdPlaceReels?: number;
  leaderboardPeriod?: string;
  prizeLabel?: string;
  config?: {
    viewsMinViews: number;
    reelsMinReels: number;
    reelsMinViews: number;
  } | null;
  scope: Scope;
  scopeOptions: { value: Scope; label: string }[];
  onScopeChange: (value: Scope) => void;
};

function isEligibleText(value?: string) {
  return String(value || "").toLowerCase().includes("eligible");
}

export function CreatorProgressCard({
  isDark,
  hasActiveEvent,
  me,
  activeBoard,
  thirdPlaceViews,
  thirdPlaceReels,
  scope,
  scopeOptions,
  onScopeChange,
}: CreatorProgressCardProps) {
  const viewsEligible = me?.eligibility?.views ?? isEligibleText(me?.remaining?.views);
  const reelsEligible = me?.eligibility?.reels ?? isEligibleText(me?.remaining?.reels);

  const columns = [
    {
      key: "views",
      title: "Views standing",
      rank: me?.viewsRank,
      eligible: viewsEligible,
      detail: me?.remaining?.views || "Submit and verify reels to track your progress.",
      extra:
        typeof me?.viewsRank === "number" &&
        me.viewsRank > 3 &&
        typeof thirdPlaceViews === "number" &&
        activeBoard === "views"
          ? `You need ${number(Math.max(0, thirdPlaceViews - (me?.views || 0)))} more views to reach #3.`
          : null,
    },
    {
      key: "reels",
      title: "Reels standing",
      rank: me?.reelsRank,
      eligible: reelsEligible,
      detail: me?.remaining?.reels || "Post consistently to climb the reels board.",
      extra:
        typeof me?.reelsRank === "number" &&
        me.reelsRank > 3 &&
        typeof thirdPlaceReels === "number" &&
        activeBoard === "reels"
          ? `You need ${number(Math.max(0, thirdPlaceReels - (me?.reels || 0)))} more reels to reach #3.`
          : null,
    },
  ];

  return (
    <section
      className={cn(
        "rounded-[22px] border px-4 py-4 sm:px-5 sm:py-5 shadow-[0_1px_2px_rgba(120,72,20,0.04)]",
        isDark ? "border-white/10 bg-[#161616]" : "border-neutral-200 bg-white",
      )}
      aria-labelledby="creator-progress-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="creator-progress-heading"
            className={cn("text-base font-semibold", isDark ? "text-white" : "text-[#171717]")}
          >
            Your position
          </h2>
          <p className={cn("mt-0.5 text-sm", isDark ? "text-neutral-300" : "text-[#44403c]")}>
            Your current standing in this competition window
          </p>
        </div>
        <div className="w-full sm:w-[210px]">
          <p className={cn("mb-1.5 text-xs font-semibold uppercase tracking-[0.12em]", isDark ? "text-neutral-300" : "text-[#44403c]")}>
            Submission status
          </p>
          <Select value={scope} onValueChange={(value) => onScopeChange(value as Scope)}>
            <SelectTrigger
              isDark={isDark}
              aria-label="Submission status"
              className={cn(
                "h-11 w-full rounded-full px-4 text-base font-medium",
                isDark ? "border-white/15 bg-white/5 text-white" : "border-neutral-300 bg-white text-[#171717]",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent isDark={isDark}>
              {scopeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} isDark={isDark}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!hasActiveEvent && (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No event covers this mode yet. Ranks and eligibility appear when a matching window is live.
        </p>
      )}

      <div className={cn("mt-4 grid gap-0 md:grid-cols-2 md:divide-x", isDark ? "md:divide-white/10" : "md:divide-neutral-200")}>
        {columns.map((column, index) => (
          <div key={column.key} className={cn("py-1", index === 0 ? "md:pr-6" : "mt-4 border-t pt-4 md:mt-0 md:border-t-0 md:pl-6")}>
            <div className="flex items-center justify-between gap-3">
              <p className={cn("text-base font-semibold", isDark ? "text-white" : "text-[#171717]")}>{column.title}</p>
              <p className={cn("text-lg font-semibold tabular-nums", isDark ? "text-white" : "text-[#171717]")}>
                {column.rank ? `#${column.rank}` : "—"}
              </p>
            </div>
            <p className={cn("mt-1 text-sm", isDark ? "text-neutral-300" : "text-[#44403c]")}>{column.detail}</p>
            <span
              className={cn(
                "mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-sm font-medium",
                column.eligible
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : isDark
                    ? "border-white/15 text-neutral-200"
                    : "border-neutral-300 bg-white text-[#171717]",
              )}
            >
              {column.eligible ? "Eligible" : "Needs more"}
            </span>
            {column.extra && <p className="mt-2 text-sm font-medium text-[#c2410c]">{column.extra}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
