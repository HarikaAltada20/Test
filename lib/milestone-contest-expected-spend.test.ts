import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMilestoneMostVerifiedBonusByCreatorMapFromDetails,
  buildMilestoneSubmissionPayoutAssignmentsFromDetails,
  winnerCountsByTargetForPlatform,
} from "./milestone-contest-expected-spend";

const multiPlatformDetails = {
  youtube: {
    contest_type: "milestone",
    milestone_contest: {
      milestones: [
        {
          order: 1,
          target_views: 1000,
          payout_cents: 1_000,
          winner_limit: 1,
        },
      ],
    },
  },
  tiktok: {
    contest_type: "milestone",
    milestone_contest: {
      milestones: [
        {
          order: 1,
          target_views: 1000,
          payout_cents: 5_000,
          winner_limit: 1,
        },
      ],
    },
  },
  instagram: {
    contest_type: "milestone",
    milestone_contest: {
      milestones: [
        {
          order: 1,
          target_views: 500,
          payout_cents: 2_000,
          winner_limit: null,
        },
      ],
    },
  },
};

describe("buildMilestoneSubmissionPayoutAssignmentsFromDetails", () => {
  it("applies each platform ladder independently", () => {
    const assignments = buildMilestoneSubmissionPayoutAssignmentsFromDetails(
      [
        {
          id: "yt",
          creator_id: "c1",
          created_at: "2026-06-01T00:00:00.000Z",
          status: "verified",
          views: 2_000,
          platform: "youtube",
        },
        {
          id: "tt",
          creator_id: "c2",
          created_at: "2026-06-01T00:00:01.000Z",
          status: "verified",
          views: 2_000,
          platform: "tiktok",
        },
      ],
      multiPlatformDetails,
      "youtube,tiktok,instagram",
    );

    assert.equal(assignments.payoutMap.get("yt"), 1_000);
    assert.equal(assignments.payoutMap.get("tt"), 5_000);
    assert.equal(
      winnerCountsByTargetForPlatform(assignments.winnerCountsByKey, "youtube").get(
        1000,
      ),
      1,
    );
    assert.equal(
      winnerCountsByTargetForPlatform(assignments.winnerCountsByKey, "tiktok").get(
        1000,
      ),
      1,
    );
    assert.equal(
      winnerCountsByTargetForPlatform(
        assignments.winnerCountsByKey,
        "youtube,tiktok,instagram",
      ).get(1000),
      2,
    );
  });

  it("does not let one platform consume another platform's winner_limit", () => {
    const assignments = buildMilestoneSubmissionPayoutAssignmentsFromDetails(
      [
        {
          id: "yt1",
          creator_id: "c1",
          created_at: "2026-06-01T00:00:00.000Z",
          status: "verified",
          views: 2_000,
          platform: "youtube",
        },
        {
          id: "yt2",
          creator_id: "c2",
          created_at: "2026-06-01T00:00:01.000Z",
          status: "verified",
          views: 2_000,
          platform: "youtube",
        },
        {
          id: "tt",
          creator_id: "c3",
          created_at: "2026-06-01T00:00:02.000Z",
          status: "verified",
          views: 2_000,
          platform: "tiktok",
        },
      ],
      multiPlatformDetails,
      "youtube,tiktok",
    );

    assert.equal(assignments.payoutMap.get("yt1"), 1_000);
    assert.equal(assignments.payoutMap.get("yt2"), 0);
    assert.equal(assignments.payoutMap.get("tt"), 5_000);
  });

  it("uses Instagram reach for milestone views", () => {
    const assignments = buildMilestoneSubmissionPayoutAssignmentsFromDetails(
      [
        {
          id: "ig",
          creator_id: "c1",
          created_at: "2026-06-01T00:00:00.000Z",
          status: "verified",
          views: 0,
          platform: "instagram",
          other_stats: { instagram: { views: 0, reach: 800 } },
        },
      ],
      multiPlatformDetails,
      "instagram",
    );

    assert.equal(assignments.payoutMap.get("ig"), 2_000);
  });
});

describe("buildMilestoneMostVerifiedBonusByCreatorMapFromDetails", () => {
  const bonusDetails = {
    youtube: {
      contest_type: "milestone",
      milestone_contest: {
        milestones: [{ order: 1, target_views: 1000, payout_cents: 1000 }],
        bonus: {
          enabled: true,
          most_verified_views: {
            payout_cents: 1_000,
            min_total_views: 100,
          },
          most_verified_reels: {
            payout_cents: 2_000,
            min_verified_reels: 1,
          },
        },
      },
    },
    tiktok: {
      contest_type: "milestone",
      milestone_contest: {
        milestones: [{ order: 1, target_views: 1000, payout_cents: 1000 }],
        bonus: {
          enabled: true,
          most_verified_views: {
            payout_cents: 3_000,
            min_total_views: 100,
          },
          most_verified_reels: {
            payout_cents: 4_000,
            min_verified_reels: 1,
          },
        },
      },
    },
  };

  it("runs most-verified races per platform when bonus lives only under nested campaigns", () => {
    const map = buildMilestoneMostVerifiedBonusByCreatorMapFromDetails(
      [
        {
          id: "yt",
          creator_id: "c1",
          created_at: "2026-06-01T00:00:00.000Z",
          status: "verified",
          views: 500,
          platform: "youtube",
        },
        {
          id: "tt",
          creator_id: "c2",
          created_at: "2026-06-01T00:00:01.000Z",
          status: "verified",
          views: 500,
          platform: "tiktok",
        },
      ],
      bonusDetails,
      "youtube,tiktok",
    );

    assert.equal(map.get("c1")?.viewsExpectedCents, 1_000);
    assert.equal(map.get("c1")?.expectedCents, 2_000);
    assert.equal(map.get("c2")?.viewsExpectedCents, 3_000);
    assert.equal(map.get("c2")?.expectedCents, 4_000);
  });

  it("applies the paid ledger once after merging platform expected amounts", () => {
    const map = buildMilestoneMostVerifiedBonusByCreatorMapFromDetails(
      [
        {
          id: "yt",
          creator_id: "c1",
          created_at: "2026-06-01T00:00:00.000Z",
          status: "verified",
          views: 500,
          platform: "youtube",
        },
        {
          id: "tt",
          creator_id: "c1",
          created_at: "2026-06-01T00:00:01.000Z",
          status: "verified",
          views: 500,
          platform: "tiktok",
        },
      ],
      bonusDetails,
      "youtube,tiktok",
      {
        c1: { viewsPaidCents: 4_000, reelsPaidCents: 6_000 },
      },
    );

    assert.equal(map.get("c1")?.viewsExpectedCents, 4_000);
    assert.equal(map.get("c1")?.expectedCents, 6_000);
    assert.equal(map.get("c1")?.viewsPaidCents, 4_000);
    assert.equal(map.get("c1")?.paidCents, 6_000);
  });
});
