import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPostCampaignOverlayRow,
  postCampaignOverlayInsertFromSubmission,
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

  it("keeps live submission metrics when overlay is missing", () => {
    const row = {
      id: "sub-1",
      views: 10,
      other_stats: { youtube: { views: 10 } },
    };
    assert.deepEqual(applyPostCampaignOverlayRow(row, null), row);
  });

  it("uses overlay metrics when present and builds an insert stub for missing rows", () => {
    const row = {
      id: "sub-1",
      contest_id: "c-1",
      creator_id: "creator-1",
      content_link: "https://youtu.be/abcdefghijk",
      views: 10,
      other_stats: { youtube: { views: 10 } },
      platform: "youtube",
    };
    const overlayed = applyPostCampaignOverlayRow(row, {
      submission_id: "sub-1",
      views: 99,
      other_stats: { youtube: { views: 99 } },
    });
    assert.equal(overlayed.views, 99);
    assert.deepEqual(overlayed.other_stats, { youtube: { views: 99 } });

    const stub = postCampaignOverlayInsertFromSubmission(row, "2026-08-18T10:00:00.000Z");
    assert.equal(stub.submission_id, "sub-1");
    assert.equal(stub.contest_id, "c-1");
    assert.equal(stub.views, 10);
    assert.equal(stub.synced_at, "2026-08-18T10:00:00.000Z");
  });
});
