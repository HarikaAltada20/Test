import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SUBMISSION_STATUS } from "@/lib/constants-status";
import { shouldCreditSubmissionViewsOnStatusChange } from "@/lib/creator-total-views";

describe("shouldCreditSubmissionViewsOnStatusChange", () => {
  it("credits when pending becomes verified", () => {
    assert.equal(
      shouldCreditSubmissionViewsOnStatusChange(
        SUBMISSION_STATUS.pending,
        SUBMISSION_STATUS.verified,
      ),
      true,
    );
  });

  it("does not credit when verified becomes paid", () => {
    assert.equal(
      shouldCreditSubmissionViewsOnStatusChange(
        SUBMISSION_STATUS.verified,
        SUBMISSION_STATUS.paid,
      ),
      false,
    );
  });

  it("does not credit when already verified is verified again", () => {
    assert.equal(
      shouldCreditSubmissionViewsOnStatusChange(
        SUBMISSION_STATUS.verified,
        SUBMISSION_STATUS.verified,
      ),
      false,
    );
  });
});
