import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractBearerToken,
  issueDesktopStatusToken,
  verifyDesktopStatusToken,
} from "./status-token";

describe("goc-download status-token", () => {
  it("issues and verifies a scoped HMAC token", () => {
    process.env.GOC_DOWNLOAD_STATUS_HMAC_SECRET =
      "test-status-hmac-secret-at-least-32-chars!!";
    const token = issueDesktopStatusToken({
      jobId: "11111111-1111-4111-8111-111111111111",
      userId: "33333333-3333-4333-8333-333333333333",
      ttlSeconds: 3600,
    });
    const ok = verifyDesktopStatusToken(token, {
      expectedJobId: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.claims.userId, "33333333-3333-4333-8333-333333333333");
      assert.equal(ok.claims.purpose, "goc-desktop-status");
    }
  });

  it("rejects forgery and job mismatch", () => {
    process.env.GOC_DOWNLOAD_STATUS_HMAC_SECRET =
      "test-status-hmac-secret-at-least-32-chars!!";
    const token = issueDesktopStatusToken({
      jobId: "11111111-1111-4111-8111-111111111111",
      userId: "33333333-3333-4333-8333-333333333333",
    });
    assert.equal(
      verifyDesktopStatusToken(`${token}x`, {
        expectedJobId: "11111111-1111-4111-8111-111111111111",
      }).ok,
      false,
    );
    assert.equal(
      verifyDesktopStatusToken(token, {
        expectedJobId: "99999999-9999-4999-8999-999999999999",
      }).ok,
      false,
    );
  });

  it("rejects expired tokens outside clock skew", () => {
    process.env.GOC_DOWNLOAD_STATUS_HMAC_SECRET =
      "test-status-hmac-secret-at-least-32-chars!!";
    const issuedAt = 1_700_000_000_000;
    // Patch Date.now during issue so exp is deterministic.
    const realNow = Date.now;
    Date.now = () => issuedAt;
    let token: string;
    try {
      token = issueDesktopStatusToken({
        jobId: "11111111-1111-4111-8111-111111111111",
        userId: "33333333-3333-4333-8333-333333333333",
        ttlMs: 1_000,
      });
    } finally {
      Date.now = realNow;
    }
    // Clock skew is 2 minutes; jump well past exp + skew.
    const expired = verifyDesktopStatusToken(token, {
      expectedJobId: "11111111-1111-4111-8111-111111111111",
      nowMs: issuedAt + 5 * 60_000,
    });
    assert.equal(expired.ok, false);
    if (!expired.ok) {
      assert.match(expired.reason, /expired/i);
    }
  });

  it("parses Bearer authorization headers", () => {
    assert.equal(extractBearerToken("Bearer abc.def"), "abc.def");
    assert.equal(extractBearerToken("bearer xyz"), "xyz");
    assert.equal(extractBearerToken("Basic nope"), null);
    assert.equal(extractBearerToken(null), null);
  });
});
