import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildInviteUrl,
  earliestInviteExpiryDate,
  getInviteLinkStatus,
  isCampaignAccessDeniedError,
  isInviteRedeemResult,
  isPrivateLikeAccessMode,
  normalizeAllowlistName,
  parseUsernames,
  resolveInviteExpiry,
  validateCampaignAccessFields,
} from "./campaign-access";

const NOW = new Date("2026-10-11T12:00:00.000Z");

describe("resolveInviteExpiry", () => {
  it("adds preset durations to now", () => {
    assert.deepEqual(resolveInviteExpiry("24h", null, NOW), {
      expiresAt: "2026-10-12T12:00:00.000Z",
    });
    assert.deepEqual(resolveInviteExpiry("7d", null, NOW), {
      expiresAt: "2026-10-18T12:00:00.000Z",
    });
    assert.deepEqual(resolveInviteExpiry("30d", null, NOW), {
      expiresAt: "2026-11-10T12:00:00.000Z",
    });
  });

  it("returns null for never", () => {
    assert.deepEqual(resolveInviteExpiry("never", null, NOW), { expiresAt: null });
  });

  const IST = -330;

  it("expires custom dates at the end of that day in the brand's zone", () => {
    assert.deepEqual(
      resolveInviteExpiry("custom", { date: "2026-12-01", tzOffsetMinutes: IST }, NOW),
      { expiresAt: "2026-12-01T18:29:59.000Z" },
    );
  });

  it("accepts tomorrow but rejects today, past and malformed dates", () => {
    // NOW is 17:30 on 11 Oct in IST.
    assert.ok(
      "expiresAt" in
        resolveInviteExpiry("custom", { date: "2026-10-12", tzOffsetMinutes: IST }, NOW),
    );
    assert.ok(
      "error" in resolveInviteExpiry("custom", { date: "2026-10-11", tzOffsetMinutes: IST }, NOW),
    );
    assert.ok(
      "error" in resolveInviteExpiry("custom", { date: "2026-10-01", tzOffsetMinutes: IST }, NOW),
    );
    assert.ok("error" in resolveInviteExpiry("custom", null, NOW));
    assert.ok(
      "error" in resolveInviteExpiry("custom", { date: "not a date", tzOffsetMinutes: IST }, NOW),
    );
    assert.ok(
      "error" in resolveInviteExpiry("custom", { date: "2026-02-30", tzOffsetMinutes: IST }, NOW),
    );
    assert.ok(
      "error" in resolveInviteExpiry("custom", { date: "2026-12-01", tzOffsetMinutes: 5000 }, NOW),
    );
  });

  it("uses the brand's local day, not UTC, to decide today", () => {
    // 20:41 UTC on 11 Oct is already 12 Oct 02:11 in IST.
    const lateUtc = new Date("2026-10-11T20:41:00.000Z");
    assert.equal(earliestInviteExpiryDate(lateUtc, IST), "2026-10-13");
    assert.ok(
      "error" in resolveInviteExpiry("custom", { date: "2026-10-12", tzOffsetMinutes: IST }, lateUtc),
    );
  });
});

describe("getInviteLinkStatus", () => {
  const base = { revoked_at: null, expires_at: null, max_uses: null, use_count: 0 };

  it("is active when never expires and unlimited", () => {
    assert.equal(getInviteLinkStatus({ ...base, use_count: 500 }, NOW), "active");
  });

  it("detects expired, full and revoked", () => {
    assert.equal(
      getInviteLinkStatus({ ...base, expires_at: "2026-10-11T11:59:59.000Z" }, NOW),
      "expired",
    );
    assert.equal(getInviteLinkStatus({ ...base, max_uses: 2, use_count: 2 }, NOW), "full");
    assert.equal(getInviteLinkStatus({ ...base, max_uses: 2, use_count: 1 }, NOW), "active");
    assert.equal(
      getInviteLinkStatus(
        { ...base, revoked_at: "2026-10-10T00:00:00.000Z", max_uses: 1, use_count: 1 },
        NOW,
      ),
      "revoked",
    );
  });
});

describe("invite helpers", () => {
  it("builds invite URLs without double slashes", () => {
    assert.equal(buildInviteUrl("abc_123", "https://goviral.app/"), "https://goviral.app/invite/abc_123");
  });

  it("recognises redeem result codes", () => {
    assert.equal(isInviteRedeemResult("joined"), true);
    assert.equal(isInviteRedeemResult("full"), true);
    assert.equal(isInviteRedeemResult("hacked"), false);
  });
});

describe("parseUsernames", () => {
  it("splits on commas, whitespace, semicolons and new lines", () => {
    const { valid, invalid } = parseUsernames("alice, bob\ncarol;dave  eve");
    assert.deepEqual(valid, ["alice", "bob", "carol", "dave", "eve"]);
    assert.deepEqual(invalid, []);
  });

  it("strips leading @ and de-duplicates case-insensitively", () => {
    const { valid } = parseUsernames("@Alice alice ALICE @@bob");
    assert.deepEqual(valid, ["Alice", "bob"]);
  });

  it("reports invalid tokens", () => {
    const { valid, invalid } = parseUsernames("ok_name bad-name what?");
    assert.deepEqual(valid, ["ok_name"]);
    assert.deepEqual(invalid, ["bad-name", "what?"]);
  });

  it("accepts arrays and empty input", () => {
    assert.deepEqual(parseUsernames(["a b", "c"]).valid, ["a", "b", "c"]);
    assert.deepEqual(parseUsernames(null), { valid: [], invalid: [] });
  });
});

describe("normalizeAllowlistName", () => {
  it("trims and collapses whitespace", () => {
    assert.equal(normalizeAllowlistName("  Top   creators "), "Top creators");
  });

  it("rejects empty, non-string and over-long names", () => {
    assert.equal(normalizeAllowlistName("   "), null);
    assert.equal(normalizeAllowlistName(42), null);
    assert.equal(normalizeAllowlistName("x".repeat(101)), null);
  });
});

describe("validateCampaignAccessFields", () => {
  it("allows public and private", () => {
    assert.equal(validateCampaignAccessFields({ access_mode: "public" }), null);
    assert.equal(validateCampaignAccessFields({ access_mode: "private" }), null);
    assert.equal(validateCampaignAccessFields({}), null);
  });

  it("rejects restricted and unknown modes", () => {
    assert.notEqual(validateCampaignAccessFields({ access_mode: "restricted" }), null);
    assert.notEqual(validateCampaignAccessFields({ access_mode: "secret" }), null);
  });

  it("requires a boolean skip flag", () => {
    assert.notEqual(
      validateCampaignAccessFields({ access_list_skips_requirements: "yes" }),
      null,
    );
    assert.equal(
      validateCampaignAccessFields({ access_list_skips_requirements: true }),
      null,
    );
  });
});

describe("access mode helpers", () => {
  it("treats private and restricted as private-like", () => {
    assert.equal(isPrivateLikeAccessMode("private"), true);
    assert.equal(isPrivateLikeAccessMode("restricted"), true);
    assert.equal(isPrivateLikeAccessMode("public"), false);
    assert.equal(isPrivateLikeAccessMode(undefined), false);
  });

  it("detects the submission trigger's access error", () => {
    assert.equal(
      isCampaignAccessDeniedError(
        "campaign_access_denied: Creator is not on this private campaign's access list",
      ),
      true,
    );
    assert.equal(isCampaignAccessDeniedError("trust_score_too_low: x"), false);
    assert.equal(isCampaignAccessDeniedError(null), false);
  });
});
