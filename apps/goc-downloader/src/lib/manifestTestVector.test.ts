import { describe, expect, it } from "vitest";
import { MANIFEST_TEST_VECTOR_UNSIGNED } from "./manifestTestVector";

describe("manifest test vector", () => {
  it("documents the fixed cross-language payload", () => {
    expect(MANIFEST_TEST_VECTOR_UNSIGNED.version).toBe(1);
    expect(MANIFEST_TEST_VECTOR_UNSIGNED.context.jobId).toContain("11111111");
    expect(MANIFEST_TEST_VECTOR_UNSIGNED.items[0].url).toContain("youtube.com");
    expect(MANIFEST_TEST_VECTOR_UNSIGNED.items[0].filename).toBe(
      "000000012345_creator.mp4",
    );
  });
});
