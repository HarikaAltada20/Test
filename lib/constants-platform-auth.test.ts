import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlatformAllowAnyAuthenticated } from "./constants";

describe("isPlatformAllowAnyAuthenticated", () => {
  it("allows single video platforms", () => {
    assert.equal(isPlatformAllowAnyAuthenticated("instagram"), true);
    assert.equal(isPlatformAllowAnyAuthenticated("YouTube"), true);
    assert.equal(isPlatformAllowAnyAuthenticated("tiktok"), true);
  });

  it("allows multi-platform CSV contests", () => {
    assert.equal(
      isPlatformAllowAnyAuthenticated("instagram,youtube,tiktok"),
      true,
    );
    assert.equal(
      isPlatformAllowAnyAuthenticated("youtube, instagram"),
      true,
    );
  });

  it("does not allow Twitter-only contests", () => {
    assert.equal(isPlatformAllowAnyAuthenticated("twitter"), false);
    assert.equal(isPlatformAllowAnyAuthenticated("x"), false);
  });

  it("handles empty values", () => {
    assert.equal(isPlatformAllowAnyAuthenticated(null), false);
    assert.equal(isPlatformAllowAnyAuthenticated(""), false);
  });
});
