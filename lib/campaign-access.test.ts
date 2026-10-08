import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isCampaignAccessDeniedError,
  isPrivateLikeAccessMode,
  normalizeAllowlistName,
  parseUsernames,
  validateCampaignAccessFields,
} from "./campaign-access";

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
