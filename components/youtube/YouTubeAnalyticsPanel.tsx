"use client";

import { BarChart2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YT_ANALYTICS_DEFAULT_WINDOW_DAYS } from "@/lib/youtube-constants";
import type { YouTubeMetrics } from "@/components/youtube/analytics/types";
import { YouTubeAnalyticsOverview } from "@/components/youtube/analytics/YouTubeAnalyticsOverview";
import { YouTubeAnalyticsTrafficTab } from "@/components/youtube/analytics/YouTubeAnalyticsTrafficTab";
import { YouTubeAnalyticsAudienceTab } from "@/components/youtube/analytics/YouTubeAnalyticsAudienceTab";
import { YouTubeAnalyticsWatchTab } from "@/components/youtube/analytics/YouTubeAnalyticsWatchTab";
import { timeAgo } from "@/components/youtube/analytics/shared";

export type { YouTubeMetrics } from "@/components/youtube/analytics/types";

interface Props {
  metrics: YouTubeMetrics;
  isDark?: boolean;
  children: React.ReactNode;
  showCore?: boolean;
  showTraffic?: boolean;
  showDemographics?: boolean;
}

export function YouTubeAnalyticsPanel({
  metrics,
  isDark,
  children,
  showCore = true,
  showTraffic = true,
  showDemographics = true,
}: Props) {
  const dark = !!isDark;
  const botScore = metrics.bot_score;
  const botColor =
    botScore == null
      ? dark
        ? "text-slate-500"
        : "text-slate-400"
      : botScore >= 60
        ? "text-red-600"
        : botScore >= 30
          ? "text-yellow-600"
          : "text-green-600";

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className={cn(
          "z-[100] w-full max-w-xs sm:w-96 p-4 text-sm shadow-xl border max-h-[85vh] overflow-hidden flex flex-col",
          isDark
            ? "bg-slate-900 border-slate-700 text-slate-100"
            : "bg-white border-slate-200 text-slate-900",
        )}
        align="end"
        side="left"
        sideOffset={8}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <BarChart2
              className={cn(
                "h-4 w-4",
                dark ? "text-purple-400" : "text-purple-500",
              )}
            />
            <span
              className={cn(
                "font-semibold text-sm",
                dark ? "text-slate-100" : "text-slate-900",
              )}
            >
              YouTube Analytics
            </span>
          </div>
          {metrics.analytics_needs_reauth ? (
            <Badge variant="destructive" className="text-[10px] h-5">
              Needs Reauth
            </Badge>
          ) : botScore != null ? (
            <span className={cn("text-xs font-bold", botColor)}>
              {botScore >= 60 ? "⚠ " : ""}Bot Score: {botScore}/100
            </span>
          ) : null}
        </div>

        {(metrics.bot_flags?.length ?? 0) > 0 && (
          <div
            className={cn(
              "mb-2 rounded-md border p-2 space-y-0.5 shrink-0 max-h-24 overflow-y-auto",
              dark
                ? "bg-red-950/40 border-red-900/70"
                : "bg-red-50 border-red-200",
            )}
          >
            {metrics.bot_flags!.map((flag, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-1.5 text-[11px]",
                  dark ? "text-red-300" : "text-red-700",
                )}
              >
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {flag}
              </div>
            ))}
          </div>
        )}

        <Tabs defaultValue="overview" className="flex-1 min-h-0 flex flex-col">
          <TabsList
            className={cn(
              "h-auto w-full grid grid-cols-4 gap-0.5 p-1 shrink-0",
              dark ? "bg-slate-800 border-slate-700" : "bg-slate-100",
            )}
          >
            <TabsTrigger
              value="overview"
              className="text-[10px] px-1 py-1.5 data-[state=active]:scale-100 h-auto"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="traffic"
              className="text-[10px] px-1 py-1.5 data-[state=active]:scale-100 h-auto"
              disabled={!showTraffic}
            >
              Traffic
            </TabsTrigger>
            <TabsTrigger
              value="audience"
              className="text-[10px] px-1 py-1.5 data-[state=active]:scale-100 h-auto"
              disabled={!showDemographics}
            >
              Audience
            </TabsTrigger>
            <TabsTrigger
              value="watch"
              className="text-[10px] px-1 py-1.5 data-[state=active]:scale-100 h-auto"
              disabled={!showCore}
            >
              Watch
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto overscroll-y-contain mt-2 min-h-0 pr-0.5">
            <TabsContent value="overview" className="mt-0">
              <YouTubeAnalyticsOverview
                metrics={metrics}
                isDark={dark}
                showCore={showCore}
              />
            </TabsContent>
            <TabsContent value="traffic" className="mt-0">
              <YouTubeAnalyticsTrafficTab
                metrics={metrics}
                isDark={dark}
                showTraffic={showTraffic}
              />
            </TabsContent>
            <TabsContent value="audience" className="mt-0">
              <YouTubeAnalyticsAudienceTab
                metrics={metrics}
                isDark={dark}
                showDemographics={showDemographics}
              />
            </TabsContent>
            <TabsContent value="watch" className="mt-0">
              <YouTubeAnalyticsWatchTab
                metrics={metrics}
                isDark={dark}
                showCore={showCore}
              />
            </TabsContent>
          </div>
        </Tabs>

        <div
          className={cn(
            "mt-2 pt-2 border-t text-[10px] flex justify-between shrink-0",
            isDark
              ? "border-slate-700 text-slate-500"
              : "border-slate-100 text-slate-400",
          )}
        >
          <span>Core: {timeAgo(metrics.last_basic_update)}</span>
          <span>Traffic: {timeAgo(metrics.last_traffic_update)}</span>
          <span>Demo: {timeAgo(metrics.last_demographics_update)}</span>
        </div>
        <p
          className={cn(
            "mt-1 text-[10px] shrink-0",
            isDark ? "text-slate-500" : "text-slate-400",
          )}
        >
          Max. analytics window: last {YT_ANALYTICS_DEFAULT_WINDOW_DAYS} days
        </p>
      </PopoverContent>
    </Popover>
  );
}
