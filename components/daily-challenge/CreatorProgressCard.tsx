"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { number } from "./utils";

type CreatorProgressCardProps = {
  isDark: boolean;
  hasActiveEvent: boolean;
  me: {
    viewsRank?: number | null;
    reelsRank?: number | null;
    views?: number;
    reels?: number;
    remaining?: { views?: string; reels?: string };
  } | null;
  activeBoard: "views" | "reels";
  thirdPlaceViews?: number;
  thirdPlaceReels?: number;
};

export function CreatorProgressCard({
  isDark,
  hasActiveEvent,
  me,
  activeBoard,
  thirdPlaceViews,
  thirdPlaceReels,
}: CreatorProgressCardProps) {
  return (
    <section
      className={cn(
        "px-4 py-4 sm:px-6",
        isDark ? "bg-violet-500/[0.06]" : "bg-violet-50/50",
      )}
      aria-labelledby="creator-progress-heading"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 id="creator-progress-heading" className="text-sm font-bold text-foreground">
            Your position
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your current standing in this competition window
          </p>
        </div>
      </div>
      <div className="grid gap-0 text-sm md:grid-cols-2 md:divide-x">
        {!hasActiveEvent && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 md:col-span-2">
            No event covers this mode yet. Ranks and eligibility appear when a matching window is live.
          </p>
        )}
        <div className="py-1 pr-0 md:pr-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Views standing</p>
            <p className="text-lg font-black tabular-nums">
              {me?.viewsRank ? `#${me.viewsRank}` : "—"}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {me?.remaining?.views || "Submit and verify reels to track your progress."}
          </p>
          <Badge
            variant={String(me?.remaining?.views || "").toLowerCase().includes("eligible") ? "default" : "outline"}
            className={cn(
              "mt-2 text-[10px]",
              String(me?.remaining?.views || "").toLowerCase().includes("eligible") &&
                "bg-emerald-600 hover:bg-emerald-600",
            )}
          >
            {String(me?.remaining?.views || "").toLowerCase().includes("eligible")
              ? "Eligible"
              : "Needs more"}
          </Badge>
          {typeof me?.viewsRank === "number" &&
            me.viewsRank > 3 &&
            typeof thirdPlaceViews === "number" &&
            activeBoard === "views" && (
              <p className="text-xs mt-2.5 text-violet-600">
                You need {number(Math.max(0, thirdPlaceViews - (me.views || 0)))} more views to reach #3.
              </p>
            )}
        </div>
        <div className="mt-4 border-t pt-4 md:mt-0 md:border-t-0 md:pl-6 md:pt-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Reels standing</p>
            <p className="text-lg font-black tabular-nums">
              {me?.reelsRank ? `#${me.reelsRank}` : "—"}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {me?.remaining?.reels || "Post consistently to climb the reels board."}
          </p>
          <Badge
            variant={String(me?.remaining?.reels || "").toLowerCase().includes("eligible") ? "default" : "outline"}
            className={cn(
              "mt-2 text-[10px]",
              String(me?.remaining?.reels || "").toLowerCase().includes("eligible") &&
                "bg-emerald-600 hover:bg-emerald-600",
            )}
          >
            {String(me?.remaining?.reels || "").toLowerCase().includes("eligible")
              ? "Eligible"
              : "Needs more"}
          </Badge>
          {typeof me?.reelsRank === "number" &&
            me.reelsRank > 3 &&
            typeof thirdPlaceReels === "number" &&
            activeBoard === "reels" && (
              <p className="text-xs mt-2.5 text-violet-600">
                You need {number(Math.max(0, thirdPlaceReels - (me.reels || 0)))} more reels to reach #3.
              </p>
            )}
        </div>
      </div>
    </section>
  );
}
