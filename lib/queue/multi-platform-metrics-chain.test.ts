import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCurrentMultiPlatformChainStep,
  isMultiPlatformMetricsChainEnabled,
  startMultiPlatformMetricsChain,
} from "./multi-platform-metrics-chain";

describe("multi-platform metrics chain security", () => {
  it("requires Redis credentials and CRON_SECRET", () => {
    const previous = {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
      cron: process.env.CRON_SECRET,
    };
    try {
      process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
      process.env.UPSTASH_REDIS_REST_TOKEN = "redis-token";
      delete process.env.CRON_SECRET;
      assert.equal(isMultiPlatformMetricsChainEnabled(), false);

      process.env.CRON_SECRET = "cron-secret";
      assert.equal(isMultiPlatformMetricsChainEnabled(), true);
    } finally {
      if (previous.url == null) delete process.env.UPSTASH_REDIS_REST_URL;
      else process.env.UPSTASH_REDIS_REST_URL = previous.url;
      if (previous.token == null) delete process.env.UPSTASH_REDIS_REST_TOKEN;
      else process.env.UPSTASH_REDIS_REST_TOKEN = previous.token;
      if (previous.cron == null) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous.cron;
    }
  });

  it("does not let a continuation advance to the next platform", () => {
    const chain = {
      platforms: ["youtube", "instagram", "tiktok"] as const,
      currentIndex: 0,
    };
    assert.equal(isCurrentMultiPlatformChainStep(chain, "youtube"), true);
    assert.equal(isCurrentMultiPlatformChainStep(chain, "instagram"), false);
    assert.equal(isCurrentMultiPlatformChainStep(chain, "tiktok"), false);
  });

  it("refuses a multi-platform start when a secure chain is unavailable", async () => {
    const previous = {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
      cron: process.env.CRON_SECRET,
    };
    try {
      process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
      process.env.UPSTASH_REDIS_REST_TOKEN = "redis-token";
      delete process.env.CRON_SECRET;

      const result = await startMultiPlatformMetricsChain({
        baseUrl: "https://app.example",
        contestId: "contest-id",
        platforms: ["youtube", "instagram"],
        metricsTarget: "submissions",
      });
      assert.equal(result.status, 503);
      assert.equal(result.chain, false);
      assert.deepEqual(result.runs, []);
    } finally {
      if (previous.url == null) delete process.env.UPSTASH_REDIS_REST_URL;
      else process.env.UPSTASH_REDIS_REST_URL = previous.url;
      if (previous.token == null) delete process.env.UPSTASH_REDIS_REST_TOKEN;
      else process.env.UPSTASH_REDIS_REST_TOKEN = previous.token;
      if (previous.cron == null) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous.cron;
    }
  });
});
