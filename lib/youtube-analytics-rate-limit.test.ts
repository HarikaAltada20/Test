import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  acquireAnalyticsRateLimit,
  resetYoutubeAnalyticsRateLimitForTests,
  setYoutubeAnalyticsRateLimitForTests,
  setYoutubeAnalyticsRateLimitForceLocalForTests,
  YoutubeAnalyticsRateLimitError,
  YT_ANALYTICS_DEFAULT_RATE_LIMIT,
} from "./youtube-analytics-rate-limit";

describe("youtube-analytics-rate-limit", () => {
  beforeEach(() => {
    resetYoutubeAnalyticsRateLimitForTests();
    setYoutubeAnalyticsRateLimitForceLocalForTests(true);
  });

  afterEach(() => {
    resetYoutubeAnalyticsRateLimitForTests();
  });

  it("exposes a default cap under Google's 720 QPM quota", () => {
    assert.equal(YT_ANALYTICS_DEFAULT_RATE_LIMIT, 710);
  });

  it("allows up to the configured local sliding-window limit", async () => {
    setYoutubeAnalyticsRateLimitForTests(5);
    for (let i = 0; i < 5; i++) {
      await acquireAnalyticsRateLimit();
    }
  });

  it("rejects the call that would exceed the rolling window", async () => {
    setYoutubeAnalyticsRateLimitForTests(3);
    await acquireAnalyticsRateLimit();
    await acquireAnalyticsRateLimit();
    await acquireAnalyticsRateLimit();

    await assert.rejects(
      () => acquireAnalyticsRateLimit(),
      (err: unknown) => {
        assert.ok(err instanceof YoutubeAnalyticsRateLimitError);
        assert.equal(err.status, 429);
        assert.ok(err.retryAfterMs > 0);
        return true;
      },
    );
  });
});
