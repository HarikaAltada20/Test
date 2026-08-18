import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  youtubeDetailedRefreshWriteOptions,
  youtubeMetricsWriteTarget,
} from "./youtube-metrics-write-target";

describe("youtubeMetricsWriteTarget", () => {
  it("writes live refreshes to submissions", () => {
    assert.equal(youtubeMetricsWriteTarget(false), "submissions");
  });

  it("writes post-campaign refreshes to the overlay table", () => {
    assert.equal(
      youtubeMetricsWriteTarget(true),
      "post_campaign_submission_metrics",
    );
  });

  it("passes metricsTarget into the detailed refresh write options", () => {
    assert.deepEqual(youtubeDetailedRefreshWriteOptions(false), {
      metricsTarget: "submissions",
    });
    assert.deepEqual(youtubeDetailedRefreshWriteOptions(true), {
      metricsTarget: "post_campaign_submission_metrics",
    });
  });
});
