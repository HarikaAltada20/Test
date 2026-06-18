import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveSafeRedirectUrl } from "./safe-redirect-url";

describe("resolveSafeRedirectUrl", () => {
  const fallback = "https://app.example.com";

  it("allows https URLs", () => {
    assert.equal(
      resolveSafeRedirectUrl("https://example.com/path?q=1", fallback),
      "https://example.com/path?q=1",
    );
  });

  it("allows http URLs", () => {
    assert.equal(
      resolveSafeRedirectUrl("http://example.com", fallback),
      "http://example.com/",
    );
  });

  it("rejects javascript URLs", () => {
    assert.equal(
      resolveSafeRedirectUrl("javascript:alert(1)", fallback),
      fallback,
    );
  });

  it("rejects malformed URLs", () => {
    assert.equal(resolveSafeRedirectUrl("not-a-url", fallback), fallback);
  });

  it("returns fallback for empty input", () => {
    assert.equal(resolveSafeRedirectUrl("", fallback), fallback);
  });
});
