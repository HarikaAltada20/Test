import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { POST_CONTEST_STATUS } from "@/lib/constants-status";
import {
  getAvailablePostContestTransitions,
  getPostContestStatusLabel,
  getRecommendedPostContestTransition,
  getStatusTransitionImpact,
} from "./post-contest-status-ui";

describe("getAvailablePostContestTransitions", () => {
  it("brand at in_review only sees verification_complete", () => {
    const options = getAvailablePostContestTransitions({
      current: "in_review",
      isAdmin: false,
    });
    assert.deepEqual(
      options.map((o) => o.value),
      ["verification_complete"],
    );
  });

  it("admin at in_review sees all except current", () => {
    const options = getAvailablePostContestTransitions({
      current: "in_review",
      isAdmin: true,
    });
    assert.deepEqual(
      options.map((o) => o.value),
      ["pending_review", "verification_complete", "payouts_processed"],
    );
  });
});

describe("getRecommendedPostContestTransition", () => {
  it("defaults in_review to verification_complete", () => {
    assert.equal(
      getRecommendedPostContestTransition("in_review", true),
      POST_CONTEST_STATUS.verification_complete,
    );
    assert.equal(
      getRecommendedPostContestTransition("in_review", false),
      POST_CONTEST_STATUS.verification_complete,
    );
  });
});

describe("getStatusTransitionImpact", () => {
  it("returns bullets for verification_complete", () => {
    const impact = getStatusTransitionImpact(
      POST_CONTEST_STATUS.verification_complete,
    );
    assert.ok(impact.length >= 3);
    assert.ok(
      impact.some((line) => line.toLowerCase().includes("creator profile")),
    );
  });
});

describe("getPostContestStatusLabel", () => {
  it("returns human label instead of slug", () => {
    assert.equal(getPostContestStatusLabel("in_review"), "In Review");
    assert.equal(
      getPostContestStatusLabel("verification_complete"),
      "Verification Completed",
    );
    assert.equal(getPostContestStatusLabel(null), "Not set");
  });
});
