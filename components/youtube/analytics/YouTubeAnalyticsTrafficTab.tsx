"use client";

import { useState } from "react";
import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBSCRIBED_LABELS } from "@/lib/youtube-analytics-labels";
import type { YouTubeMetrics } from "./types";
import {
  EmptyTabMessage,
  PctBar,
  SectionHeader,
  TrafficSourceBar,
  timeAgo,
} from "./shared";

const MIN_TRAFFIC_PCT = 0.1;
const DEFAULT_VISIBLE_SOURCES = 6;

function DetailSection({
  title,
  items,
  isDark,
}: {
  title: string;
  items: [string, number][];
  isDark?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wide mb-1.5",
          isDark ? "text-slate-500" : "text-slate-400",
        )}
      >
        {title}
      </p>
      {items.map(([label, pct]) => (
        <PctBar
          key={label}
          label={label.length > 40 ? `${label.slice(0, 37)}…` : label}
          pct={pct}
          barClass="bg-amber-400"
          isDark={isDark}
          truncateLabel={160}
        />
      ))}
    </div>
  );
}

export function YouTubeAnalyticsTrafficTab({
  metrics,
  isDark,
  showTraffic = true,
}: {
  metrics: YouTubeMetrics;
  isDark?: boolean;
  showTraffic?: boolean;
}) {
  const dark = !!isDark;
  const [showAllSources, setShowAllSources] = useState(false);

  const sources = metrics.traffic_sources ?? {};
  const sorted = Object.entries(sources)
    .filter(([, pct]) => pct >= MIN_TRAFFIC_PCT)
    .sort((a, b) => b[1] - a[1]);

  const hasTraffic = sorted.length > 0;
  const hasSubscribed =
    metrics.subscribed_status &&
    Object.keys(metrics.subscribed_status).length > 0;
  const details = metrics.traffic_source_details ?? {};
  const searchTerms = Object.entries(details.YT_SEARCH ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const externalRefs = Object.entries(details.EXT_URL ?? {}).sort(
    (a, b) => b[1] - a[1],
  );

  const hasAny =
    hasTraffic ||
    hasSubscribed ||
    searchTerms.length > 0 ||
    externalRefs.length > 0;

  if (!showTraffic) return null;

  return (
    <div>
      <SectionHeader
        isDark={dark}
        icon={<BarChart2 className="h-3.5 w-3.5" />}
        title="Traffic"
      />

      {!hasAny ? (
        <EmptyTabMessage
          isDark={dark}
          message='No data yet — click "Refresh Traffic Sources".'
        />
      ) : (
        <>
          {hasSubscribed && (
            <div className="mb-3">
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide mb-1.5",
                  dark ? "text-slate-500" : "text-slate-400",
                )}
              >
                Subscriber split
              </p>
              {Object.entries(metrics.subscribed_status!)
                .sort((a, b) => b[1] - a[1])
                .map(([key, pct]) => (
                  <PctBar
                    key={key}
                    label={SUBSCRIBED_LABELS[key] ?? key}
                    pct={pct}
                    barClass="bg-blue-400"
                    isDark={dark}
                  />
                ))}
            </div>
          )}

          {hasTraffic && (
            <div>
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide mb-1.5",
                  dark ? "text-slate-500" : "text-slate-400",
                )}
              >
                Sources
              </p>
              {(showAllSources
                ? sorted
                : sorted.slice(0, DEFAULT_VISIBLE_SOURCES)
              ).map(([source, pct]) => (
                <TrafficSourceBar
                  key={source}
                  source={source}
                  pct={pct}
                  isDark={dark}
                />
              ))}
              {sorted.length > DEFAULT_VISIBLE_SOURCES && (
                <button
                  type="button"
                  onClick={() => setShowAllSources((v) => !v)}
                  className={cn(
                    "text-[10px] mt-1 underline-offset-2 hover:underline",
                    dark ? "text-purple-400" : "text-purple-600",
                  )}
                >
                  {showAllSources
                    ? "Show fewer"
                    : `Show all (${sorted.length})`}
                </button>
              )}
            </div>
          )}

          <DetailSection
            title="Top search terms"
            items={searchTerms}
            isDark={dark}
          />
          <DetailSection
            title="Top external referrers"
            items={externalRefs}
            isDark={dark}
          />

          <p
            className={cn(
              "text-[10px] mt-2",
              dark ? "text-slate-500" : "text-slate-400",
            )}
          >
            Updated {timeAgo(metrics.last_traffic_update)}
          </p>
        </>
      )}
    </div>
  );
}
