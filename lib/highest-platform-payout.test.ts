import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeHighestPlatformDecisions,
  isCreatorPlatformCounted,
  isHighestPlatformPayoutOnly,
  isSubmissionCountedForPayout,
  maskExcludedCents,
  type HighestPlatformSubmissionRow,
} from "./highest-platform-payout";

function cpmCampaign(rate: number) {
  return { contest_type: "cpm", cpm_contest: { cpm_rate_usd: rate } };
}

function cpmContest(
  overrides: Record<string, unknown> = {},
  platform = "youtube,instagram",
) {
  return {
    contest_type: "cpm",
    platform,
    max_earnings_per_creator: null as unknown,
    contest_based_details: {
      highest_platform_payout_only: true,
      youtube: cpmCampaign(1),
      instagram: cpmCampaign(1),
      tiktok: cpmCampaign(1),
      ...overrides,
    },
  };
}

let seq = 0;
function row(
  partial: Partial<HighestPlatformSubmissionRow> & { platform: string },
): HighestPlatformSubmissionRow {
  seq += 1;
  return {
    id: partial.id ?? `s${seq}`,
    creator_id: "c1",
    created_at: `2026-10-0${(seq % 9) + 1}T00:00:00Z`,
    status: "verified",
    views: 0,
    ...partial,
  };
}

describe("isHighestPlatformPayoutOnly", () => {
  it("is on only for flagged multi-platform cpm/milestone/dual campaigns", () => {
    assert.equal(isHighestPlatformPayoutOnly(cpmContest()), true);
    assert.equal(isHighestPlatformPayoutOnly(cpmContest({}, "youtube")), false);
    assert.equal(
      isHighestPlatformPayoutOnly({ ...cpmContest(), contest_type: "leaderboard" }),
      false,
    );
    assert.equal(
      isHighestPlatformPayoutOnly({
        ...cpmContest(),
        contest_based_details: { youtube: cpmCampaign(1) },
      }),
      false,
    );
  });
});

describe("computeHighestPlatformDecisions", () => {
  it("pays only the higher platform total", () => {
    const yt1 = row({ id: "yt1", platform: "youtube", views: 30_000 });
    const yt2 = row({ id: "yt2", platform: "youtube", views: 20_000 });
    const ig = row({ id: "ig", platform: "instagram", views: 80_000 });
    const d = computeHighestPlatformDecisions(cpmContest(), [yt1, yt2, ig]);
    const c1 = d.byCreator.get("c1")!;
    assert.equal(c1.winner, "instagram");
    assert.equal(c1.totalsCents.youtube, 5_000);
    assert.equal(c1.totalsCents.instagram, 8_000);
    assert.equal(isSubmissionCountedForPayout(d, "ig"), true);
    assert.equal(isSubmissionCountedForPayout(d, "yt1"), false);
    assert.equal(isSubmissionCountedForPayout(d, "yt2"), false);
  });

  it("does nothing when the switch is off", () => {
    const contest = cpmContest();
    contest.contest_based_details.highest_platform_payout_only = false;
    const d = computeHighestPlatformDecisions(contest, [
      row({ id: "a", platform: "youtube", views: 1_000 }),
      row({ id: "b", platform: "instagram", views: 9_000 }),
    ]);
    assert.equal(d.enabled, false);
    assert.equal(isSubmissionCountedForPayout(d, "a"), true);
  });

  it("keeps single-platform creators unchanged", () => {
    const d = computeHighestPlatformDecisions(cpmContest(), [
      row({ id: "a", platform: "youtube", views: 1_000 }),
      row({ id: "b", platform: "youtube", views: 2_000 }),
    ]);
    assert.equal(d.byCreator.get("c1")!.winner, "youtube");
    assert.equal(d.excludedSubmissionIds.size, 0);
  });

  it("breaks ties by campaign platform order", () => {
    const rows = [
      row({ id: "yt", platform: "youtube", views: 5_000 }),
      row({ id: "ig", platform: "instagram", views: 5_000 }),
    ];
    assert.equal(
      computeHighestPlatformDecisions(cpmContest(), rows).byCreator.get("c1")!
        .winner,
      "youtube",
    );
    assert.equal(
      computeHighestPlatformDecisions(
        cpmContest({}, "instagram,youtube"),
        rows,
      ).byCreator.get("c1")!.winner,
      "instagram",
    );
  });

  it("handles three platforms with a partial tie", () => {
    const d = computeHighestPlatformDecisions(
      cpmContest({}, "tiktok,youtube,instagram"),
      [
        row({ id: "yt", platform: "youtube", views: 7_000 }),
        row({ id: "ig", platform: "instagram", views: 7_000 }),
        row({ id: "tt", platform: "tiktok", views: 1_000 }),
      ],
    );
    assert.equal(d.byCreator.get("c1")!.winner, "youtube");
    assert.deepEqual([...d.excludedSubmissionIds].sort(), ["ig", "tt"]);
  });

  it("has no winner and excludes nothing when nothing is earned", () => {
    const d = computeHighestPlatformDecisions(cpmContest(), [
      row({ id: "a", platform: "youtube", views: 0 }),
      row({ id: "b", platform: "instagram", views: 0 }),
    ]);
    assert.equal(d.byCreator.get("c1")!.winner, null);
    assert.equal(d.excludedSubmissionIds.size, 0);
  });

  it("applies each platform's cap before comparing", () => {
    const contest = cpmContest();
    contest.max_earnings_per_creator = {
      youtube: { max_earnings_per_creator: 3_000 },
      instagram: { max_earnings_per_creator: null },
    };
    const d = computeHighestPlatformDecisions(contest, [
      row({ id: "yt", platform: "youtube", views: 90_000 }),
      row({ id: "ig", platform: "instagram", views: 40_000 }),
    ]);
    const c1 = d.byCreator.get("c1")!;
    assert.equal(c1.totalsCents.youtube, 3_000);
    assert.equal(c1.winner, "instagram");
  });

  it("applies a single cap number to each platform separately", () => {
    const contest = cpmContest();
    contest.max_earnings_per_creator = 5_000;
    const d = computeHighestPlatformDecisions(contest, [
      row({ id: "yt", platform: "youtube", views: 40_000, created_at: "2026-10-01T00:00:00Z" }),
      row({ id: "ig", platform: "instagram", views: 45_000, created_at: "2026-10-02T00:00:00Z" }),
    ]);
    const c1 = d.byCreator.get("c1")!;
    assert.equal(c1.totalsCents.youtube, 4_000);
    assert.equal(c1.totalsCents.instagram, 4_500);
    assert.equal(c1.winner, "instagram");
  });

  it("counts the flat-fee bonus toward its platform", () => {
    const contest = cpmContest({
      youtube: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 1, flat_fee_bonus: 3_000 } },
      instagram: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 1, flat_fee_bonus: 0 } },
    });
    const d = computeHighestPlatformDecisions(contest, [
      row({ id: "yt", platform: "youtube", views: 1_000 }),
      row({ id: "ig", platform: "instagram", views: 3_000 }),
    ]);
    assert.equal(d.byCreator.get("c1")!.winner, "youtube");
  });

  it("lets the lead switch when a new video overtakes", () => {
    const yt = row({ id: "yt", platform: "youtube", views: 50_000 });
    const ig1 = row({ id: "ig1", platform: "instagram", views: 30_000 });
    const before = computeHighestPlatformDecisions(cpmContest(), [yt, ig1]);
    assert.equal(before.byCreator.get("c1")!.winner, "youtube");
    const ig2 = row({ id: "ig2", platform: "instagram", views: 30_000 });
    const after = computeHighestPlatformDecisions(cpmContest(), [yt, ig1, ig2]);
    assert.equal(after.byCreator.get("c1")!.winner, "instagram");
    assert.equal(isSubmissionCountedForPayout(after, "yt"), false);
  });

  it("ignores pending and rejected videos when verified ones exist", () => {
    const d = computeHighestPlatformDecisions(cpmContest(), [
      row({ id: "yt", platform: "youtube", views: 1_000 }),
      row({ id: "igp", platform: "instagram", views: 90_000, status: "pending" }),
      row({ id: "igr", platform: "instagram", views: 90_000, status: "rejected" }),
    ]);
    const c1 = d.byCreator.get("c1")!;
    assert.equal(c1.winner, "youtube");
    assert.equal(c1.provisional, false);
    assert.equal(isSubmissionCountedForPayout(d, "igp"), false);
    assert.equal(isSubmissionCountedForPayout(d, "igr"), true);
  });

  it("uses pending videos as a provisional leader when nothing is verified", () => {
    const d = computeHighestPlatformDecisions(cpmContest(), [
      row({ id: "yt", platform: "youtube", views: 1_000, status: "pending" }),
      row({ id: "ig", platform: "instagram", views: 2_000, status: "pending" }),
    ]);
    const c1 = d.byCreator.get("c1")!;
    assert.equal(c1.winner, "instagram");
    assert.equal(c1.provisional, true);
  });

  it("locks the winner to the platform already paid", () => {
    const d = computeHighestPlatformDecisions(cpmContest(), [
      row({ id: "yt", platform: "youtube", views: 1_000, status: "paid", paid: true, earnings: 100 }),
      row({ id: "ig", platform: "instagram", views: 90_000 }),
    ]);
    const c1 = d.byCreator.get("c1")!;
    assert.equal(c1.winner, "youtube");
    assert.equal(c1.lockedByPayment, true);
    assert.equal(isSubmissionCountedForPayout(d, "ig"), false);
    assert.equal(isSubmissionCountedForPayout(d, "yt"), true);
  });

  it("puts videos with no platform on the campaign's first platform", () => {
    const d = computeHighestPlatformDecisions(cpmContest(), [
      row({ id: "none", platform: "", views: 9_000 }),
      row({ id: "ig", platform: "instagram", views: 5_000 }),
    ]);
    assert.equal(d.byCreator.get("c1")!.winner, "youtube");
    assert.equal(isSubmissionCountedForPayout(d, "ig"), false);
  });

  it("decides each creator independently", () => {
    const d = computeHighestPlatformDecisions(cpmContest(), [
      row({ id: "a-yt", creator_id: "a", platform: "youtube", views: 9_000 }),
      row({ id: "a-ig", creator_id: "a", platform: "instagram", views: 1_000 }),
      row({ id: "b-yt", creator_id: "b", platform: "youtube", views: 1_000 }),
      row({ id: "b-ig", creator_id: "b", platform: "instagram", views: 9_000 }),
    ]);
    assert.equal(d.byCreator.get("a")!.winner, "youtube");
    assert.equal(d.byCreator.get("b")!.winner, "instagram");
    assert.deepEqual([...d.excludedSubmissionIds].sort(), ["a-ig", "b-yt"]);
  });

  it("adds milestone and CPM together for dual rewards", () => {
    const dual = (rate: number, payout: number) => ({
      contest_type: "dual_rewards",
      cpm_contest: { cpm_rate_usd: rate },
      milestone_contest: {
        milestones: [{ order: 1, target_views: 1_000, payout_cents: payout }],
      },
    });
    const contest = {
      contest_type: "dual_rewards",
      platform: "youtube,instagram",
      contest_based_details: {
        highest_platform_payout_only: true,
        youtube: dual(1, 500),
        instagram: dual(1, 5_000),
      },
    };
    const d = computeHighestPlatformDecisions(contest, [
      row({ id: "yt", platform: "youtube", views: 4_000 }),
      row({ id: "ig", platform: "instagram", views: 2_000 }),
    ]);
    const c1 = d.byCreator.get("c1")!;
    assert.equal(c1.totalsCents.youtube, 900);
    assert.equal(c1.totalsCents.instagram, 5_200);
    assert.equal(c1.winner, "instagram");
  });

  it("counts the most-verified bonus only toward its own platform", () => {
    const milestone = (mvCents: number) => ({
      contest_type: "milestone",
      milestone_contest: {
        milestones: [{ order: 1, target_views: 1_000, payout_cents: 1_000 }],
        bonus: {
          enabled: mvCents > 0,
          most_verified_views: { payout_cents: mvCents, min_total_views: 1 },
        },
      },
    });
    const contest = {
      contest_type: "milestone",
      platform: "youtube,instagram",
      contest_based_details: {
        highest_platform_payout_only: true,
        youtube: milestone(0),
        instagram: milestone(5_000),
      },
    };
    const d = computeHighestPlatformDecisions(contest, [
      row({ id: "yt1", platform: "youtube", views: 2_000 }),
      row({ id: "yt2", platform: "youtube", views: 2_000 }),
      row({ id: "ig", platform: "instagram", views: 2_000 }),
    ]);
    const c1 = d.byCreator.get("c1")!;
    assert.equal(c1.totalsCents.youtube, 2_000);
    assert.equal(c1.totalsCents.instagram, 6_000);
    assert.equal(c1.winner, "instagram");
    assert.equal(isCreatorPlatformCounted(d, "c1", "instagram"), true);
    assert.equal(isCreatorPlatformCounted(d, "c1", "youtube"), false);
  });

  it("masks excluded submissions in a cents map", () => {
    const d = computeHighestPlatformDecisions(cpmContest(), [
      row({ id: "yt", platform: "youtube", views: 1_000 }),
      row({ id: "ig", platform: "instagram", views: 2_000 }),
    ]);
    const masked = maskExcludedCents(
      new Map([
        ["yt", 100],
        ["ig", 200],
      ]),
      d,
    );
    assert.equal(masked.get("yt"), 0);
    assert.equal(masked.get("ig"), 200);
  });
});
