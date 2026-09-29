/** Rich geography metrics (city / country / province) — mirrors YouTube Studio breakdowns. */

export interface GeoMetricRow {
  views: number;
  views_pct: number;
  watch_time_minutes: number;
  watch_time_pct: number;
  avg_view_duration_seconds: number;
}

/** Legacy storage was view-percentage only. */
export type GeoMetricValue = GeoMetricRow | number;

export function isGeoMetricRow(value: GeoMetricValue): value is GeoMetricRow {
  return typeof value === "object" && value !== null && "views_pct" in value;
}

export function normalizeGeoMetric(value: GeoMetricValue | undefined): GeoMetricRow | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return {
      views: 0,
      views_pct: value,
      watch_time_minutes: 0,
      watch_time_pct: 0,
      avg_view_duration_seconds: 0,
    };
  }
  return value;
}

export function geoSortScore(value: GeoMetricValue): number {
  const row = normalizeGeoMetric(value);
  if (!row) return 0;
  return row.views > 0 ? row.views : row.views_pct;
}

/** Parse Analytics API rows: dim | views | estimatedMinutesWatched | averageViewDuration */
export function rowsToGeoMetrics(
  rows: unknown[][] | null | undefined,
): Record<string, GeoMetricRow> {
  if (!rows || rows.length === 0) return {};

  let totalViews = 0;
  let totalMinutes = 0;
  const parsed: Array<{
    key: string;
    views: number;
    minutes: number;
    avgDur: number;
  }> = [];

  for (const row of rows) {
    const key = String(row[0] ?? "");
    if (!key) continue;
    const views = Number(row[1] || 0);
    const minutes = Number(row[2] || 0);
    const avgDur = Number(row[3] || 0);
    totalViews += views;
    totalMinutes += minutes;
    parsed.push({ key, views, minutes, avgDur });
  }

  const out: Record<string, GeoMetricRow> = {};
  for (const p of parsed) {
    out[p.key] = {
      views: viewsRound(p.views),
      views_pct:
        totalViews > 0
          ? Math.round((p.views / totalViews) * 1000) / 10
          : 0,
      watch_time_minutes: Math.round(p.minutes * 10) / 10,
      watch_time_pct:
        totalMinutes > 0
          ? Math.round((p.minutes / totalMinutes) * 1000) / 10
          : 0,
      avg_view_duration_seconds: Math.round(p.avgDur),
    };
  }
  return out;
}

function viewsRound(n: number): number {
  return Math.round(n);
}

export function formatWatchTimeHours(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const hours = minutes / 60;
  if (hours >= 10) return `${hours.toFixed(0)}h`;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  return `${Math.round(minutes)}m`;
}

export function formatAvgDurationShort(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatGeoRowForExport(
  label: string,
  row: GeoMetricRow,
): string {
  const parts: string[] = [label];
  if (row.views > 0) {
    parts.push(`${row.views.toLocaleString()} views (${row.views_pct.toFixed(1)}%)`);
  } else if (row.views_pct > 0) {
    parts.push(`${row.views_pct.toFixed(1)}% views`);
  }
  if (row.watch_time_minutes > 0) {
    parts.push(
      `${formatWatchTimeHours(row.watch_time_minutes)} watch (${row.watch_time_pct.toFixed(1)}%)`,
    );
  }
  if (row.avg_view_duration_seconds > 0) {
    parts.push(`avg ${formatAvgDurationShort(row.avg_view_duration_seconds)}`);
  }
  return parts.join(" · ");
}

export function hasRichGeoData(
  map: Record<string, GeoMetricValue> | undefined,
): boolean {
  if (!map) return false;
  return Object.values(map).some((v) => {
    const row = normalizeGeoMetric(v);
    return row != null && row.views > 0;
  });
}
