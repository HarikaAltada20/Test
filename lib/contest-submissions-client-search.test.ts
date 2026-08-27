import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterSubmissionsByClientSearch,
  submissionMatchesClientSearch,
} from "./contest-submissions-client-search";

describe("submissionMatchesClientSearch", () => {
  const row = {
    id: "sub-1",
    creator_id: "c-9",
    creator_display_name: "Alice Creator",
    creator_username: "alice_yt",
    content_link: "https://youtube.com/watch?v=abc",
    platform: "youtube",
    video_title: "Launch reel",
  };

  it("matches empty query", () => {
    assert.equal(submissionMatchesClientSearch(row, ""), true);
    assert.equal(submissionMatchesClientSearch(row, "   "), true);
  });

  it("matches creator name case-insensitively", () => {
    assert.equal(submissionMatchesClientSearch(row, "alice"), true);
    assert.equal(submissionMatchesClientSearch(row, "CREATOR"), true);
  });

  it("matches url and platform", () => {
    assert.equal(submissionMatchesClientSearch(row, "watch?v=abc"), true);
    assert.equal(submissionMatchesClientSearch(row, "youtube"), true);
  });

  it("rejects non-matches", () => {
    assert.equal(submissionMatchesClientSearch(row, "bob"), false);
  });
});

describe("filterSubmissionsByClientSearch", () => {
  it("filters a list", () => {
    const rows = [
      { id: "1", creator_display_name: "Alice" },
      { id: "2", creator_display_name: "Bob" },
    ];
    assert.deepEqual(filterSubmissionsByClientSearch(rows, "ali"), [rows[0]]);
    assert.equal(filterSubmissionsByClientSearch(rows, "").length, 2);
  });
});
