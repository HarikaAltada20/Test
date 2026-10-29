import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeHighestPlatformDecisions } from "./highest-platform-payout";
import {
  buildSubmissionExportCellValue,
  type RewardExportContext,
} from "./submission-leaderboard-export";
import { getSubmissionExportColumns } from "./submission-leaderboard-export-columns";

const contest = {
  contest_type: "cpm",
  platform: "youtube,instagram",
  contest_based_details: {
    highest_platform_payout_only: true,
    youtube: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 1 } },
    instagram: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 1 } },
  },
};

const rows = [
  { id: "yt", creator_id: "c1", created_at: "2026-10-01T00:00:00Z", status: "verified", platform: "youtube", views: 2_000 },
  { id: "ig", creator_id: "c1", created_at: "2026-10-02T00:00:00Z", status: "verified", platform: "instagram", views: 5_000 },
];

function ctx(withRule: boolean): RewardExportContext {
  return {
    contestType: "cpm",
    platform: "youtube,instagram",
    payoutAdjustmentPct: 0,
    showAdjustedReward: false,
    dualAdjustCpm: false,
    dualAdjustMilestone: false,
    creatorRankingMap: new Map(),
    cappedCpmExpectedMap: new Map([
      ["yt", 200],
      ["ig", 500],
    ]),
    dualMilestoneExpectedMap: new Map(),
    milestoneExpectedMap: new Map(),
    milestoneLabelMap: new Map(),
    flatFeeBonusExpectedMap: new Map([["yt", 1_000]]),
    highestPlatform: withRule
      ? computeHighestPlatformDecisions(contest, rows)
      : null,
  };
}

describe("submission export with the best-platform rule", () => {
  it("shows $0 for the losing platform and labels both rows", () => {
    const c = ctx(true);
    assert.equal(buildSubmissionExportCellValue("expected_reward", rows[0], 1, {}, c), "—");
    assert.equal(buildSubmissionExportCellValue("bonus_expected", rows[0], 1, {}, c), "—");
    assert.equal(buildSubmissionExportCellValue("expected_reward", rows[1], 1, {}, c), "$5.00");
    assert.equal(buildSubmissionExportCellValue("counts_toward_payout", rows[0], 1, {}, c), "No – paid for Instagram");
    assert.equal(buildSubmissionExportCellValue("counts_toward_payout", rows[1], 1, {}, c), "Yes");
    assert.equal(buildSubmissionExportCellValue("paid_platform", rows[0], 1, {}, c), "Instagram");
  });

  it("is unchanged when the rule is off", () => {
    const c = ctx(false);
    assert.equal(buildSubmissionExportCellValue("expected_reward", rows[0], 1, {}, c), "$2.00");
    assert.equal(buildSubmissionExportCellValue("bonus_expected", rows[0], 1, {}, c), "$10.00");
  });

  it("adds the two columns only when the rule is on", () => {
    const base = {
      platform: "youtube,instagram",
      isTwitterTextImage: false,
      canSeeCore: true,
      canSeeTraffic: true,
      canSeeDemographics: true,
      isAdminView: true,
      showAdjustedReward: false,
      showDualPayoutAdjustedColumns: false,
      dualAdjustCpm: false,
      dualAdjustMilestone: false,
      showBonusColumns: false,
      showRewardColumns: true,
      isDualRewards: false,
      isMilestoneContest: false,
    };
    const ids = (on: boolean) =>
      getSubmissionExportColumns({ ...base, highestPlatformPayoutOnly: on }).map((c) => c.id);
    assert.ok(ids(true).includes("counts_toward_payout"));
    assert.ok(ids(true).includes("paid_platform"));
    assert.ok(!ids(false).includes("counts_toward_payout"));
  });
});
