function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function readNumericField(obj: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return NaN;
}

/**
 * X-App-Usage: classic Graph uses call_count, total_time, total_cputime.
 * Instagram Graph often returns call_volume, cpu_time (and sometimes total_time).
 */
export function parseXAppUsageRaw(raw: string): {
  call_count: number;
  total_time: number;
  total_cputime: number;
} | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const call_count = clampPct(
      readNumericField(o, ["call_count", "call_volume"])
    );
    const total_time = clampPct(
      readNumericField(o, ["total_time", "total_wall_time"])
    );
    const total_cputime = clampPct(
      readNumericField(o, ["total_cputime", "cpu_time", "cputime"])
    );
    return { call_count, total_time, total_cputime };
  } catch {
    return null;
  }
}
