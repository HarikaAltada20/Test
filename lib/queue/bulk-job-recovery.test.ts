import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BULK_JOB_STALE_PROCESSING_MS,
  classifyRecoveredBulkJob,
  planRecoveredBulkJobs,
  recoverStaleBulkProcessingJobs,
} from "./bulk-job-recovery";

describe("classifyRecoveredBulkJob", () => {
  const now = Date.parse("2026-08-22T12:00:00.000Z");

  it("drops completed and failed jobs", () => {
    assert.equal(
      classifyRecoveredBulkJob(
        { status: "completed", updatedAt: "2026-08-22T11:00:00.000Z" },
        now,
      ),
      "drop",
    );
    assert.equal(
      classifyRecoveredBulkJob(
        { status: "failed", updatedAt: "2026-08-22T11:00:00.000Z" },
        now,
      ),
      "drop",
    );
  });

  it("keeps live running jobs within stale window", () => {
    assert.equal(
      classifyRecoveredBulkJob(
        { status: "running", updatedAt: "2026-08-22T11:55:00.000Z" },
        now,
      ),
      "keep-processing",
    );
  });

  it("requeues stale running jobs", () => {
    const staleAt = new Date(
      now - BULK_JOB_STALE_PROCESSING_MS - 1000,
    ).toISOString();
    assert.equal(
      classifyRecoveredBulkJob({ status: "running", updatedAt: staleAt }, now),
      "requeue",
    );
  });
});

describe("planRecoveredBulkJobs", () => {
  it("plans drop for finished jobs and requeue for stale ones", () => {
    const now = Date.parse("2026-08-22T12:00:00.000Z");
    const staleAt = new Date(now - BULK_JOB_STALE_PROCESSING_MS - 1000).toISOString();
    const plan = planRecoveredBulkJobs(
      [
        JSON.stringify({ jobId: "done-job" }),
        JSON.stringify({ jobId: "live-job" }),
        JSON.stringify({ jobId: "stale-job" }),
        "not-json",
      ],
      (jobId) => {
        if (jobId === "done-job") {
          return { status: "completed", updatedAt: staleAt };
        }
        if (jobId === "live-job") {
          return { status: "running", updatedAt: "2026-08-22T11:58:00.000Z" };
        }
        if (jobId === "stale-job") {
          return { status: "running", updatedAt: staleAt };
        }
        return null;
      },
      (raw) => {
        try {
          const parsed = JSON.parse(String(raw)) as { jobId?: string };
          return parsed.jobId ?? null;
        } catch {
          return null;
        }
      },
      now,
    );

    assert.deepEqual(
      plan.map((item) => item.action),
      ["drop", "keep-processing", "requeue", "drop"],
    );
  });
});

describe("recoverStaleBulkProcessingJobs", () => {
  it("uses the passed redis client instead of a global redis binding", async () => {
    const calls: string[] = [];
    const redis = {
      lrange: async () => {
        calls.push("lrange");
        return [];
      },
      lrem: async () => {
        calls.push("lrem");
        return 0;
      },
      eval: async () => 1,
      lpush: async () => 1,
    };

    const result = await recoverStaleBulkProcessingJobs({
      redis: redis as never,
      processingKey: "processing",
      queueKey: "queue",
      parseJobId: () => "job-1",
      getHeartbeat: async () => null,
      logPrefix: "test-queue",
    });

    assert.equal(result.error, undefined);
    assert.equal(result.moved, 0);
    assert.deepEqual(calls, ["lrange"]);
  });
});
