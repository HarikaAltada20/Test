"use client";

import {
  Clock,
  Eye,
  Share2,
  ThumbsUp,
  ThumbsDown,
  UserPlus,
  UserMinus,
  ListPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { YouTubeMetrics } from "./types";
import { fmt, fmtDuration, fmtMinutes, SectionHeader, StatRow } from "./shared";

export function YouTubeAnalyticsOverview({
  metrics,
  isDark,
  showCore = true,
}: {
  metrics: YouTubeMetrics;
  isDark?: boolean;
  showCore?: boolean;
}) {
  const dark = !!isDark;

  const hasCore =
    (metrics.estimated_minutes_watched ?? 0) > 0 ||
    (metrics.avg_view_percentage ?? 0) > 0 ||
    (metrics.shares ?? 0) > 0;

  if (!showCore) return null;

  if (!hasCore) {
    return (
      <div>
        <SectionHeader
          isDark={dark}
          icon={<Eye className="h-3.5 w-3.5" />}
          title="Core Analytics"
        />
        <p
          className={cn(
            "text-[11px] italic",
            dark ? "text-slate-500" : "text-slate-400",
          )}
        >
          No data yet — click &quot;Refresh Core Analytics&quot; to fetch.
        </p>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        isDark={dark}
        icon={<Eye className="h-3.5 w-3.5" />}
        title="Core Analytics"
      />
      <div
        className={cn(
          "rounded-md border px-3 py-1 divide-y",
          dark
            ? "border-slate-700 divide-slate-700"
            : "border-slate-100 divide-slate-100",
        )}
      >
        {(metrics.avg_view_percentage ?? 0) > 0 && (
          <StatRow
            isDark={dark}
            icon={<Eye className="h-3.5 w-3.5" />}
            label="Avg View %"
            value={`${metrics.avg_view_percentage!.toFixed(1)}%`}
            color={
              metrics.avg_view_percentage! < 10
                ? "text-red-600"
                : metrics.avg_view_percentage! < 30
                  ? "text-yellow-600"
                  : "text-green-600"
            }
          />
        )}
        {(metrics.estimated_minutes_watched ?? 0) > 0 && (
          <StatRow
            isDark={dark}
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Watch Time"
            value={fmtMinutes(metrics.estimated_minutes_watched)}
          />
        )}
        {(metrics.avg_view_duration_seconds ?? 0) > 0 && (
          <StatRow
            isDark={dark}
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Avg Duration"
            value={fmtDuration(metrics.avg_view_duration_seconds)}
          />
        )}
        {(metrics.engaged_views ?? 0) > 0 && (
          <StatRow
            isDark={dark}
            icon={<Eye className="h-3.5 w-3.5" />}
            label="Engaged Views"
            value={fmt(metrics.engaged_views)}
            sub={
              metrics.views
                ? `${((metrics.engaged_views! / metrics.views) * 100).toFixed(0)}%`
                : undefined
            }
          />
        )}
        {(metrics.shares ?? 0) > 0 && (
          <StatRow
            isDark={dark}
            icon={<Share2 className="h-3.5 w-3.5" />}
            label="Shares"
            value={fmt(metrics.shares)}
          />
        )}
        {(metrics.likes ?? 0) > 0 && (
          <StatRow
            isDark={dark}
            icon={<ThumbsUp className="h-3.5 w-3.5" />}
            label="Likes"
            value={fmt(metrics.likes)}
          />
        )}
        {(metrics.dislikes ?? 0) > 0 && (
          <StatRow
            isDark={dark}
            icon={<ThumbsDown className="h-3.5 w-3.5" />}
            label="Dislikes"
            value={fmt(metrics.dislikes)}
            color="text-red-500"
          />
        )}
        {(metrics.subscribers_gained ?? 0) > 0 && (
          <StatRow
            isDark={dark}
            icon={<UserPlus className="h-3.5 w-3.5" />}
            label="Subs Gained"
            value={`+${fmt(metrics.subscribers_gained)}`}
            color="text-green-600"
          />
        )}
        {(metrics.subscribers_lost ?? 0) > 0 && (
          <StatRow
            isDark={dark}
            icon={<UserMinus className="h-3.5 w-3.5" />}
            label="Subs Lost"
            value={`-${fmt(metrics.subscribers_lost)}`}
            color="text-red-500"
          />
        )}
        {(metrics.videos_added_to_playlists ?? 0) > 0 && (
          <StatRow
            isDark={dark}
            icon={<ListPlus className="h-3.5 w-3.5" />}
            label="Added to Playlists"
            value={fmt(metrics.videos_added_to_playlists)}
          />
        )}
      </div>
    </div>
  );
}
