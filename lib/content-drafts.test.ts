import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_DRAFT_FILE_BYTES,
  buildSubmissionDraftMap,
  postedAfterApprovalLabel,
  type DraftListRow,
  draftBlockMessage,
  draftNotificationHref,
  draftPosterPath,
  draftRecordFromCounts,
  draftReviewResultMessage,
  draftSendResultMessage,
  draftSubmissionErrorMessage,
  draftTrustScore,
  draftVideoContentType,
  draftVideoExtension,
  draftVideoPath,
  formatBytes,
  formatDraftRecord,
  formatDuration,
  isContentDraftNotificationType,
  normalizeDraftReviewSettings,
  parseCampaignDraftFilter,
  parseHashtags,
  parseMyDraftFilter,
  pickDraftReviewSettings,
  titleFromFileName,
  validateDraftFields,
  validateDraftFile,
  waitingLabel,
} from "./content-drafts";

describe("parseHashtags", () => {
  it("strips #, splits on spaces and commas, de-duplicates case-insensitively", () => {
    assert.deepEqual(parseHashtags("#Summer, fun  #summer ##GoC,,"), ["Summer", "fun", "GoC"]);
  });
  it("drops tags with spaces or inner # and over-long tags", () => {
    assert.deepEqual(parseHashtags(["a#b", "ok", "x".repeat(101), " "]), ["ok"]);
  });
  it("keeps order of first appearance", () => {
    assert.deepEqual(parseHashtags("b a B c A"), ["b", "a", "c"]);
  });
});

describe("draft files", () => {
  it("maps accepted types and falls back to the file name when the type is empty", () => {
    assert.equal(draftVideoExtension({ type: "video/quicktime", name: "x.mov" }), "mov");
    assert.equal(draftVideoExtension({ type: "", name: "clip.WEBM" }), "webm");
    assert.equal(draftVideoExtension({ type: "", name: "clip.m4v" }), "mp4");
    assert.equal(draftVideoExtension({ type: "video/x-msvideo", name: "a.avi" }), null);
    assert.equal(draftVideoExtension({ type: "image/png", name: "a.mp4" }), null);
    assert.equal(draftVideoContentType("mov"), "video/quicktime");
  });

  it("validates type, size and duration", () => {
    assert.equal(validateDraftFile({ type: "video/mp4", name: "a.mp4", size: 1000 }, 30), null);
    assert.match(validateDraftFile({ type: "image/png", name: "a.png", size: 10 }) ?? "", /MP4, MOV or WebM/);
    assert.match(validateDraftFile({ type: "video/mp4", name: "a.mp4", size: 0 }) ?? "", /empty/);
    assert.match(
      validateDraftFile({ type: "video/mp4", name: "a.mp4", size: MAX_DRAFT_FILE_BYTES + 1 }) ?? "",
      /limit is 100 MB/,
    );
    assert.match(validateDraftFile({ type: "video/mp4", name: "a.mp4", size: 10 }, 200) ?? "", /3:20 long/);
    // One second of rounding allowed, as in the database.
    assert.equal(validateDraftFile({ type: "video/mp4", name: "a.mp4", size: 10 }, 180.9), null);
  });

  it("builds the storage paths the database expects", () => {
    assert.equal(draftVideoPath("u", "d", "v", "mp4"), "u/d/v.mp4");
    assert.equal(draftPosterPath("u", "d", "v"), "u/d/v-poster.jpg");
  });

  it("suggests a title from the file name", () => {
    assert.equal(titleFromFileName("my_video-final.v2.mp4"), "my video final v2");
  });
});

describe("validateDraftFields", () => {
  it("requires a title and caps lengths", () => {
    assert.deepEqual(validateDraftFields({ title: "  " }), { title: "Add a title." });
    const errors = validateDraftFields({
      title: "t".repeat(201),
      caption: "c".repeat(2201),
      hashtags: Array.from({ length: 31 }, (_, i) => `t${i}`),
      note: "n".repeat(1001),
    });
    assert.deepEqual(Object.keys(errors).sort(), ["caption", "hashtags", "note", "title"]);
    assert.deepEqual(validateDraftFields({ title: "Fine", caption: "ok", hashtags: ["a"] }), {});
  });
});

describe("display helpers", () => {
  it("formats sizes and durations", () => {
    assert.equal(formatBytes(250 * 1024 * 1024), "250 MB");
    assert.equal(formatBytes(1.5 * 1024 * 1024), "1.5 MB");
    assert.equal(formatBytes(2048), "2 KB");
    assert.equal(formatDuration(75), "1:15");
    assert.equal(formatDuration("180"), "3:00");
    assert.equal(formatDuration(null), "");
  });

  it("computes draft trust like the database", () => {
    assert.equal(draftTrustScore(0, 0), 100);
    assert.equal(draftTrustScore(0, 2), 0);
    assert.equal(draftTrustScore(14, 2), 86);
    assert.equal(draftTrustScore(1, 2), 0);
    assert.equal(draftTrustScore(3, 0), 100);
  });

  it("builds a creator's own record from their draft counts", () => {
    assert.deepEqual(draftRecordFromCounts({ approved: 4, posted: 10, rejected: 2, pending_review: 3 }), {
      approved: 14,
      rejected: 2,
      trust: 86,
    });
    assert.deepEqual(draftRecordFromCounts({}), { approved: 0, rejected: 0, trust: 100 });
  });

  it("summarises a draft record", () => {
    assert.equal(
      formatDraftRecord({ approved: 14, rejected: 2, revisions: 1, withdrawn: 0, draft_trust: 86 }),
      "14 approved · 2 rejected · 1 revision",
    );
    assert.equal(formatDraftRecord(null), "No drafts yet");
  });

  it("labels waiting time", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    assert.equal(waitingLabel("2026-10-15T11:30:00Z", now), "30 min");
    assert.equal(waitingLabel("2026-10-15T09:00:00Z", now), "3 h");
    assert.equal(waitingLabel("2026-10-12T12:00:00Z", now), "3 d");
    assert.equal(waitingLabel(null, now), "");
  });

  it("parses filters with safe defaults", () => {
    assert.equal(parseMyDraftFilter("posted"), "posted");
    assert.equal(parseMyDraftFilter("nope"), "all");
    assert.equal(parseCampaignDraftFilter("rejected"), "rejected");
    assert.equal(parseCampaignDraftFilter(undefined), "pending_review");
  });
});

describe("result messages", () => {
  it("explains blocked campaigns with the limits", () => {
    assert.equal(draftBlockMessage(null), null);
    assert.match(draftBlockMessage("open_limit_reached", { max_open: 20, max_rejections: null }) ?? "", /20 drafts/);
    assert.match(draftBlockMessage("rejection_limit_reached", { max_open: 20, max_rejections: 3 }) ?? "", /^3 of your drafts/);
    assert.match(draftBlockMessage("ended") ?? "", /ended/);
  });

  it("explains send results, including limit details", () => {
    assert.equal(draftSendResultMessage("submitted"), "Sent for review.");
    assert.match(draftSendResultMessage("open_limit_reached", "5"), /5 drafts/);
    assert.match(draftSendResultMessage("invalid_file", "size"), /100 MB/);
    assert.match(draftSendResultMessage("invalid_state", "pending_review"), /already in review/);
    assert.match(draftSendResultMessage("no_access"), /access/);
  });

  it("explains review results", () => {
    assert.match(draftReviewResultMessage("stale"), /changed/);
    assert.match(draftReviewResultMessage("revision_limit_reached"), /revision rounds/);
  });

  it("maps submission gate errors and ignores others", () => {
    assert.match(
      draftSubmissionErrorMessage("draft_required: This campaign reviews videos…") ?? "",
      /approved draft first/,
    );
    assert.match(draftSubmissionErrorMessage("draft_posted_before_approval: x") ?? "", /went live before/);
    assert.equal(draftSubmissionErrorMessage("trust_score_too_low: x"), null);
    assert.equal(draftSubmissionErrorMessage(undefined), null);
  });
});

describe("normalizeDraftReviewSettings", () => {
  it("uses defaults for missing limits and clamps ranges", () => {
    assert.deepEqual(normalizeDraftReviewSettings({ review_before_posting: true }), {
      review_before_posting: true,
      draft_max_open: 20,
      draft_max_revisions: 5,
      draft_max_rejections: null,
    });
    assert.deepEqual(
      normalizeDraftReviewSettings({
        review_before_posting: "yes",
        draft_max_open: 0,
        draft_max_revisions: 99,
        draft_max_rejections: "3",
      }),
      {
        review_before_posting: false,
        draft_max_open: 1,
        draft_max_revisions: 50,
        draft_max_rejections: 3,
      },
    );
    assert.equal(normalizeDraftReviewSettings({ draft_max_open: null }).draft_max_open, null);
    assert.equal(normalizeDraftReviewSettings({ draft_max_rejections: "" }).draft_max_rejections, null);
  });
});

describe("pickDraftReviewSettings", () => {
  it("keeps only the keys that were sent, normalised", () => {
    assert.deepEqual(pickDraftReviewSettings({ title: "x" }), {});
    assert.deepEqual(pickDraftReviewSettings(null), {});
    assert.deepEqual(
      pickDraftReviewSettings({ review_before_posting: false, draft_max_open: 900, draft_max_rejections: null }),
      { review_before_posting: false, draft_max_open: 500, draft_max_rejections: null },
    );
    assert.deepEqual(pickDraftReviewSettings({ review_before_posting: 1, draft_max_revisions: "0" }), {
      review_before_posting: false,
      draft_max_revisions: 0,
    });
  });
});

describe("draft notifications", () => {
  it("recognises the draft types", () => {
    assert.equal(isContentDraftNotificationType("content_draft_comment"), true);
    assert.equal(isContentDraftNotificationType("campaign_access_granted"), false);
  });
  it("links brands and admins to the Drafts tab and creators to their drafts", () => {
    assert.equal(draftNotificationHref("c1", "advertiser", "/dashboard/contests/c1"), "/dashboard/contests/c1?tab=drafts");
    assert.equal(
      draftNotificationHref("c1", "admin", "/dashboard/admin/contests/c1"),
      "/dashboard/admin/contests/c1?tab=drafts",
    );
    assert.equal(
      draftNotificationHref("c1", "creator", "/dashboard/opportunities/c1"),
      "/dashboard/submissions?view=drafts&campaign=c1",
    );
  });
});

describe("submission draft links", () => {
  const row = {
    id: "d1",
    approved_version_id: "v2",
    approved_at: "2026-10-29T10:00:00Z",
    revision_count: 1,
    files_purged: false,
    current_version: { id: "v2", version_no: 2, title: "Pool demo", caption: "Hi", hashtags: ["#a"], duration_sec: "20.5" },
    posts: [
      { id: "s1", platform: "youtube", created_at: "2026-10-29T12:00:00Z" },
      { id: "s2", platform: "instagram", created_at: "2026-10-29T12:30:00Z" },
    ],
  } as unknown as DraftListRow;

  it("links every post of a draft to the approved version", () => {
    const map = buildSubmissionDraftMap([row, { ...row, id: "d2", posts: [] } as DraftListRow]);
    assert.equal(map.size, 2);
    const s1 = map.get("s1");
    assert.equal(s1?.draftId, "d1");
    assert.equal(s1?.versionId, "v2");
    assert.equal(s1?.versionNo, 2);
    assert.equal(s1?.durationSec, 20.5);
    assert.equal(s1?.submittedAt, "2026-10-29T12:00:00Z");
    assert.equal(map.get("s2")?.submittedAt, "2026-10-29T12:30:00Z");
  });

  it("skips drafts without a version", () => {
    const map = buildSubmissionDraftMap([{ ...row, approved_version_id: null, current_version: null } as DraftListRow]);
    assert.equal(map.size, 0);
  });

  it("describes the gap between approval and posting", () => {
    const a = "2026-10-29T10:00:00Z";
    assert.equal(postedAfterApprovalLabel(a, "2026-10-29T10:00:30Z"), "right after approval");
    assert.equal(postedAfterApprovalLabel(a, "2026-10-29T10:45:00Z"), "45 min after approval");
    assert.equal(postedAfterApprovalLabel(a, "2026-10-29T13:00:00Z"), "3 h after approval");
    assert.equal(postedAfterApprovalLabel(a, "2026-11-02T10:00:00Z"), "4 days after approval");
    assert.equal(postedAfterApprovalLabel(null, a), null);
  });
});
