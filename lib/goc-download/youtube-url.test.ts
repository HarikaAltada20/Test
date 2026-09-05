import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAllowedYoutubeDownloadUrl,
  parseAllowedYoutubeUrl,
} from "@/lib/goc-download/youtube-url";

describe("goc-download youtube-url", () => {
  it("allows exact YouTube hosts", () => {
    assert.equal(
      isAllowedYoutubeDownloadUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      true,
    );
    assert.equal(
      isAllowedYoutubeDownloadUrl("https://youtube.com/shorts/abc12345678"),
      true,
    );
    assert.equal(
      isAllowedYoutubeDownloadUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ"),
      true,
    );
    assert.equal(
      isAllowedYoutubeDownloadUrl("https://youtu.be/dQw4w9WgXcQ"),
      true,
    );
  });

  it("rejects non-allowlisted hosts", () => {
    assert.equal(
      isAllowedYoutubeDownloadUrl("https://music.youtube.com/watch?v=x"),
      false,
    );
    assert.equal(
      isAllowedYoutubeDownloadUrl("https://instagram.com/p/x"),
      false,
    );
    assert.equal(parseAllowedYoutubeUrl("not-a-url").ok, false);
  });
});
