import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeHighestPlatformDecisions,
  emptyHighestPlatformDecisions,
  type HighestPlatformSubmissionRow,
} from "./highest-platform-payout";
import {
  countNotCountedSubmissions,
  formatHighestPlatformTotals,
  highestPlatformCountsTowardPayoutCell,
  highestPlatformCreatorInfo,
  highestPlatformCreatorLabel,
  highestPlatformExportRuleNote,
  highestPlatformNotCountedInfo,
  highestPlatformPaidPlatformCell,
} from "./highest-platform-payout-display";

function contest(flag = true) {
  return {
    contest_type: "cpm",
    platform: "youtube,instagram",
    contest_based_details: {
      highest_platform_payout_only: flag,
      youtube: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 1 } },
      instagram: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 1 } },
    },
  };
}

function row(
  id: string,
  platform: string,
  views: number,
  extra: Partial<HighestPlatformSubmissionRow> = {},
): HighestPlatformSubmissionRow {
  return {
    id,
    creator_id: "c1",
    created_at: "2026-10-01T00:00:00Z",
    status: "verified",
    platform,
    views,
    ...extra,
  };
}

const rows = [
  row("yt", "youtube", 2_000),
  row("ig", "instagram", 5_000),
  row("solo", "youtube", 1_000, { creator_id: "c2" }),
];

describe("highest-platform display helpers", () => {
  const decisions = computeHighestPlatformDecisions(contest(), rows);

  it("labels the not-counted submission with the winning platform totals", () => {
    assert.equal(highestPlatformNotCountedInfo(decisions, { id: "ig", creator_id: "c1" }), null);
    const info = highestPlatformNotCountedInfo(decisions, { id: "yt", creator_id: "c1" });
    assert.equal(info?.label, "Not counted · Instagram earns more");
    assert.match(info?.detail ?? "", /YouTube \$2\.00 · Instagram \$5\.00 \(counts\)/);
  });

  it("never says a rejected submission counts", () => {
    assert.equal(
      highestPlatformCountsTowardPayoutCell(decisions, {
        id: "rj",
        creator_id: "c1",
        status: "rejected",
      }),
      "No",
    );
  });

  it("formats export cells", () => {
    assert.equal(highestPlatformCountsTowardPayoutCell(decisions, { id: "ig", creator_id: "c1" }), "Yes");
    assert.equal(
      highestPlatformCountsTowardPayoutCell(decisions, { id: "yt", creator_id: "c1" }),
      "No – paid for Instagram",
    );
    assert.equal(highestPlatformPaidPlatformCell(decisions, "c1"), "Instagram");
    assert.equal(highestPlatformPaidPlatformCell(decisions, "c2"), "YouTube");
    assert.equal(highestPlatformPaidPlatformCell(decisions, "nobody"), "");
  });

  it("shows the creator label only for creators on two or more platforms", () => {
    assert.equal(highestPlatformCreatorInfo(decisions, "c1")?.label, "Leading: Instagram");
    assert.equal(highestPlatformCreatorInfo(decisions, "c2"), null);
  });

  it("says 'Paid platform' once the creator was paid there", () => {
    const paid = computeHighestPlatformDecisions(contest(), [
      row("yt", "youtube", 2_000, { status: "paid", paid: true, earnings: 2_000 }),
      row("ig", "instagram", 5_000),
    ]);
    const decision = paid.byCreator.get("c1");
    assert.equal(highestPlatformCreatorLabel(decision), "Paid platform: YouTube");
    assert.equal(
      highestPlatformNotCountedInfo(paid, { id: "ig", creator_id: "c1" })?.label,
      "Not counted · paid for YouTube",
    );
  });

  it("counts not-counted rows", () => {
    assert.equal(countNotCountedSubmissions(decisions, rows), 1);
    assert.equal(countNotCountedSubmissions(decisions, [{ id: "ig" }]), 0);
  });

  it("is inert when the switch is off", () => {
    const off = computeHighestPlatformDecisions(contest(false), rows);
    assert.equal(highestPlatformNotCountedInfo(off, { id: "yt", creator_id: "c1" }), null);
    assert.equal(highestPlatformCountsTowardPayoutCell(off, { id: "yt", creator_id: "c1" }), "Yes");
    assert.equal(highestPlatformCreatorInfo(off, "c1"), null);
    assert.equal(highestPlatformPaidPlatformCell(off, "c1"), "");
    assert.equal(countNotCountedSubmissions(emptyHighestPlatformDecisions(), rows), 0);
  });

  it("keeps campaign order in totals and names the tie-break platform", () => {
    assert.equal(
      formatHighestPlatformTotals(decisions.byCreator.get("c1"), ["instagram", "youtube"]),
      "Instagram $5.00 (counts) · YouTube $2.00",
    );
    assert.match(highestPlatformExportRuleNote(["youtube", "instagram"]), /Ties go to YouTube\.$/);
  });
});
