/**
 * Structured logs for campaign list scale monitoring (B9).
 *
 * Emit JSON lines so Vercel / log drains can filter on `type` and alert on
 * latency, errors, and stale-stats failures. See docs/PRODUCTION_DEPLOYMENT_NOTES.md.
 */

export type CampaignListCacheHeader = "HIT" | "MISS" | "BYPASS" | "N/A";

export type CampaignListRequestLog = {
  type: "campaign_list_request";
  route:
    | "/api/contests/list"
    | "/api/admin/contests/list"
    | "/api/opportunities/list";
  durationMs: number;
  status: number;
  cache: CampaignListCacheHeader;
  scope: "advertiser" | "admin" | "opportunities";
  eligibleOnly?: boolean;
  total?: number;
  error?: string;
};

export type StaleContestStatsLog = {
  type: "refresh_stale_contest_stats";
  durationMs: number;
  status: number;
  refreshed: number;
  source?: string;
  error?: string;
};

export type ContestStatsRefreshLog = {
  type: "refresh_contest_stats";
  ok: boolean;
  contestId: string | null;
  error?: string;
};

function emit(payload: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      ...payload,
      ts: new Date().toISOString(),
    }),
  );
}

export function logCampaignListRequest(
  event: Omit<CampaignListRequestLog, "type">,
): void {
  emit({ type: "campaign_list_request", ...event });
}

export function logStaleContestStatsCron(
  event: Omit<StaleContestStatsLog, "type">,
): void {
  const level = event.error || event.status >= 500 ? "error" : "info";
  const line = JSON.stringify({
    type: "refresh_stale_contest_stats",
    ...event,
    ts: new Date().toISOString(),
  });
  if (level === "error") console.error(line);
  else console.info(line);
}

export function logContestStatsRefresh(
  event: Omit<ContestStatsRefreshLog, "type">,
): void {
  if (event.ok) {
    // Success is high-volume from metrics jobs; keep quiet unless debugging.
    return;
  }
  console.error(
    JSON.stringify({
      type: "refresh_contest_stats",
      ...event,
      ts: new Date().toISOString(),
    }),
  );
}

/** Tiny helper so route handlers share the same timing shape. */
export function startRequestTimer(): () => number {
  const started = Date.now();
  return () => Date.now() - started;
}
