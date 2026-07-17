import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPostCampaignRefreshToastDescription,
  getPostCampaignStatusPath,
  getPostCampaignStatusPaths,
  isTerminalPostCampaignRunStatus,
  isTrackedPostCampaignRun,
} from "./post-campaign-refresh-client";

describe("isTrackedPostCampaignRun", () => {
  it("matches by activeRunId when provided", () => {
    assert.equal(
      isTrackedPostCampaignRun(
        { id: "run-1", started_at: "2020-01-01T00:00:00.000Z" },
        { activeRunId: "run-1", refreshStartedMs: Date.now() },
      ),
      true,
    );
    assert.equal(
      isTrackedPostCampaignRun(
        { id: "run-2", started_at: new Date().toISOString() },
        { activeRunId: "run-1", refreshStartedMs: Date.now() },
      ),
      false,
    );
  });

  it("falls back to started_at window when no activeRunId", () => {
    const refreshStartedMs = Date.now();
    assert.equal(
      isTrackedPostCampaignRun(
        { id: "run-1", started_at: new Date(refreshStartedMs - 1000).toISOString() },
        { refreshStartedMs },
      ),
      true,
    );
    assert.equal(
      isTrackedPostCampaignRun(
        {
          id: "run-old",
          started_at: new Date(refreshStartedMs - 60_000).toISOString(),
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
