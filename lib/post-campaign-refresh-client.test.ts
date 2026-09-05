import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatLiveMetricsRefreshToastDescription,
  formatPostCampaignRefreshToastDescription,
  getPostCampaignStatusPath,
  getPostCampaignStatusPaths,
  isTerminalPostCampaignRunStatus,
  isTrackedPostCampaignRun,
  liveMetricsRefreshToastTitle,
} from "./post-campaign-refresh-client";

describe("isTrackedPostCampaignRun", () => {
  it("matches by activeRunId even when started_at is old", () => {
    assert.equal(
      isTrackedPostCampaignRun(
        { id: "run-1", started_at: "2020-01-01T00:00:00.000Z" },
        { activeRunId: "run-1", refreshStartedMs: Date.now() },
      ),
      true,
    );
  });

  it("prefers the started_at window over a stale activeRunId", () => {
    const refreshStartedMs = Date.now();
    assert.equal(
      isTrackedPostCampaignRun(
        {
          id: "run-2",
          started_at: new Date(refreshStartedMs - 1000).toISOString(),
        },
        { activeRunId: "run-1", refreshStartedMs },
      ),
      true,
    );
  });

  it("falls back to started_at window when no activeRunId", () => {
    const refreshStartedMs = Date.now();
    assert.equal(
      isTrackedPostCampaignRun(
        {
          id: "run-1",
          started_at: new Date(refreshStartedMs - 1000).toISOString(),
        },
        { refreshStartedMs },
      ),
      true,
    );
    assert.equal(
      isTrackedPostCampaignRun(
        {
          id: "run-old",
          started_at: new Date(refreshStartedMs - 180_000).toISOString(),
        },
        { refreshStartedMs },
      ),
      false,
    );
  });

  it("does not treat an old run as tracked just because it finished recently", () => {
    const refreshStartedMs = Date.now();
    assert.equal(
      isTrackedPostCampaignRun(
        {
          id: "run-old-tt",
          started_at: new Date(refreshStartedMs - 180_000).toISOString(),
          finished_at: new Date(refreshStartedMs - 5_000).toISOString(),
        },
        { refreshStartedMs },
      ),
      false,
    );
  });
});

describe("isTerminalPostCampaignRunStatus", () => {
  it("detects terminal statuses", () => {
    assert.equal(isTerminalPostCampaignRunStatus("completed"), true);
    assert.equal(isTerminalPostCampaignRunStatus("failed"), true);
    assert.equal(isTerminalPostCampaignRunStatus("cancelled"), true);
    assert.equal(isTerminalPostCampaignRunStatus("running"), false);
  });
});

describe("formatLiveMetricsRefreshToastDescription", () => {
  it("includes totals and failure counts", () => {
    const text = formatLiveMetricsRefreshToastDescription({
      total_submissions: 4,
      processed_submissions: 4,
      success_count: 3,
      temporary_failure_count: 0,
      permanent_failure_count: 1,
      skipped_recent_count: 0,
    });
    assert.ok(text.includes("Total submissions 4"));
    assert.ok(text.includes("Success 3"));
    assert.ok(text.includes("Permanent failure 1"));
    assert.ok(text.includes("Skipped 0"));
  });

  it("includes scope and reviewed when requested", () => {
    const text = formatLiveMetricsRefreshToastDescription(
      {
        total_submissions: 2,
        processed_submissions: 2,
        reviewed_count: 2,
        success_count: 2,
        scope: "all",
      },
      { scope: "all", includeReviewed: true },
    );
    assert.ok(text.includes("Scope: all"));
    assert.ok(text.includes("Reviewed 2"));
  });
});

describe("liveMetricsRefreshToastTitle", () => {
  it("labels platforms", () => {
    assert.equal(
      liveMetricsRefreshToastTitle("youtube", "completed"),
      "YouTube refresh completed",
    );
    assert.equal(
      liveMetricsRefreshToastTitle("instagram", "failed"),
      "Instagram refresh failed",
    );
    assert.equal(
      liveMetricsRefreshToastTitle("tiktok", "completed"),
      "TikTok refresh completed",
    );
  });
});

describe("formatPostCampaignRefreshToastDescription", () => {
  it("formats counts", () => {
    assert.equal(
      formatPostCampaignRefreshToastDescription({
        success_count: 2,
        temporary_failure_count: 1,
        permanent_failure_count: 0,
        skipped_recent_count: 3,
      }),
      "Success 2 · Temporary failure 1 · Permanent failure 0 · Skipped 3.",
    );
  });

  it("includes scope when provided", () => {
    const text = formatPostCampaignRefreshToastDescription(
      { success_count: 1 },
      { scope: "core" },
    );
    assert.ok(text.startsWith("Scope: core · "));
  });
});

describe("getPostCampaignStatusPath", () => {
  it("resolves platform paths", () => {
    assert.equal(
      getPostCampaignStatusPath("youtube").statusPath,
      "youtube-metrics-refresh/status",
    );
    assert.equal(
      getPostCampaignStatusPath("tiktok").platformLabel,
      "TikTok",
    );
    assert.equal(
      getPostCampaignStatusPath("instagram").platformLabel,
      "Instagram",
    );
  });

  it("prefers first platform in hybrid strings (not Instagram-first)", () => {
    assert.equal(
      getPostCampaignStatusPath("youtube,instagram").statusPath,
      "youtube-metrics-refresh/status",
    );
    assert.equal(
      getPostCampaignStatusPath("instagram,youtube").platformLabel,
      "Instagram",
    );
  });
});

describe("getPostCampaignStatusPaths", () => {
  it("returns all hybrid platforms in order", () => {
    const paths = getPostCampaignStatusPaths("youtube,tiktok");
    assert.deepEqual(
      paths.map((p) => p.platform),
      ["youtube", "tiktok"],
    );
    assert.equal(paths[0].statusPath, "youtube-metrics-refresh/status");
    assert.equal(paths[1].statusPath, "tiktok-metrics-refresh/status");
  });
});
