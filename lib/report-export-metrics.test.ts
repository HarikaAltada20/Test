import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCpmInsightSentence,
  computeActualPaidCents,
  computeCpmEfficiency,
  computeEffectiveCpmUsd,
  computeExpectedPayoutCents,
  computeReportCoverMetrics,
  computeReportSpend,
  resolveTargetCpmUsd,
} from "./report-export-metrics";
import type { ContestAnalyticsExportSubmission } from "@/lib/contest-analytics-export";

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function sub(
  partial: Partial<ContestAnalyticsExportSubmission> & { id: string },
): ContestAnalyticsExportSubmission {
  return {
    views: 0,
    ...partial,
  } as ContestAnalyticsExportSubmission;
}

describe("report-export-metrics", () => {
  it("uses expected payout before payouts_processed", () => {
    const submissions = [
      sub({ id: "1", views: 1000 }),
      sub({ id: "2", views: 2000 }),
    ];
    const spend = computeReportSpend({
      submissions,
      totalSubmissionCount: 2,
      approvedCount: 2,
      totalViews: 3000,
      durationDays: 10,
      contestType: "cpm",
      postContestStatus: "in_review",
      cpmRateUsd: 0.5,
      getStatus: () => "verified",
      getSubmissionExpectedCents: () => 500,
      formatMoney,
    });
    assert.equal(spend.label, "Expected Payout");
    assert.equal(spend.cents, 1000);
  });

  it("uses amount paid after payouts_processed", () => {
    const submissions = [
      sub({ id: "1", views: 1000, earnings: 400, paid: true }),
      sub({ id: "2", views: 2000, earnings: 600, bonus_amount: 100, paid: true }),
    ];
    const spend = computeReportSpend({
      submissions,
      totalSubmissionCount: 2,
      approvedCount: 2,
      totalViews: 3000,
      durationDays: 10,
      contestType: "cpm",
      postContestStatus: "payouts_processed",
      cpmRateUsd: 0.5,
      getStatus: (s) => (s.paid ? "paid" : "verified"),
      getSubmissionExpectedCents: () => 999,
      formatMoney,
    });
    assert.equal(spend.label, "Amount Paid");
    assert.equal(spend.cents, 1100);
  });

  it("resolves target CPM from campaign rate only for CPM contests", () => {
    assert.equal(resolveTargetCpmUsd("cpm", 0.5), 0.5);
    assert.equal(resolveTargetCpmUsd("dual_rewards", 1.25), 1.25);
    assert.equal(resolveTargetCpmUsd("leaderboard", 1), null);
    assert.equal(resolveTargetCpmUsd("cpm", 0), null);
  });

  it("computes effective CPM and efficiency", () => {
    const ecpm = computeEffectiveCpmUsd(10000, 1_000_000);
    assert.ok(ecpm != null);
    assert.equal(ecpm!.toFixed(3), "0.100");
    assert.equal(computeCpmEfficiency(1, 0.1), "10.0×");
  });

  it("builds insight sentence for lower effective CPM", () => {
    const sentence = buildCpmInsightSentence(1, 0.1);
    assert.match(sentence, /90% lower cost/);
    assert.match(sentence, /\$1\.00/);
  });

  it("cover metrics hide marketing block for leaderboard", () => {
    const metrics = computeReportCoverMetrics({
      submissions: [sub({ id: "1", views: 500 })],
      totalSubmissionCount: 1,
      approvedCount: 1,
      totalViews: 500,
      durationDays: 7,
      contestType: "leaderboard",
      postContestStatus: null,
      cpmRateUsd: null,
      getStatus: () => "verified",
      getSubmissionExpectedCents: () => 1000,
      formatMoney,
    });
    assert.equal(metrics.showMarketingBlock, false);
    assert.equal(metrics.targetCpmUsd, null);
    assert.equal(metrics.spendLabel, "Expected Payout");
  });

  it("sums expected payout across submissions", () => {
    const submissions = [
      sub({ id: "1" }),
      sub({ id: "2" }),
      sub({ id: "3" }),
    ];
    assert.equal(
      computeExpectedPayoutCents(submissions, () => 250),
      750,
    );
  });

  it("sums actual paid including bonus", () => {
    const submissions = [
      sub({ id: "1", earnings: 300, paid: true }),
      sub({ id: "2", earnings: 200, bonus_amount: 50, paid: true }),
      sub({ id: "3", earnings: 100 }),
    ];
    assert.equal(
      computeActualPaidCents(submissions, (s) =>
        s.paid ? "paid" : "verified",
      ),
      550,
    );
  });
});
