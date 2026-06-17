import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLeaderboardSubmissionStatus,
  resolveAggregateLeaderboardStatus,
  resolveLeaderboardBadgeStatus,
} from "./status-badges";
import { SUBMISSION_STATUS } from "./constants-status";

describe("normalizeLeaderboardSubmissionStatus", () => {
  it("maps approved moderation status to verified", () => {
    assert.equal(
      normalizeLeaderboardSubmissionStatus(null, "approved"),
      SUBMISSION_STATUS.verified,
    );
  });

  it("returns null when status is missing", () => {
    assert.equal(normalizeLeaderboardSubmissionStatus(null, null), null);
  });

  it("prefers explicit submission status", () => {
    assert.equal(
      normalizeLeaderboardSubmissionStatus("verified", "pending"),
      SUBMISSION_STATUS.verified,
    );
  });
});

describe("resolveAggregateLeaderboardStatus", () => {
  it("shows pending when any submission is pending", () => {
    assert.equal(
      resolveAggregateLeaderboardStatus([
        { status: "verified" },
        { status: "pending" },
      ]),
      SUBMISSION_STATUS.pending,
    );
  });

  it("returns null when all submissions are verified", () => {
    assert.equal(
      resolveAggregateLeaderboardStatus([
        { status: "verified" },
        { status: "paid" },
      ]),
      null,
    );
  });
});

describe("resolveLeaderboardBadgeStatus", () => {
  it("uses display_status for creator-wise rows", () => {
    assert.equal(
      resolveLeaderboardBadgeStatus({ display_status: "pending" }),
      SUBMISSION_STATUS.pending,
    );
  });

  it("aggregates nested submissions for creator groups", () => {
    assert.equal(
      resolveLeaderboardBadgeStatus({
        submissions: [{ status: "pending" }, { status: "verified" }],
      }),
      SUBMISSION_STATUS.pending,
    );
  });

  it("shows no badge for creator-wise rows with null display_status", () => {
    assert.equal(
      resolveLeaderboardBadgeStatus({
        display_status: null,
        pending_submission_count: 0,
        submissions: [],
      }),
      null,
    );
  });

  it("shows pending only when display_status is pending", () => {
    assert.equal(
      resolveLeaderboardBadgeStatus({
        display_status: "pending",
        submissions: [],
      }),
      SUBMISSION_STATUS.pending,
    );
  });

  it("uses pending_submission_count for creator-wise rows", () => {
    assert.equal(
      resolveLeaderboardBadgeStatus({
        pending_submission_count: 12,
        display_status: null,
      }),
      SUBMISSION_STATUS.pending,
    );
    assert.equal(
      resolveLeaderboardBadgeStatus({ pending_submission_count: 0 }),
      null,
    );
  });
});
