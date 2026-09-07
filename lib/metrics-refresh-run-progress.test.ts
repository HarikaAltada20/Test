import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMetricsRefreshRunProgressWriter } from "./metrics-refresh-run-progress";

describe("createMetricsRefreshRunProgressWriter", () => {
  it("writes increasing processed counts and finalizes batch index", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const supabase = {
      from: () => ({
        update: (values: Record<string, unknown>) => {
          const chain = {
            eq: (_col: string, _val: string | number) => {
              updates.push({ ...values });
              return Object.assign(Promise.resolve({ error: null }), {
                eq: () => {
                  updates[updates.length - 1] = { ...values };
                  return Promise.resolve({ error: null });
                },
              });
            },
          };
          return chain;
        },
      }),
    };

    const progress = createMetricsRefreshRunProgressWriter({
      supabase,
      table: "youtube_metrics_refresh_runs",
      runId: "run-1",
      base: {
        processed_submissions: 0,
        reviewed_count: 0,
        success_count: 0,
        temporary_failure_count: 0,
        permanent_failure_count: 0,
        skipped_recent_count: 0,
      },
    });

    await progress.recordSuccess();
    await progress.recordTemporaryFailure();
    await progress.awaitIdle();
    assert.equal(updates.at(-1)?.processed_submissions, 2);

    await progress.finalize(0, "2026-01-01T00:00:00.000Z", {
      processed: 5,
      reviewed: 5,
      success: 4,
      temporaryFailure: 1,
      permanentFailure: 0,
      skipped: 0,
    });
    await progress.awaitIdle();
    assert.equal(updates.at(-1)?.processed_submissions, 5);
    assert.equal(updates.at(-1)?.current_batch_index, 1);
    assert.equal(updates.at(-1)?.success_count, 4);
  });
});
