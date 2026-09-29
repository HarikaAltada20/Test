import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildZipFile,
  extractStoredZipEntries,
  mergeVideoDownloadZips,
  FAILED_DOWNLOADS_REPORT_NAME,
} from "./video-download-zip";

describe("video download zip merge", () => {
  it("extracts stored zip entries and merges two waves into one archive", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "zip-merge-"));
    try {
      const firstFile = join(tempDir, "a.mp4");
      const secondFile = join(tempDir, "b.mp4");
      await writeFile(firstFile, "video-a");
      await writeFile(secondFile, "video-b");

      const firstZip = join(tempDir, "first.zip");
      const secondZip = join(tempDir, "second.zip");
      await buildZipFile(firstZip, [{ path: firstFile, name: "a.mp4" }], "1. URL: a\n   Error: skip");
      await buildZipFile(secondZip, [{ path: secondFile, name: "b.mp4" }], null);

      const mergedZip = join(tempDir, "merged.zip");
      await mergeVideoDownloadZips({
        existingZipPath: firstZip,
        newZipPath: secondZip,
        outputZipPath: mergedZip,
        tempDir,
      });

      const entries = extractStoredZipEntries(await readFile(mergedZip));
      const names = entries.map((entry) => entry.name).sort();
      assert.deepEqual(names, ["a.mp4", "b.mp4", FAILED_DOWNLOADS_REPORT_NAME].sort());
      assert.equal(
        entries.find((entry) => entry.name === "a.mp4")?.data.toString(),
        "video-a",
      );
      assert.equal(
        entries.find((entry) => entry.name === "b.mp4")?.data.toString(),
        "video-b",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
