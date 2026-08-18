import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { youtubeMetricsWriteTarget } from "./youtube-metrics-write-target";

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
});
