import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertPostCampaignEnqueueAccess,
  isMetricsTargetMismatch,
  parseMetricsTarget,
  postCampaignCooldownResponse,
  postCampaignNextRefreshAvailable,
} from "./post-campaign-enqueue-guards";
import {
  buildPostCampaignExistingRowPatch,
  POST_CAMPAIGN_PRESERVED_METRIC_KEYS,
} from "./post-campaign-sync-patch";

describe("parseMetricsTarget", () => {
  it("accepts post_campaign", () => {
    assert.equal(parseMetricsTarget("post_campaign"), "post_campaign");
  });

  it("defaults everything else to submissions", () => {
    assert.equal(parseMetricsTarget(undefined), "submissions");
    assert.equal(parseMetricsTarget(null), "submissions");
    assert.equal(parseMetricsTarget("submissions"), "submissions");
    assert.equal(parseMetricsTarget("other"), "submissions");
  });
});

describe("isMetricsTargetMismatch", () => {
  it("treats null/undefined run target as submissions", () => {
    assert.equal(isMetricsTargetMismatch(null, "submissions"), false);
    assert.equal(isMetricsTargetMismatch(undefined, "submissions"), false);
    assert.equal(isMetricsTargetMismatch(null, "post_campaign"), true);
  });

  it("detects mismatch between job and run", () => {
    assert.equal(
      isMetricsTargetMismatch("post_campaign", "submissions"),
      true,
    );
    assert.equal(
      isMetricsTargetMismatch("submissions", "post_campaign"),
      true,
    );
    assert.equal(
      isMetricsTargetMismatch("post_campaign", "post_campaign"),
      false,
    );
  });
});

describe("assertPostCampaignEnqueueAccess", () => {
  it("allows submissions target without extra checks", () => {
    assert.equal(
      assertPostCampaignEnqueueAccess(false, false, undefined, "adv", false),
      null,
    );
  });

  it("allows cron for post_campaign", () => {
    assert.equal(
      assertPostCampaignEnqueueAccess(true, true, undefined, "adv", false),
      null,
    );
  });

  it("rejects unauthenticated non-cron post_campaign", () => {
    const res = assertPostCampaignEnqueueAccess(
      true,
      false,
      undefined,
      "adv",
      false,
    );
    assert.ok(res);
    assert.equal(res!.status, 401);
  });

  it("rejects non-owner non-admin for post_campaign", () => {
    const res = assertPostCampaignEnqueueAccess(
      true,
      false,
      "user-1",
      "adv",
      false,
    );
    assert.ok(res);
    assert.equal(res!.status, 403);
  });

  it("allows advertiser owner and admin", () => {
    assert.equal(
      assertPostCampaignEnqueueAccess(true, false, "adv", "adv", false),
      null,
    );
    assert.equal(
      assertPostCampaignEnqueueAccess(true, false, "admin", "adv", true),
      null,
    );
  });
});

describe("postCampaignNextRefreshAvailable", () => {
  it("returns null when never updated", () => {
    assert.equal(postCampaignNextRefreshAvailable(null, false), null);
  });

  it("returns a future timestamp from last completed refresh", () => {
    const last = "2026-01-01T00:00:00.000Z";
    const next = postCampaignNextRefreshAvailable(last, true);
    assert.ok(next);
    assert.ok(new Date(next!).getTime() > new Date(last).getTime());
  });
});

describe("postCampaignCooldownResponse", () => {
  it("returns null when never updated", () => {
    assert.equal(postCampaignCooldownResponse(null, false), null);
    assert.equal(postCampaignCooldownResponse(undefined, true), null);
  });

  it("returns 429 when updated just now", () => {
    const res = postCampaignCooldownResponse(new Date().toISOString(), false);
    assert.ok(res);
    assert.equal(res!.status, 429);
  });

  it("returns null when last update is old enough", () => {
    const old = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
    assert.equal(postCampaignCooldownResponse(old, false), null);
  });
});

describe("buildPostCampaignExistingRowPatch", () => {
  const snapshot = {
    contest_id: "c1",
    status: "verified",
    earnings: 100,
  };
  const metrics = {
    views: 999,
    other_stats: { likes: 1 },
    last_insights_update: "2026-01-01T00:00:00.000Z",
    insights_status: "ok",
  };

  it("preserves overlay metrics by default", () => {
    const patch = buildPostCampaignExistingRowPatch(snapshot, metrics, false);
    assert.deepEqual(patch, snapshot);
    for (const key of POST_CAMPAIGN_PRESERVED_METRIC_KEYS) {
      assert.equal(Object.prototype.hasOwnProperty.call(patch, key), false);
    }
  });

  it("overwrites metrics when overwriteMetrics is true", () => {
    const patch = buildPostCampaignExistingRowPatch(snapshot, metrics, true);
    assert.equal(patch.views, 999);
    assert.equal(patch.insights_status, "ok");
    assert.equal(patch.status, "verified");
  });
});
