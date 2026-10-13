import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  APPLICATION_RESULT_HTTP_STATUS,
  APPLICATION_RESULT_MESSAGES,
  applicationQuestionsToSave,
  clampPage,
  isApplicationResult,
  isUuid,
  validateApplicationAnswer,
  validateApplicationAnswers,
  validateApplicationQuestions,
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
  it("allows public, private and restricted", () => {
    assert.equal(validateCampaignAccessFields({ access_mode: "public" }), null);
    assert.equal(validateCampaignAccessFields({ access_mode: "private" }), null);
    assert.equal(validateCampaignAccessFields({ access_mode: "restricted" }), null);
    assert.equal(validateCampaignAccessFields({}), null);
  });

  it("rejects unknown modes", () => {
    assert.notEqual(validateCampaignAccessFields({ access_mode: "secret" }), null);
  });

  it("checks preview fields", () => {
    assert.equal(validateCampaignAccessFields({ preview_description: "Hi" }), null);
    assert.equal(validateCampaignAccessFields({ preview_description: null }), null);
    assert.notEqual(validateCampaignAccessFields({ preview_description: 3 }), null);
    assert.notEqual(
      validateCampaignAccessFields({ preview_description: "x".repeat(2001) }),
      null,
    );
    assert.equal(validateCampaignAccessFields({ applications_open: false }), null);
    assert.notEqual(validateCampaignAccessFields({ applications_open: "no" }), null);
    assert.equal(validateCampaignAccessFields({ list_only_to_eligible: true }), null);
    assert.notEqual(validateCampaignAccessFields({ list_only_to_eligible: 1 }), null);
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

describe("validateApplicationQuestions", () => {
  const ID = "6f1c2b9e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";

  it("normalises prompts, options and positions", () => {
    const res = validateApplicationQuestions([
      { prompt: "  Why   you? ", kind: "long_text" },
      { id: ID, prompt: "Tier", kind: "single_choice", options: [" A ", "B", ""], required: false },
    ]);
    assert.ok("questions" in res);
    assert.deepEqual(res.questions, [
      { position: 0, prompt: "Why you?", kind: "long_text", options: null, required: true },
      { id: ID, position: 1, prompt: "Tier", kind: "single_choice", options: ["A", "B"], required: false },
    ]);
  });

  it("drops options for non-choice questions", () => {
    const res = validateApplicationQuestions([
      { prompt: "Link", kind: "url", options: ["x", "y"] },
    ]);
    assert.ok("questions" in res);
    assert.equal(res.questions[0].options, null);
  });

  it("rejects bad input", () => {
    assert.ok("error" in validateApplicationQuestions("nope"));
    assert.ok("error" in validateApplicationQuestions([{ prompt: "", kind: "url" }]));
    assert.ok("error" in validateApplicationQuestions([{ prompt: "Q", kind: "essay" }]));
    assert.ok(
      "error" in validateApplicationQuestions([{ prompt: "Q", kind: "single_choice", options: ["A"] }]),
    );
    assert.ok(
      "error" in
        validateApplicationQuestions([{ prompt: "Q", kind: "single_choice", options: ["A", "a"] }]),
    );
    assert.ok("error" in validateApplicationQuestions([{ id: "x", prompt: "Q", kind: "url" }]));
    assert.ok(
      "error" in
        validateApplicationQuestions([
          { id: ID, prompt: "Q", kind: "url" },
          { id: ID, prompt: "R", kind: "url" },
        ]),
    );
    assert.ok(
      "error" in
        validateApplicationQuestions(
          Array.from({ length: 11 }, () => ({ prompt: "Q", kind: "short_text" })),
        ),
    );
    assert.ok("error" in validateApplicationQuestions([{ prompt: "x".repeat(301), kind: "url" }]));
  });
});

describe("validateApplicationAnswer(s)", () => {
  const choice = { kind: "single_choice" as const, options: ["A", "B"], required: true };

  it("enforces required and optional answers", () => {
    assert.notEqual(validateApplicationAnswer({ kind: "short_text", options: null, required: true }, " "), null);
    assert.equal(validateApplicationAnswer({ kind: "short_text", options: null, required: false }, ""), null);
  });

  it("checks each kind", () => {
    const text = { kind: "short_text" as const, options: null, required: true };
    assert.equal(validateApplicationAnswer(text, "x".repeat(300)), null);
    assert.notEqual(validateApplicationAnswer(text, "x".repeat(301)), null);
    const url = { kind: "url" as const, options: null, required: true };
    assert.equal(validateApplicationAnswer(url, "https://example.com/a"), null);
    assert.notEqual(validateApplicationAnswer(url, "example.com"), null);
    assert.notEqual(validateApplicationAnswer(url, "https://a b"), null);
    assert.equal(validateApplicationAnswer(choice, "A"), null);
    assert.notEqual(validateApplicationAnswer(choice, "C"), null);
    const yn = { kind: "yes_no" as const, options: null, required: true };
    assert.equal(validateApplicationAnswer(yn, "no"), null);
    assert.notEqual(validateApplicationAnswer(yn, "maybe"), null);
  });

  it("keys errors by question id", () => {
    const errors = validateApplicationAnswers(
      [
        { id: "q1", prompt: "One", ...choice },
        { id: "q2", prompt: "Two", kind: "long_text", options: null, required: false },
      ],
      { q1: "Z" },
    );
    assert.deepEqual(Object.keys(errors), ["q1"]);
  });
});

describe("application results", () => {
  it("has a message and HTTP status for every code", () => {
    for (const code of Object.keys(APPLICATION_RESULT_MESSAGES)) {
      assert.ok(isApplicationResult(code));
      assert.equal(typeof APPLICATION_RESULT_HTTP_STATUS[code as keyof typeof APPLICATION_RESULT_HTTP_STATUS], "number");
    }
    assert.equal(isApplicationResult("nope"), false);
  });

  it("treats already_approved as a successful no-op", () => {
    assert.ok(isApplicationResult("already_approved"));
    assert.equal(APPLICATION_RESULT_HTTP_STATUS.already_approved, 200);
    assert.equal(APPLICATION_RESULT_MESSAGES.already_approved, "Already approved.");
  });
});

describe("clampPage", () => {
  it("keeps a page that still exists", () => {
    assert.equal(clampPage(2, 51, 50), 2);
    assert.equal(clampPage(1, 50, 50), 1);
  });

  it("moves to the last page when the current one disappears", () => {
    assert.equal(clampPage(2, 50, 50), 1);
    assert.equal(clampPage(5, 120, 50), 3);
  });

  it("goes to page 1 when nothing is left", () => {
    assert.equal(clampPage(3, 0, 50), 1);
  });

  it("treats invalid pages as page 1", () => {
    assert.equal(clampPage(0, 100, 50), 1);
    assert.equal(clampPage(-2, 100, 50), 1);
    assert.equal(clampPage(Number.NaN, 100, 50), 1);
  });
});

describe("applicationQuestionsToSave", () => {
  const valid = [{ prompt: "Why you?", kind: "long_text", required: true }];

  it("skips when the campaign isn't restricted or nothing changed", () => {
    assert.deepEqual(applicationQuestionsToSave("public", true, valid), { skip: true });
    assert.deepEqual(applicationQuestionsToSave("private", true, valid), { skip: true });
    assert.deepEqual(applicationQuestionsToSave("restricted", false, valid), { skip: true });
  });

  it("stops on a multiple-choice question without choices", () => {
    const result = applicationQuestionsToSave("restricted", true, [
      { prompt: "Pick one", kind: "single_choice", options: [], required: true },
    ]);
    assert.ok("error" in result);
    assert.match(result.error, /choices/);
  });

  it("returns normalised questions when valid", () => {
    const result = applicationQuestionsToSave("restricted", true, [
      { prompt: "  Why   you? ", kind: "long_text" },
    ]);
    assert.ok("questions" in result);
    assert.deepEqual(result.questions, [
      { position: 0, prompt: "Why you?", kind: "long_text", options: null, required: true },
    ]);
  });
});

describe("isUuid", () => {
  it("accepts UUIDs in any case", () => {
    assert.equal(isUuid("6f1c2b9e-1d2a-4c3b-9e8f-0a1b2c3d4e5f"), true);
    assert.equal(isUuid("6F1C2B9E-1D2A-4C3B-9E8F-0A1B2C3D4E5F"), true);
  });

  it("rejects anything else", () => {
    assert.equal(isUuid("not-a-uuid"), false);
    assert.equal(isUuid("6f1c2b9e-1d2a-4c3b-9e8f-0a1b2c3d4e5"), false);
    assert.equal(isUuid(" 6f1c2b9e-1d2a-4c3b-9e8f-0a1b2c3d4e5f"), false);
    assert.equal(isUuid(null), false);
    assert.equal(isUuid(42), false);
  });
});
