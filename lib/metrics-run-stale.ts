import { METRICS_RUN_STALE_MS } from "@/lib/constants";

/**
 * If a run has no heartbeat for this long, treat it as stuck.
 * Same window as UI button disable and server abandon.
 */
export const STALE_METRICS_RUN_MS = METRICS_RUN_STALE_MS;

export type MetricsRunHeartbeat = {
  started_at?: string | null;
  updated_at?: string | null;
  last_batch_completed_at?: string | null;
};

function heartbeatMs(run: MetricsRunHeartbeat): number | null {
  const progressTimes = [run.last_batch_completed_at, run.updated_at]
    .map((v) => (v ? new Date(v).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  if (progressTimes.length > 0) return Math.max(...progressTimes);
  if (run.started_at) {
    const started = new Date(run.started_at).getTime();
    if (Number.isFinite(started)) return started;
  }
  return null;
}

/** True when the run has not progressed recently enough to still count as active. */
export function isMetricsRunStale(
  run: MetricsRunHeartbeat,
  nowMs: number = Date.now(),
  staleAfterMs: number = STALE_METRICS_RUN_MS,
): boolean {
  const heartbeat = heartbeatMs(run);
  if (heartbeat == null) return true;
  return nowMs - heartbeat >= staleAfterMs;
}

/** Age of the newest progress heartbeat in ms, or null if unknown. */
export function metricsRunHeartbeatAgeMs(
  run: MetricsRunHeartbeat,
  nowMs: number = Date.now(),
): number | null {
  const heartbeat = heartbeatMs(run);
  if (heartbeat == null) return null;
  return nowMs - heartbeat;
}
