/**
 * Serializes mid-batch progress writes for metrics refresh runs so the UI can
 * poll Processed X/N while a single batch is still RUNNING (N ≤ batch size).
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
}) {
  const { supabase, table, runId, base } = options;
  const writeSkippedRecent = options.writeSkippedRecent !== false;

  let processed = 0;
  let reviewed = 0;
  let success = 0;
  let temporaryFailure = 0;
  let permanentFailure = 0;
  let skipped = 0;
  let writeChain: Promise<void> = Promise.resolve();

  const write = (
    patchExtra?: Record<string, unknown>,
    matchBatchIndex?: number,
  ) => {
    writeChain = writeChain
      .then(async () => {
        const patch: Record<string, unknown> = {
          processed_submissions: base.processed_submissions + processed,
          reviewed_count: base.reviewed_count + reviewed,
          success_count: base.success_count + success,
          temporary_failure_count:
            base.temporary_failure_count + temporaryFailure,
          permanent_failure_count:
            base.permanent_failure_count + permanentFailure,
          updated_at: new Date().toISOString(),
          ...patchExtra,
        };
        if (writeSkippedRecent) {
          patch.skipped_recent_count = base.skipped_recent_count + skipped;
        }
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

  return {
    /** Bump processed (+ optional reviewed) without classifying outcome. */
    addProcessed: (count = 1, alsoReviewed = true) => {
      const n = Math.max(0, count);
      processed += n;
      if (alsoReviewed) reviewed += n;
      return write();
    },
    recordSuccess: () => {
      success += 1;
      processed += 1;
      reviewed += 1;
      return write();
    },
    recordTemporaryFailure: () => {
      temporaryFailure += 1;
      processed += 1;
      reviewed += 1;
      return write();
    },
    recordPermanentFailure: () => {
      permanentFailure += 1;
      processed += 1;
      reviewed += 1;
      return write();
    },
    recordSkipped: (count = 1, countAsProcessed = true) => {
      const n = Math.max(0, count);
      skipped += n;
      reviewed += n;
      if (countAsProcessed) processed += n;
      return write();
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
      return write(
        {
          current_batch_index: batchIndex + 1,
          last_batch_completed_at: now,
          updated_at: now,
        },
        batchIndex,
      );
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
