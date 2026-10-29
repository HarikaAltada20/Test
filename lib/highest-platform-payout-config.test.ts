import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasCampaignEnded,
  highestPlatformPayoutLockReason,
  withHighestPlatformPayoutFlag,
} from "./highest-platform-payout-config";

describe("withHighestPlatformPayoutFlag", () => {
  const base = { youtube: { contest_type: "cpm" }, twitter_campaign: { a: 1 } };

  it("writes true for an eligible campaign and keeps other keys", () => {
    assert.deepEqual(withHighestPlatformPayoutFlag(base, true, "cpm", 2, "video"), {
      ...base,
      highest_platform_payout_only: true,
    });
  });

  it("removes the key when the switch is off", () => {
    const out = withHighestPlatformPayoutFlag(
      { ...base, highest_platform_payout_only: true },
      false,
      "cpm",
      2,
    );
    assert.deepEqual(out, base);
  });

  it("removes a stale true when the campaign no longer qualifies", () => {
    const stale = { ...base, highest_platform_payout_only: true };
    assert.equal("highest_platform_payout_only" in withHighestPlatformPayoutFlag(stale, true, "cpm", 1), false);
    assert.equal(
      "highest_platform_payout_only" in withHighestPlatformPayoutFlag(stale, true, "leaderboard", 3),
      false,
    );
    assert.equal(
      "highest_platform_payout_only" in withHighestPlatformPayoutFlag(stale, true, "cpm", 2, "text_image"),
      false,
    );
  });

  it("works for milestone and dual rewards and does not mutate the input", () => {
    const input = { ...base };
    assert.equal(withHighestPlatformPayoutFlag(input, true, "milestone", 2).highest_platform_payout_only, true);
    assert.equal(withHighestPlatformPayoutFlag(input, true, "dual_rewards", 3).highest_platform_payout_only, true);
    assert.equal("highest_platform_payout_only" in input, false);
    assert.deepEqual(withHighestPlatformPayoutFlag(null, true, "cpm", 2), {
      highest_platform_payout_only: true,
    });
  });
});

describe("highestPlatformPayoutLockReason", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");
  const upcoming = {
    moderation_status: "published",
    start_date: "2026-10-25T00:00:00Z",
    end_date: "2026-11-25T00:00:00Z",
  };
  const live = { ...upcoming, start_date: "2026-10-20T00:00:00Z" };
  const ended = { ...live, end_date: "2026-10-21T00:00:00Z" };

  it("lets brand and admin change it before the campaign starts", () => {
    assert.equal(highestPlatformPayoutLockReason(upcoming, false, now), null);
    assert.equal(highestPlatformPayoutLockReason(upcoming, true, now), null);
  });

  it("lets only an admin change it while live", () => {
    assert.match(String(highestPlatformPayoutLockReason(live, false, now)), /admin/);
    assert.equal(highestPlatformPayoutLockReason(live, true, now), null);
  });

  it("does not lock a brand's unpublished campaign after its start date", () => {
    assert.equal(
      highestPlatformPayoutLockReason({ ...live, moderation_status: "draft" }, false, now),
      null,
    );
  });

  it("locks everyone once the campaign has ended", () => {
    assert.match(String(highestPlatformPayoutLockReason(ended, true, now)), /ended/);
    assert.match(String(highestPlatformPayoutLockReason(ended, false, now)), /ended/);
    assert.match(
      String(highestPlatformPayoutLockReason({ ...live, post_contest_status: "in_review" }, true, now)),
      /ended/,
    );
  });
});

describe("hasCampaignEnded", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");

  it("uses the end date and the post-campaign status", () => {
    assert.equal(hasCampaignEnded({ end_date: "2026-10-22T12:00:00Z" }, now), true);
    assert.equal(hasCampaignEnded({ end_date: "2026-10-23T00:00:00Z" }, now), false);
    assert.equal(hasCampaignEnded({ end_date: null }, now), false);
    assert.equal(hasCampaignEnded({ end_date: "not a date" }, now), false);
    assert.equal(hasCampaignEnded({ post_contest_status: "pending_review" }, now), true);
    assert.equal(hasCampaignEnded(null, now), false);
  });

  it("ignores old dates on a draft that never ran", () => {
    const draft = { moderation_status: "draft", end_date: "2026-10-01T00:00:00Z" };
    assert.equal(hasCampaignEnded(draft, now), false);
    assert.equal(highestPlatformPayoutLockReason(draft, false, now), null);
    assert.equal(hasCampaignEnded({ ...draft, post_contest_status: "in_review" }, now), true);
    assert.equal(hasCampaignEnded({ ...draft, moderation_status: "pending_approval" }, now), true);
  });
});
