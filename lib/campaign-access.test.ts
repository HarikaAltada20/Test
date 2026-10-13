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
  applicationDisplayStatus,
  creatorInitials,
  formatAddResultSummary,
  applicationAnswerPreview,
  countsAfterReview,
  linkLabel,
  countAnsweredQuestions,
  daysUntil,
  parseApplicationDraft,
  accessMemberFilterKey,
  accessMembersToCsv,
  parseUsernameCsv,
  sortAccessMembers,
  accessModeSwitchNeedsConfirm,
  accessModeSwitchNotes,
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

describe("formatAddResultSummary", () => {
  it("keeps the line short and counts failures instead of listing them", () => {
    assert.equal(
      formatAddResultSummary({ added: 12, alreadyOnList: 2, notFound: ["a", "b", "c"], invalid: ["!x"] }),
      "Added 12 creators · 2 already had access · 3 not found · 1 invalid",
    );
  });

  it("uses the singular and skips empty parts", () => {
    assert.equal(formatAddResultSummary({ added: 1, alreadyOnList: 0, notFound: [] }), "Added 1 creator");
  });

  it("accepts a custom label for creators already present", () => {
    assert.equal(
      formatAddResultSummary({ added: 0, alreadyOnList: 3 }, "already on the list"),
      "Added 0 creators · 3 already on the list",
    );
  });
});

describe("creatorInitials", () => {
  it("uses first and last name initials", () => {
    assert.equal(creatorInitials("Vishesh Kumar Gupta", "vish"), "VG");
  });

  it("uses two letters of a single name", () => {
    assert.equal(creatorInitials("Madonna", null), "MA");
  });

  it("falls back to the username, then a question mark", () => {
    assert.equal(creatorInitials(null, "@creator_one"), "CR");
    assert.equal(creatorInitials("  ", ""), "?");
  });
});

describe("applicationDisplayStatus", () => {
  it("marks approved creators who left the access list as access removed", () => {
    assert.equal(applicationDisplayStatus({ status: "approved", on_access_list: false }), "access_removed");
  });

  it("keeps other statuses as they are", () => {
    assert.equal(applicationDisplayStatus({ status: "approved", on_access_list: true }), "approved");
    assert.equal(applicationDisplayStatus({ status: "approved" }), "approved");
    assert.equal(applicationDisplayStatus({ status: "rejected", on_access_list: false }), "rejected");
  });
});

describe("applicationAnswerPreview", () => {
  const answer = (kind: "short_text" | "url" | "yes_no", value: string, prompt = "Q") => ({
    question_id: prompt,
    prompt,
    kind,
    answer: value,
  });

  it("uses the first non-empty answer", () => {
    assert.deepEqual(
      applicationAnswerPreview([answer("short_text", "  ", "Empty"), answer("short_text", " Hi ", "Name")]),
      { prompt: "Name", text: "Hi", isLink: false },
    );
  });

  it("marks links and spells out yes/no", () => {
    assert.equal(applicationAnswerPreview([answer("url", "https://x.com/a")])?.isLink, true);
    assert.equal(applicationAnswerPreview([answer("yes_no", "no")])?.text, "No");
  });

  it("returns null when nothing was answered", () => {
    assert.equal(applicationAnswerPreview([]), null);
  });
});

describe("linkLabel", () => {
  it("shows the host without www", () => {
    assert.equal(linkLabel("https://www.instagram.com/someone"), "instagram.com");
  });

  it("falls back to the text when it isn't a URL", () => {
    assert.equal(linkLabel("not a url"), "not a url");
  });
});

describe("countsAfterReview", () => {
  const counts = { pending: 5, approved: 2, rejected: 1, withdrawn: 0 };

  it("moves approved and rejected applications between statuses", () => {
    assert.deepEqual(countsAfterReview(counts, [{ status: "pending" }, { status: "rejected" }], "approve"), {
      pending: 4,
      approved: 4,
      rejected: 0,
      withdrawn: 0,
    });
    assert.deepEqual(countsAfterReview(counts, [{ status: "pending" }], "reject"), {
      pending: 4,
      approved: 2,
      rejected: 2,
      withdrawn: 0,
    });
  });

  it("leaves counts alone when re-approving", () => {
    assert.deepEqual(countsAfterReview(counts, [{ status: "approved" }], "approve"), counts);
  });
});

describe("daysUntil", () => {
  it("rounds up partial days", () => {
    assert.equal(daysUntil("2026-10-13T11:00:00.000Z", NOW), 2);
  });

  it("returns null for past, missing or invalid dates", () => {
    assert.equal(daysUntil("2026-10-10T00:00:00.000Z", NOW), null);
    assert.equal(daysUntil(null, NOW), null);
    assert.equal(daysUntil("nope", NOW), null);
  });
});

describe("countAnsweredQuestions", () => {
  it("ignores blank answers", () => {
    assert.equal(countAnsweredQuestions([{ id: "a" }, { id: "b" }, { id: "c" }], { a: "x", b: "  " }), 1);
  });
});

describe("parseApplicationDraft", () => {
  const questions = [{ id: "a" }, { id: "b" }];

  it("keeps string answers to current questions", () => {
    assert.deepEqual(parseApplicationDraft(JSON.stringify({ a: "hi", b: 3, gone: "x" }), questions), { a: "hi" });
  });

  it("returns an empty draft for missing or broken data", () => {
    assert.deepEqual(parseApplicationDraft(null, questions), {});
    assert.deepEqual(parseApplicationDraft("{oops", questions), {});
    assert.deepEqual(parseApplicationDraft("[1]", questions), {});
  });
});

describe("parseUsernameCsv", () => {
  it("takes the first cell of each row and skips a header", () => {
    const csv = ["username,followers", "@alice,100", '"bob",5', "", "carol"].join("\r\n");
    assert.deepEqual(parseUsernameCsv(csv), ["@alice", "bob", "carol"]);
  });

  it("keeps a first row that isn't a header", () => {
    assert.deepEqual(parseUsernameCsv(["dave", "erin"].join("\n")), ["dave", "erin"]);
  });
});

describe("access list helpers", () => {
  const member = (over: Record<string, unknown>) => ({
    user_id: "u",
    username: "a",
    full_name: null,
    profile_picture_url: null,
    added_at: "2026-10-01T00:00:00.000Z",
    source: "manual" as const,
    source_allowlist_id: null,
    source_allowlist_name: null,
    source_invite_link_id: null,
    source_invite_link_label: null,
    ...over,
  });

  it("filters by specific list or link, else by source", () => {
    assert.equal(accessMemberFilterKey(member({ source: "saved_list", source_allowlist_id: "L1" })), "list:L1");
    assert.equal(accessMemberFilterKey(member({ source: "invite_link", source_invite_link_id: "I1" })), "invite:I1");
    assert.equal(accessMemberFilterKey(member({ source: "application" })), "application");
  });

  it("sorts by creator name and by date", () => {
    const list = [member({ username: "b", added_at: "2026-10-02" }), member({ username: "A", added_at: "2026-10-03" })];
    assert.deepEqual(sortAccessMembers(list, "creator", "asc").map((m) => m.username), ["A", "b"]);
    assert.deepEqual(sortAccessMembers(list, "added", "desc").map((m) => m.username), ["A", "b"]);
  });

  it("escapes CSV cells", () => {
    assert.equal(
      accessMembersToCsv([member({ username: "x", full_name: 'Ann "Q", Jr' })]),
      [
        "username,full_name,source,added_at",
        'x,"Ann ""Q"", Jr",Added manually,2026-10-01T00:00:00.000Z',
      ].join("\n"),
    );
  });
});

describe("accessModeSwitchNotes", () => {
  it("mentions submitters only when leaving Public with submissions", () => {
    assert.equal(accessModeSwitchNotes("public", "private", 3).some((n) => n.includes("3 submissions")), true);
    assert.equal(accessModeSwitchNotes("public", "private", 0).some((n) => n.includes("submission")), false);
  });

  it("warns that invite links are revoked when going Public", () => {
    assert.equal(accessModeSwitchNotes("private", "public", null).some((n) => n.includes("invite links")), true);
  });

  it("explains pending applications when leaving Restricted", () => {
    assert.equal(accessModeSwitchNotes("restricted", "private", null).some((n) => n.includes("Pending")), true);
  });

  it("asks for confirmation only when something more than the new mode changes", () => {
    assert.equal(accessModeSwitchNeedsConfirm("public", "restricted", 0), false);
    assert.equal(accessModeSwitchNeedsConfirm("public", "restricted", 2), true);
    assert.equal(accessModeSwitchNeedsConfirm("private", "restricted", null), false);
    assert.equal(accessModeSwitchNeedsConfirm("restricted", "public", null), true);
    assert.equal(accessModeSwitchNeedsConfirm("public", "public", 5), false);
  });
});
