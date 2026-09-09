import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSafeWindowsFilename,
  isSafeDownloadFilename,
} from "@/lib/goc-download/path-safety";

describe("goc-download path-safety", () => {
  it("accepts normal mp4 and zip names", () => {
    assert.equal(isSafeDownloadFilename("000000012345_creator.mp4"), true);
    assert.equal(assertSafeWindowsFilename("contest_part_1_of_2.zip").ok, true);
  });

  it("rejects traversal, separators, ADS, and absolute paths", () => {
    assert.equal(assertSafeWindowsFilename("../x.mp4").ok, false);
    assert.equal(assertSafeWindowsFilename("a/b.mp4").ok, false);
    assert.equal(assertSafeWindowsFilename("a\\b.mp4").ok, false);
    assert.equal(assertSafeWindowsFilename("file:stream.mp4").ok, false);
    assert.equal(assertSafeWindowsFilename("C:\\Windows\\a.mp4").ok, false);
  });

  it("rejects reserved device names and trailing dot/space", () => {
    assert.equal(assertSafeWindowsFilename("CON.mp4").ok, false);
    assert.equal(assertSafeWindowsFilename("nul.txt").ok, false);
    assert.equal(assertSafeWindowsFilename("video.mp4.").ok, false);
    assert.equal(assertSafeWindowsFilename("video.mp4 ").ok, false);
  });
});
