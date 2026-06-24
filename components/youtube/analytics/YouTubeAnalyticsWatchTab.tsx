"use client";

import { useMemo } from "react";
import { LineChart, Eye } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { YouTubeMetrics } from "./types";
import { EmptyTabMessage, SectionHeader } from "./shared";

function downsampleRetention(
  points: NonNullable<YouTubeMetrics["audience_retention"]>,
  target = 24,
) {
  if (points.length <= target) {
    return points.map((p) => ({
      pct: Math.round(p.elapsed_ratio * 100),
      retention: Math.round(p.watch_ratio * 1000) / 10,
    }));
  }
  const step = Math.ceil(points.length / target);
  const out: { pct: number; retention: number }[] = [];
  for (let i = 0; i < points.length; i += step) {
    const p = points[i];
    out.push({
      pct: Math.round(p.elapsed_ratio * 100),
      retention: Math.round(p.watch_ratio * 1000) / 10,
    });
  }
  return out;
}

export function YouTubeAnalyticsWatchTab({
  metrics,
  isDark,
  showCore = true,
}: {
  metrics: YouTubeMetrics;
  isDark?: boolean;
  showCore?: boolean;
}) {
  const dark = !!isDark;
  const retention = metrics.audience_retention ?? [];
  const chartData = useMemo(
    () => downsampleRetention(retention),
    [retention],
  );

  const midpoint = retention.find((p) => p.elapsed_ratio >= 0.5);
  const midpointPct = midpoint
    ? Math.round(midpoint.watch_ratio * 100)
    : null;

  if (!showCore) return null;

  return (
    <div>
      <SectionHeader
        isDark={dark}
        icon={<LineChart className="h-3.5 w-3.5" />}
        title="Audience retention"
      />

      {chartData.length === 0 ? (
        <EmptyTabMessage
          isDark={dark}
          message='No retention data — click "Refresh Core Analytics".'
        />
      ) : (
        <>
          {midpointPct != null && (
            <p
              className={cn(
                "text-[11px] mb-2",
                dark ? "text-slate-400" : "text-slate-500",
              )}
            >
              <Eye className="inline h-3 w-3 mr-1 -mt-0.5" />
              {midpointPct}% of viewers still watching at the midpoint
            </p>
          )}
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="ytRetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={dark ? "#a78bfa" : "#8b5cf6"}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor={dark ? "#a78bfa" : "#8b5cf6"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="pct"
                  tick={{ fontSize: 9, fill: dark ? "#94a3b8" : "#64748b" }}
                  tickFormatter={(v) => `${v}%`}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: dark ? "#94a3b8" : "#64748b" }}
                  tickFormatter={(v) => `${v}%`}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    background: dark ? "#1e293b" : "#fff",
                    border: dark ? "1px solid #334155" : "1px solid #e2e8f0",
                  }}
                  formatter={(value: number) => [`${value}%`, "Watching"]}
                  labelFormatter={(label) => `At ${label}% of video`}
                />
                <Area
                  type="monotone"
                  dataKey="retention"
                  stroke={dark ? "#c4b5fd" : "#7c3aed"}
                  fill="url(#ytRetGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
