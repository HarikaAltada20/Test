import test from "node:test";
import assert from "node:assert/strict";
import {
  isEligibleForTikTokRefresh,
  isEligibleSubmissionForRun,
} from "./refresh-eligibility.js";

test("isEligibleForTikTokRefresh requires video reference", () => {
  assert.equal(
    isEligibleForTikTokRefresh({
      video_id: null,
      content_link: null,
      insights_status: null,
    }),
    false,
  );
  assert.equal(
    isEligibleForTikTokRefresh({
      video_id: "123",
      content_link: null,
      insights_status: null,
    }),
    true,
  );
  assert.equal(
    isEligibleForTikTokRefresh({
      video_id: null,
      content_link: "https://tiktok.com/@u/video/123",
      insights_status: null,
    }),
    true,
  );
});

test("isEligibleForTikTokRefresh excludes permanent_failure", () => {
  assert.equal(
    isEligibleForTikTokRefresh({
      video_id: "123",
      content_link: null,
      insights_status: "permanent_failure",
    }),
    false,
  );
  assert.equal(
    isEligibleForTikTokRefresh({
      video_id: "123",
      content_link: null,
      insights_status: "temporary_failure",
    }),
    true,
  );
});

test("isEligibleSubmissionForRun requires due-for-refresh window", () => {
  const runStartedAt = "2026-04-17T10:00:00.000Z";
  assert.equal(
    isEligibleSubmissionForRun(
      {
        video_id: "123",
        content_link: null,
        insights_status: null,
        last_insights_update: null,
      },
      runStartedAt,
    ),
    true,
  );
  assert.equal(
    isEligibleSubmissionForRun(
      {
        video_id: "123",
        content_link: null,
        insights_status: null,
        last_insights_update: "2026-04-17T09:59:59.000Z",
      },
      runStartedAt,
    ),
    true,
  );
  assert.equal(
    isEligibleSubmissionForRun(
      {
        video_id: "123",
        content_link: null,
        insights_status: null,
        last_insights_update: "2026-04-17T10:00:00.000Z",
      },
      runStartedAt,
    ),
    false,
  );
});
