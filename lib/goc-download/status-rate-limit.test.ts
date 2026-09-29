import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acquireDesktopStatusRateLimit,
  maxEventsPerMinuteForJob,
  resetDesktopStatusRateLimitForTests,
} from "./status-rate-limit";

describe("goc-download status-rate-limit", () => {
  it("caps per-job events relative to item count", () => {
    assert.equal(maxEventsPerMinuteForJob(1), 22);
    assert.equal(maxEventsPerMinuteForJob(100), 120);
  });

  it("enforces local per-job rate limit", async () => {
    resetDesktopStatusRateLimitForTests();
    const jobId = `job-${Date.now()}`;
    const userId = `user-${Date.now()}`;
    // Soft cap for tiny jobs is 22.
    for (let i = 0; i < 22; i++) {
      const hit = await acquireDesktopStatusRateLimit({
        jobId,
        userId,
        itemCount: 1,
      });
      assert.equal(hit.ok, true, `expected ok at ${i}`);
    }
    const blocked = await acquireDesktopStatusRateLimit({
      jobId,
      userId,
      itemCount: 1,
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.ok(blocked.retryAfterMs > 0);
    }
  });
});
