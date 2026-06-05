/**
 * Client-side metrics refresh run polling.
 * Polls only while a run is pending/running; stops when run is null or terminal.
 */

export type MetricsRefreshRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type MetricsRefreshRun = {
  id: string;
  status: MetricsRefreshRunStatus;
};

export type MetricsRefreshPlatform =
  | "youtube"
  | "instagram"
  | "twitter"
  | "tiktok";

const STATUS_PATH: Record<MetricsRefreshPlatform, string> = {
  youtube: "youtube-metrics-refresh",
  instagram: "instagram-insights-refresh",
  twitter: "twitter-metrics-refresh",
  tiktok: "tiktok-metrics-refresh",
};

export function resolveMetricsRefreshPlatform(
  platform: string | null | undefined,
): MetricsRefreshPlatform | null {
  const p = (platform ?? "").toLowerCase();
  if (p.includes("youtube")) return "youtube";
  if (p.includes("instagram")) return "instagram";
  if (p === "twitter" || p === "x" || p.includes("twitter")) return "twitter";
  if (p.includes("tiktok")) return "tiktok";
  return null;
}

export function getMetricsRefreshStatusUrl(
  contestId: string,
  platform: MetricsRefreshPlatform,
): string {
  return `/api/contests/${contestId}/${STATUS_PATH[platform]}/status`;
}

export async function fetchMetricsRunStatus<T extends MetricsRefreshRun>(
  contestId: string,
  platform: MetricsRefreshPlatform,
): Promise<T | null> {
  const res = await fetch(getMetricsRefreshStatusUrl(contestId, platform));
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return (data?.run as T | null) ?? null;
}

export function isActiveMetricsRun(
  run: { status?: string } | null | undefined,
): boolean {
  return run?.status === "pending" || run?.status === "running";
}

export function isTerminalMetricsRunStatus(
  status: string | undefined,
): boolean {
  return (
    status === "completed" || status === "failed" || status === "cancelled"
  );
}

export type StartMetricsRunPollingOptions<T extends MetricsRefreshRun> = {
  contestId: string;
  platform: MetricsRefreshPlatform;
  intervalMs?: number;
  /** Stop polling after this many ms (manual refresh flows). */
  maxMs?: number;
  onRun: (run: T | null) => void;
  /** Called when run reaches a terminal status. */
  onTerminal?: (run: T) => void;
  onTimeout?: () => void;
};

/**
 * Fetches run status once, then polls every intervalMs only while run is pending/running.
 * Stops interval when run is null, terminal, maxMs exceeded, or tab hidden.
 */
export function startMetricsRunPolling<T extends MetricsRefreshRun>(
  options: StartMetricsRunPollingOptions<T>,
): () => void {
  const {
    contestId,
    platform,
    intervalMs = 3000,
    maxMs,
    onRun,
    onTerminal,
    onTimeout,
  } = options;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let disposed = false;
  const startedAt = Date.now();

  const clearIntervalOnly = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const stop = () => {
    disposed = true;
    clearIntervalOnly();
  };

  const startInterval = () => {
    if (disposed || intervalId) return;
    if (typeof document !== "undefined" && document.hidden) return;
    intervalId = setInterval(() => void tick(), intervalMs);
  };

  const tick = async () => {
    if (disposed) return;
    if (typeof document !== "undefined" && document.hidden) {
      clearIntervalOnly();
      return;
    }
    if (maxMs != null && Date.now() - startedAt > maxMs) {
      onTimeout?.();
      stop();
      return;
    }

    try {
      const run = await fetchMetricsRunStatus<T>(contestId, platform);
      if (disposed) return;

      onRun(run);

      if (!run) {
        clearIntervalOnly();
        return;
      }

      if (isActiveMetricsRun(run)) {
        startInterval();
        return;
      }

      if (isTerminalMetricsRunStatus(run.status)) {
        clearIntervalOnly();
        onTerminal?.(run);
        return;
      }

      clearIntervalOnly();
    } catch {
      // best-effort polling
    }
  };

  const onVisibilityChange = () => {
    if (disposed) return;
    if (document.hidden) {
      clearIntervalOnly();
    } else {
      void tick();
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  void tick();

  return () => {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    stop();
  };
}
