import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildYouTubeContentViewUrl,
  formatClipDurationSeconds,
  isYouTubeRefreshTarget,
  parseYouTubeIso8601Duration,
} from "./youtube-url";

describe("parseYouTubeIso8601Duration", () => {
  it("parses minutes and seconds", () => {
    assert.equal(parseYouTubeIso8601Duration("PT1M30S"), 90);
    assert.equal(parseYouTubeIso8601Duration("PT45S"), 45);
    assert.equal(parseYouTubeIso8601Duration("PT2M"), 120);
  });

  it("parses hours", () => {
    assert.equal(parseYouTubeIso8601Duration("PT1H2M3S"), 3723);
  });
});

describe("buildYouTubeContentViewUrl", () => {
  const watch = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const shorts = "https://www.youtube.com/shorts/dQw4w9WgXcQ";

  it("uses shorts when duration under 3 minutes", () => {
    assert.equal(
      buildYouTubeContentViewUrl(watch, 119),
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    );
  });

  it("uses watch when duration is 3 minutes or more", () => {
    assert.equal(
      buildYouTubeContentViewUrl(shorts, 180),
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  it("keeps original link when duration unknown", () => {
    assert.equal(buildYouTubeContentViewUrl(watch, null), watch);
    assert.equal(buildYouTubeContentViewUrl(shorts, undefined), shorts);
  });
});

describe("isYouTubeRefreshTarget", () => {
  it("matches youtube platform even without a parseable URL", () => {
    assert.equal(
      isYouTubeRefreshTarget("youtube", "https://example.com/video"),
      true,
    );
  });

  it("matches a YouTube URL when platform is missing", () => {
    assert.equal(
      isYouTubeRefreshTarget(
        null,
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      ),
      true,
    );
    assert.equal(
      isYouTubeRefreshTarget("YouTube Shorts", "https://youtu.be/dQw4w9WgXcQ"),
      true,
    );
  });

  it("rejects non-YouTube rows", () => {
    assert.equal(isYouTubeRefreshTarget(null, "https://instagram.com/reel/x"), false);
    assert.equal(isYouTubeRefreshTarget("instagram", "https://instagram.com/reel/x"), false);
    assert.equal(isYouTubeRefreshTarget("youtube", ""), false);
  });
});

describe("formatClipDurationSeconds", () => {
  it("formats readable durations", () => {
    assert.equal(formatClipDurationSeconds(45), "45s");
    assert.equal(formatClipDurationSeconds(90), "1m 30s");
    assert.equal(formatClipDurationSeconds(null), "—");
  });
});
