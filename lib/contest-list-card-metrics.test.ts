import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAdminSubmissionTotal, getMultipleSubmissionsBadgeLabel } from "./contest-list-card-metrics";

describe("getAdminSubmissionTotal", () => {
  it("prefers contest_stats over a stale live_submission_count", () => {
    assert.equal(
      getAdminSubmissionTotal({
        live_submission_count: 1,
        verified_submission_count: 10,
        pending_submission_count: 3,
        rejected_submission_count: 1,
      }),
      14,
    );
  });

  it("uses live_submission_count when status counts are missing", () => {
    assert.equal(
      getAdminSubmissionTotal({
        live_submission_count: 8,
      }),
      8,
    );
  });
});

describe("getMultipleSubmissionsBadgeLabel", () => {
  it("uses the submissions count, not a per-creator fraction", () => {
    assert.equal(
      getMultipleSubmissionsBadgeLabel({ max_submissions_per_creator: 90 }),
      "90 Submissions",
    );
  });

  it("falls back to Multiple Entries when the cap is 1", () => {
    assert.equal(
      getMultipleSubmissionsBadgeLabel({ max_submissions_per_creator: 1 }),
      "Multiple Entries",
    );
  });
});
