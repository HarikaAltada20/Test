"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { formatCompactCount } from "@/lib/currency-utils";
import type { BrandAnalyticsSeriesPoint } from "@/lib/brand-analytics-graph";
import { cn } from "@/lib/utils";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";

type ChartMetric = "views" | "likes" | "comments" | "shares";

const CHART_TABS: { id: ChartMetric; label: string }[] = [
  { id: "views", label: "Views" },
  { id: "likes", label: "Likes" },
  { id: "comments", label: "Comments" },
  { id: "shares", label: "Shares" },
];

const STATUS_SERIES: {
  dataKey: keyof BrandAnalyticsSeriesPoint;
  color: string;
  label: string;
}[] = [
  { dataKey: "pendingViews", color: "#F59E0B", label: "Pending Views" },
  { dataKey: "verifiedViews", color: "#22C55E", label: "Verified Views" },
  { dataKey: "paidViews", color: "#3B82F6", label: "Paid Views" },
  { dataKey: "rejectedViews", color: "#EF4444", label: "Rejected Views" },
];

type BrandAnalyticsGraphProps = {
  analyticsQueryString: string;
};

function AnalyticsChartTooltip({
  active,
  payload,
  label,
  isDark,
  chartMetric,
}: {
  active?: boolean;
  payload?: Array<{ payload?: BrandAnalyticsSeriesPoint }>;
  label?: string;
  isDark: boolean;
  chartMetric: ChartMetric;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const metricLabel =
    CHART_TABS.find((t) => t.id === chartMetric)?.label || chartMetric;
  const metricValue = Number(row[chartMetric] ?? 0);

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 shadow-lg text-sm",
        isDark
          ? "border-white/10 bg-[#1a1a1a] text-white"
          : "border-black/10 bg-white text-black",
      )}
    >
      <p className="font-medium mb-1.5">{String(label)}</p>
      <p className="text-[#7F39EC] mb-1">
        {metricLabel} : {metricValue.toLocaleString()}
      </p>
      {chartMetric === "views" && (
        <div className="space-y-0.5 pt-1 border-t border-black/5 dark:border-white/10">
          {STATUS_SERIES.map((s) => (
            <p key={s.dataKey} style={{ color: s.color }}>
              {s.label} : {Number(row[s.dataKey] ?? 0).toLocaleString()}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BrandAnalyticsGraph({
  analyticsQueryString,
}: BrandAnalyticsGraphProps) {
  const { isDark } = useAnalyticsDarkMode();
  const [chartMetric, setChartMetric] = useState<ChartMetric>("views");
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<BrandAnalyticsSeriesPoint[]>([]);
  const [summary, setSummary] = useState({
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const fetchGraph = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/analytics/graph?${analyticsQueryString}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load graph data");
        }
        const json = await res.json();
        if (!active) return;
        setSeries(json.series ?? []);
        setSummary(
          json.summary ?? { views: 0, likes: 0, comments: 0, shares: 0 },
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "Failed to load graph data",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchGraph();
    return () => {
      active = false;
      controller.abort();
    };
  }, [analyticsQueryString]);

  const chartTotal = summary[chartMetric] ?? 0;

  const cardClass = cn(
    "rounded-2xl border p-4 sm:p-5",
    isDark
      ? "border-white/10 bg-[#121212] text-white"
      : "border-black/5 bg-white text-black shadow-[0px_5px_20px_0px_#0000000D]",
  );

  return (
    <div className="space-y-4">
      <div className={cn(cardClass, "min-h-[420px]")}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white/55" : "text-black/55",
              )}
            >
              All Campaigns
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {loading ? "…" : chartTotal.toLocaleString()}
            </p>
          </div>

          <div
            className={cn(
              "inline-flex flex-wrap gap-1 rounded-full border p-1",
              isDark
                ? "border-white/10 bg-[#0d0d0d]"
                : "border-black/10 bg-[#f5f5f5]",
            )}
          >
            {CHART_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChartMetric(tab.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  chartMetric === tab.id
                    ? "bg-[#7F39EC] text-white"
                    : isDark
                      ? "text-white/60 hover:text-white"
                      : "text-black/55 hover:text-black",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative h-[320px] w-full sm:h-[380px]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-inherit/40">
              <Loader2 className="h-7 w-7 animate-spin text-[#7F39EC]" />
            </div>
          )}
          {!loading && series.length === 0 ? (
            <div
              className={cn(
                "flex h-full items-center justify-center text-sm",
                isDark ? "text-white/40" : "text-black/40",
              )}
            >
              No submission activity in this range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={series}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <defs>
                  <linearGradient
                    id="brandAnalyticsFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#7F39EC" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#7F39EC" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke={
                    isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
                  }
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                  tick={{
                    fill: isDark
                      ? "rgba(255,255,255,0.45)"
                      : "rgba(0,0,0,0.45)",
                    fontSize: 12,
                  }}
                />
                <YAxis
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v) => formatCompactCount(Number(v))}
                  tick={{
                    fill: isDark
                      ? "rgba(255,255,255,0.45)"
                      : "rgba(0,0,0,0.45)",
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  content={
                    <AnalyticsChartTooltip
                      isDark={isDark}
                      chartMetric={chartMetric}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke="#7F39EC"
                  strokeWidth={2.5}
                  fill="url(#brandAnalyticsFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#7F39EC" }}
                />
                {chartMetric === "views" &&
                  STATUS_SERIES.map((s) => (
                    <Line
                      key={s.dataKey}
                      type="monotone"
                      dataKey={s.dataKey}
                      stroke={s.color}
                      strokeWidth={1.75}
                      dot={false}
                      activeDot={{ r: 3, fill: s.color }}
                    />
                  ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
