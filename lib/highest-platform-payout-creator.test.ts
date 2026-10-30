import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeHighestPlatformDecisions,
  type HighestPlatformSubmissionRow,
} from "./highest-platform-payout";
import {
  buildCreatorHighestPlatformSummary,
  creatorPlatformTotalsText,
  creatorSubmissionPayoutTag,
  isCreatorSubmissionExcluded,
  type CreatorHighestPlatformSummary,
} from "./highest-platform-payout-creator";

function cpmContest(flag = true) {
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
  creatorId: string,
  platform: string,
  views: number,
  extra: Partial<HighestPlatformSubmissionRow> = {},
): HighestPlatformSubmissionRow {
  return {
    id,
    creator_id: creatorId,
    created_at: "2026-10-01T00:00:00Z",
    status: "verified",
    platform,
    views,
    ...extra,
  };
}

const rows = [
  row("me-yt", "me", "youtube", 40_000),
  row("me-ig", "me", "instagram", 10_000),
  row("other-yt", "other", "youtube", 1_000),
  row("other-ig", "other", "instagram", 9_000),
];

function mySummary(
  allRows = rows,
  myIds = ["me-yt", "me-ig", "me-rejected"],
): CreatorHighestPlatformSummary {
  const decisions = computeHighestPlatformDecisions(cpmContest(), allRows);
  return buildCreatorHighestPlatformSummary("c1", decisions, "me", myIds)!;
}

describe("buildCreatorHighestPlatformSummary", () => {
  it("returns only the caller's own decision and excluded ids", () => {
    const summary = mySummary();
    assert.equal(summary.contestId, "c1");
    assert.equal(summary.winner, "youtube");
    assert.deepEqual(summary.platforms, ["youtube", "instagram"]);
    assert.deepEqual(summary.excludedSubmissionIds, ["me-ig"]);
    assert.deepEqual(summary.totalsCents, { youtube: 4_000, instagram: 1_000 });
    assert.equal(summary.provisional, false);
    assert.equal(summary.lockedByPayment, false);
  });

  it("is null when the switch is off or the caller has no live entries", () => {
    const off = computeHighestPlatformDecisions(cpmContest(false), rows);
    assert.equal(buildCreatorHighestPlatformSummary("c1", off, "me", ["me-yt"]), null);
    const on = computeHighestPlatformDecisions(cpmContest(), rows);
    assert.equal(buildCreatorHighestPlatformSummary("c1", on, "nobody", []), null);
  });
});

describe("creatorSubmissionPayoutTag", () => {
  it("marks the losing platform as not counted with platform totals", () => {
    const summary = mySummary();
    assert.equal(isCreatorSubmissionExcluded(summary, "me-ig"), true);
    assert.equal(isCreatorSubmissionExcluded(summary, "me-yt"), false);
    const tag = creatorSubmissionPayoutTag(summary, {
      id: "me-ig",
      platform: "instagram",
      status: "verified",
    });
    assert.deepEqual(tag, {
      counted: false,
      label: "Not counted · YouTube earns more",
      detail: "Your totals: YouTube $40.00 · Instagram $10.00. Only YouTube is paid.",
    });
  });

  it("tags the winning platform as leading, or paid once locked", () => {
    const leading = creatorSubmissionPayoutTag(mySummary(), {
      id: "me-yt",
      platform: "youtube",
      status: "verified",
    });
    assert.equal(leading?.counted, true);
    assert.equal(leading?.label, "Leading");

    const paidRows = [
      row("me-yt", "me", "youtube", 1_000, { status: "paid", paid: true, earnings: 100 }),
      row("me-ig", "me", "instagram", 90_000),
    ];
    const paid = mySummary(paidRows, ["me-yt", "me-ig"]);
    assert.equal(paid.lockedByPayment, true);
    assert.equal(
      creatorSubmissionPayoutTag(paid, { id: "me-yt", platform: "youtube" })?.label,
      "Paid platform",
    );
    assert.equal(
      creatorSubmissionPayoutTag(paid, { id: "me-ig", platform: "instagram" })?.label,
      "Not counted · paid for YouTube",
    );
  });

  it("shows nothing for single-platform creators, rejected rows or no summary", () => {
    const single = mySummary(
      [row("a", "me", "youtube", 5_000), row("b", "me", "youtube", 1_000)],
      ["a", "b"],
    );
    assert.equal(creatorSubmissionPayoutTag(single, { id: "a", platform: "youtube" }), null);
    assert.equal(
      creatorSubmissionPayoutTag(mySummary(), {
        id: "me-rejected",
        platform: "instagram",
        status: "rejected",
      }),
      null,
    );
    assert.equal(creatorSubmissionPayoutTag(null, { id: "a", platform: "youtube" }), null);
  });
});

describe("creatorPlatformTotalsText", () => {
  it("lists totals in campaign platform order", () => {
    const summary: CreatorHighestPlatformSummary = {
      contestId: "c1",
      platforms: ["instagram", "youtube"],
      winner: "youtube",
      provisional: false,
      lockedByPayment: false,
      totalsCents: { youtube: 1_250, instagram: 999 },
      excludedSubmissionIds: [],
    };
    assert.equal(
      creatorPlatformTotalsText(summary),
      "Your totals: Instagram $9.99 · YouTube $12.50.",
    );
  });
});
