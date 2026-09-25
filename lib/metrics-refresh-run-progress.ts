/**
 * Serializes metrics refresh run progress. Counts are accumulated in memory
 * during a batch; processed/success totals are written on finalize so the UI
 * jumps by batch size (e.g. 25 → 50). Occasional updated_at heartbeats keep
 * stale-run recovery healthy without mid-batch counter flicker.
 */

export type MetricsRefreshRunProgressBase = {
  processed_submissions: number;
  reviewed_count: number;
  success_count: number;
  temporary_failure_count: number;
  permanent_failure_count: number;
  skipped_recent_count: number;
};

export type MetricsRefreshRunProgressTable =
  | "youtube_metrics_refresh_runs"
  | "instagram_insights_refresh_runs"
  | "tiktok_metrics_refresh_runs";

/** Heartbeat at most this often while recording mid-batch outcomes. */
export const METRICS_REFRESH_HEARTBEAT_MIN_MS = 15_000;

type ProgressClient = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string | number,
      ) => {
        eq: (
          column: string,
          value: string | number,
        ) => PromiseLike<{ error: unknown }>;
      } & PromiseLike<{ error: unknown }>;
    };
  };
};

export function createMetricsRefreshRunProgressWriter(options: {
  supabase: ProgressClient;
  table: MetricsRefreshRunProgressTable;
  runId: string;
  base: MetricsRefreshRunProgressBase;
  /** Omit skipped_recent_count column (TikTok runs table). Default true. */
  writeSkippedRecent?: boolean;
  /** Min ms between heartbeat-only writes. Default 15s. */
  heartbeatMinMs?: number;
}) {
  const { supabase, table, runId, base } = options;
  const writeSkippedRecent = options.writeSkippedRecent !== false;
  const heartbeatMinMs =
    options.heartbeatMinMs ?? METRICS_REFRESH_HEARTBEAT_MIN_MS;

  let processed = 0;
  let reviewed = 0;
  let success = 0;
  let temporaryFailure = 0;
  let permanentFailure = 0;
  let skipped = 0;
  let writeChain: Promise<void> = Promise.resolve();
  // Start "fresh" so the first mid-batch record does not immediately heartbeat.
  let lastHeartbeatAt = Date.now();

  const write = (
    patch: Record<string, unknown>,
    matchBatchIndex?: number,
  ) => {
    writeChain = writeChain
      .then(async () => {
        const q = supabase.from(table).update(patch).eq("id", runId);
        if (matchBatchIndex != null) {
          await q.eq("current_batch_index", matchBatchIndex);
        } else {
          await q;
        }
      })
      .catch(() => {
        // Best-effort UI progress; final batch write still applies counts.
      });
    return writeChain;
  };

  const maybeHeartbeat = () => {
    const now = Date.now();
    if (now - lastHeartbeatAt < heartbeatMinMs) {
      return writeChain;
    }
    lastHeartbeatAt = now;
    return write({ updated_at: new Date().toISOString() });
  };

  const bumpAndHeartbeat = () => maybeHeartbeat();

  return {
    /** Bump processed (+ optional reviewed) without classifying outcome. */
    addProcessed: (count = 1, alsoReviewed = true) => {
      const n = Math.max(0, count);
      processed += n;
      if (alsoReviewed) reviewed += n;
      return bumpAndHeartbeat();
    },
    recordSuccess: () => {
      success += 1;
      processed += 1;
      reviewed += 1;
      return bumpAndHeartbeat();
    },
    recordTemporaryFailure: () => {
      temporaryFailure += 1;
      processed += 1;
      reviewed += 1;
      return bumpAndHeartbeat();
    },
    recordPermanentFailure: () => {
      permanentFailure += 1;
      processed += 1;
      reviewed += 1;
      return bumpAndHeartbeat();
    },
    recordSkipped: (count = 1, countAsProcessed = true) => {
      const n = Math.max(0, count);
      skipped += n;
      reviewed += n;
      if (countAsProcessed) processed += n;
      return bumpAndHeartbeat();
    },
    /**
     * Replace batch deltas with final accounting and advance current_batch_index.
     */
    finalize: (
      batchIndex: number,
      now: string,
      final: {
        processed: number;
        reviewed: number;
        success: number;
        temporaryFailure: number;
        permanentFailure: number;
        skipped: number;
      },
    ) => {
      processed = final.processed;
      reviewed = final.reviewed;
      success = final.success;
      temporaryFailure = final.temporaryFailure;
      permanentFailure = final.permanentFailure;
      skipped = final.skipped;
      lastHeartbeatAt = Date.now();
      const patch: Record<string, unknown> = {
        processed_submissions: base.processed_submissions + processed,
        reviewed_count: base.reviewed_count + reviewed,
        success_count: base.success_count + success,
        temporary_failure_count:
          base.temporary_failure_count + temporaryFailure,
        permanent_failure_count:
          base.permanent_failure_count + permanentFailure,
        current_batch_index: batchIndex + 1,
        last_batch_completed_at: now,
        updated_at: now,
      };
      if (writeSkippedRecent) {
        patch.skipped_recent_count = base.skipped_recent_count + skipped;
      }
      return write(patch, batchIndex);
    },
    awaitIdle: () => writeChain,
    getBatchCounts: () => ({
      processed,
      reviewed,
      success,
      temporaryFailure,
      permanentFailure,
      skipped,
    }),
  };
}
