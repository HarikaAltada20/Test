import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTEST_SUBMISSIONS_HYDRATE_ERROR,
  finishContestSubmissionsHydrate,
} from "./contest-detail-submissions-hydrate";

describe("finishContestSubmissionsHydrate", () => {
  it("marks complete only when every page succeeded", () => {
    assert.deepEqual(
      finishContestSubmissionsHydrate({
        cancelled: false,
        aborted: false,
        pageFailed: false,
      }),
      { fullyHydrated: true, error: null },
    );
  });

  it("keeps the table incomplete and sets an error when a page fails", () => {
    assert.deepEqual(
      finishContestSubmissionsHydrate({
        cancelled: false,
        aborted: false,
        pageFailed: true,
      }),
      { fullyHydrated: false, error: CONTEST_SUBMISSIONS_HYDRATE_ERROR },
    );
  });

  it("does not flag an error when the effect is cancelled or aborted", () => {
    assert.deepEqual(
      finishContestSubmissionsHydrate({
        cancelled: true,
        aborted: false,
        pageFailed: true,
      }),
      { fullyHydrated: false, error: null },
    );
    assert.deepEqual(
      finishContestSubmissionsHydrate({
        cancelled: false,
        aborted: true,
        pageFailed: true,
      }),
      { fullyHydrated: false, error: null },
    );
  });
});
