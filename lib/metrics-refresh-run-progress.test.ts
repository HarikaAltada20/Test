import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMetricsRefreshRunProgressWriter } from "./metrics-refresh-run-progress";

describe("createMetricsRefreshRunProgressWriter", () => {
  it("does not write processed counts mid-batch; finalize bumps by batch size", async () => {
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
      heartbeatMinMs: 60_000,
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
    assert.equal(
      updates.length,
      0,
      "mid-batch record* should not write when heartbeat is suppressed",
    );

    await progress.finalize(0, "2026-01-01T00:00:00.000Z", {
      processed: 25,
      reviewed: 25,
      success: 24,
      temporaryFailure: 1,
      permanentFailure: 0,
      skipped: 0,
    });
    await progress.awaitIdle();
    assert.equal(updates.length, 1);
    assert.equal(updates[0]?.processed_submissions, 25);
    assert.equal(updates[0]?.current_batch_index, 1);
    assert.equal(updates[0]?.success_count, 24);
    assert.equal(updates[0]?.temporary_failure_count, 1);
  });

  it("writes updated_at heartbeat when interval elapses", async () => {
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
      runId: "run-2",
      heartbeatMinMs: 0,
      base: {
        processed_submissions: 10,
        reviewed_count: 10,
        success_count: 10,
        temporary_failure_count: 0,
        permanent_failure_count: 0,
        skipped_recent_count: 0,
      },
    });

    await progress.recordSuccess();
    await progress.awaitIdle();
    assert.equal(updates.length, 1);
    assert.ok(typeof updates[0]?.updated_at === "string");
    assert.equal(updates[0]?.processed_submissions, undefined);
  });
});
