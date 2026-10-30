import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeHighestPlatformDecisions,
  highestPlatformNotPayableMessage,
  highestPlatformPayoutLedgerNote,
  type HighestPlatformSubmissionRow,
} from "./highest-platform-payout";
import { buildDualCreatorCapMapsFromCreatorRows } from "./dual-rewards-payout-eligibility";
import { HIGHEST_PLATFORM_SUBMISSION_STATUSES } from "./highest-platform-payout-server";
import type { Database } from "../types/supabase";

function cpm(rate: number) {
  return { contest_type: "cpm", cpm_contest: { cpm_rate_usd: rate } };
}

function contest(flag: boolean) {
  return {
    contest_type: "cpm",
    platform: "youtube,instagram",
    contest_based_details: {
      highest_platform_payout_only: flag,
      youtube: cpm(1),
      instagram: cpm(1),
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
    created_at: `2026-10-0${id.length}T00:00:00Z`,
    status: "verified",
    platform,
    views,
    ...extra,
  };
}

describe("payout notes for the best-platform rule", () => {
  it("names the paid platform in the refusal message", () => {
    const d = computeHighestPlatformDecisions(contest(true), [
      row("y", "youtube", 1_000),
      row("ig", "instagram", 3_000),
    ]);
    assert.equal(
      highestPlatformNotPayableMessage(d.byCreator.get("c1")),
      "Not counted: this creator is paid for Instagram (their highest-earning platform).",
    );
    assert.match(highestPlatformNotPayableMessage(null), /highest-earning platform only/);
  });

  it("records the decision on the wallet credit", () => {
    const d = computeHighestPlatformDecisions(contest(true), [
      row("y", "youtube", 1_000),
      row("ig", "instagram", 3_000),
    ]);
    const note = highestPlatformPayoutLedgerNote(d, "c1");
    assert.deepEqual(note?.metadata, {
      highest_platform_payout: {
        winner: "instagram",
        totals_cents: { youtube: 100, instagram: 300 },
      },
    });
    assert.equal(
      note?.descriptionSuffix,
      " – paid for Instagram (highest-earning platform)",
    );
  });

  it("adds no description suffix for a single-platform creator", () => {
    const d = computeHighestPlatformDecisions(contest(true), [
      row("y", "youtube", 1_000),
    ]);
    assert.equal(highestPlatformPayoutLedgerNote(d, "c1")?.descriptionSuffix, "");
  });

  it("is null when the rule is off", () => {
    const d = computeHighestPlatformDecisions(contest(false), [
      row("y", "youtube", 1_000),
      row("ig", "instagram", 3_000),
    ]);
    assert.equal(highestPlatformPayoutLedgerNote(d, "c1"), null);
  });
});

describe("dual rewards caps with the best-platform rule", () => {
  // One $5 cap (single number). Without the rule both platforms share it in
  // created_at order; with the rule each platform gets its own $5.
  const details = (flag: boolean) => ({
    highest_platform_payout_only: flag,
    youtube: { contest_type: "dual_rewards", cpm_contest: { cpm_rate_usd: 1 } },
    instagram: { contest_type: "dual_rewards", cpm_contest: { cpm_rate_usd: 1 } },
  });
  const records = [
    { id: "y", creator_id: "c1", created_at: "2026-10-01T00:00:00Z", status: "verified", platform: "youtube", views: 4_000 },
    { id: "ig", creator_id: "c1", created_at: "2026-10-02T00:00:00Z", status: "verified", platform: "instagram", views: 4_000 },
  ];
  const build = (flag: boolean) =>
    buildDualCreatorCapMapsFromCreatorRows(records, new Map(), null, 500, {
      details: details(flag),
      contestPlatformCsv: "youtube,instagram",
      maxEarningsPerCreator: 500,
    });

  it("shares one cap across platforms when the rule is off", () => {
    const maps = build(false);
    assert.equal(maps.cpmCappedBySubmissionId.get("y"), 400);
    assert.equal(maps.cpmCappedBySubmissionId.get("ig"), 100);
  });

  it("caps each platform on its own when the rule is on", () => {
    const maps = build(true);
    assert.equal(maps.cpmCappedBySubmissionId.get("y"), 400);
    assert.equal(maps.cpmCappedBySubmissionId.get("ig"), 400);
  });
});

describe("server loader status filter", () => {
  it("only uses values of the submissions status enum", () => {
    const enumValues: Database["public"]["Tables"]["submissions"]["Row"]["status"][] =
      ["pending", "verified", "rejected", "paid"];
    for (const status of HIGHEST_PLATFORM_SUBMISSION_STATUSES) {
      assert.ok(enumValues.includes(status), status);
    }
  });
});
