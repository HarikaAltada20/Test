import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  acquireAnalyticsRateLimit,
  getYoutubeAnalyticsRedisKeyForTests,
  resetYoutubeAnalyticsRateLimitForTests,
  setYoutubeAnalyticsRedisForTests,
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

  it("uses the configured deployment namespace in the Redis key", () => {
    const previousNamespace = process.env.YT_ANALYTICS_RATE_LIMIT_NAMESPACE;
    process.env.YT_ANALYTICS_RATE_LIMIT_NAMESPACE = "Preview / West";
    try {
      assert.equal(
        getYoutubeAnalyticsRedisKeyForTests(),
        "youtube_analytics_rate_limit:v3:preview-west",
      );
    } finally {
      if (previousNamespace === undefined) {
        delete process.env.YT_ANALYTICS_RATE_LIMIT_NAMESPACE;
      } else {
        process.env.YT_ANALYTICS_RATE_LIMIT_NAMESPACE = previousNamespace;
      }
    }
  });

  it("derives a project-and-environment namespace on Vercel", () => {
    const previousNamespace = process.env.YT_ANALYTICS_RATE_LIMIT_NAMESPACE;
    const previousVercelEnvironment = process.env.VERCEL_ENV;
    const previousProjectId = process.env.VERCEL_PROJECT_ID;
    delete process.env.YT_ANALYTICS_RATE_LIMIT_NAMESPACE;
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_PROJECT_ID = "project-123";

    try {
      assert.equal(
        getYoutubeAnalyticsRedisKeyForTests(),
        "youtube_analytics_rate_limit:v3:preview-project-123",
      );
    } finally {
      if (previousNamespace === undefined) {
        delete process.env.YT_ANALYTICS_RATE_LIMIT_NAMESPACE;
      } else {
        process.env.YT_ANALYTICS_RATE_LIMIT_NAMESPACE = previousNamespace;
      }
      if (previousVercelEnvironment === undefined) {
        delete process.env.VERCEL_ENV;
      } else {
        process.env.VERCEL_ENV = previousVercelEnvironment;
      }
      if (previousProjectId === undefined) {
        delete process.env.VERCEL_PROJECT_ID;
      } else {
        process.env.VERCEL_PROJECT_ID = previousProjectId;
      }
    }
  });

  it("executes the atomic Redis script with the namespaced key", async () => {
    setYoutubeAnalyticsRateLimitForceLocalForTests(false);
    const calls: Array<{ keys: string[]; args: unknown[] }> = [];
    setYoutubeAnalyticsRedisForTests({
      eval: async (_script: string, keys: string[], args: unknown[]) => {
        calls.push({ keys, args });
        return [1, 0];
      },
    } as any);

    await acquireAnalyticsRateLimit();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].keys.length, 1);
    assert.match(calls[0].keys[0], /^youtube_analytics_rate_limit:v3:/);
    assert.equal(calls[0].args[1], "60000");
    assert.equal(calls[0].args[2], "710");
  });

  it("never allows an environment override above the safe default", async () => {
    const previousLimit = process.env.YT_ANALYTICS_RATE_LIMIT_QPM;
    process.env.YT_ANALYTICS_RATE_LIMIT_QPM = "9999";
    setYoutubeAnalyticsRateLimitForceLocalForTests(false);
    const calls: unknown[][] = [];
    setYoutubeAnalyticsRedisForTests({
      eval: async (_script: string, _keys: string[], args: unknown[]) => {
        calls.push(args);
        return [1, 0];
      },
    } as any);

    try {
      await acquireAnalyticsRateLimit();
      assert.equal(calls[0][2], "710");
    } finally {
      if (previousLimit === undefined) {
        delete process.env.YT_ANALYTICS_RATE_LIMIT_QPM;
      } else {
        process.env.YT_ANALYTICS_RATE_LIMIT_QPM = previousLimit;
      }
    }
  });

  it("returns 503 when Redis is unavailable in real production", async () => {
    const previousVercelEnvironment = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";
    setYoutubeAnalyticsRateLimitForceLocalForTests(false);
    setYoutubeAnalyticsRedisForTests(null);

    try {
      await assert.rejects(
        () => acquireAnalyticsRateLimit(),
        (err: unknown) => {
          assert.ok(err instanceof YoutubeAnalyticsRateLimitError);
          assert.equal(err.status, 503);
          assert.equal(err.reason, "redis_unavailable");
          return true;
        },
      );
    } finally {
      if (previousVercelEnvironment === undefined) {
        delete process.env.VERCEL_ENV;
      } else {
        process.env.VERCEL_ENV = previousVercelEnvironment;
      }
    }
  });

  it("does not treat a Vercel preview as production", async () => {
    const previousVercelEnvironment = process.env.VERCEL_ENV;
    const previousNodeEnvironment = process.env.NODE_ENV;
    const mutableEnvironment = process.env as Record<string, string | undefined>;
    process.env.VERCEL_ENV = "preview";
    mutableEnvironment.NODE_ENV = "production";
    setYoutubeAnalyticsRateLimitForceLocalForTests(false);
    setYoutubeAnalyticsRedisForTests(null);
    setYoutubeAnalyticsRateLimitForTests(1);

    try {
      await acquireAnalyticsRateLimit();
      await assert.rejects(() => acquireAnalyticsRateLimit(), {
        name: "YoutubeAnalyticsRateLimitError",
        status: 429,
      });
    } finally {
      if (previousVercelEnvironment === undefined) {
        delete process.env.VERCEL_ENV;
      } else {
        process.env.VERCEL_ENV = previousVercelEnvironment;
      }
      if (previousNodeEnvironment === undefined) {
        delete mutableEnvironment.NODE_ENV;
      } else {
        mutableEnvironment.NODE_ENV = previousNodeEnvironment;
      }
    }
  });
});
