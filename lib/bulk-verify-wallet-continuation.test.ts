import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  issueBulkVerifyWalletContinuation,
  verifyBulkVerifyWalletContinuation,
} from "./bulk-verify-wallet-continuation";

describe("bulk verify wallet continuation token", () => {
  const prevCronSecret = process.env.CRON_SECRET;

  function withTestSecret(run: () => void) {
    process.env.CRON_SECRET = "test-cron-secret-for-wallet-continuation";
    try {
      run();
    } finally {
      if (prevCronSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = prevCronSecret;
      }
    }
  }

  it("issues a token that authorizes later chunks for the same actor/action", () => {
    withTestSecret(() => {
      const token = issueBulkVerifyWalletContinuation({
        actorId: "admin-1",
        action: "pending",
        reversalIds: ["s1", "s2", "s3"],
        skipWalletDebitIds: ["s1", "s2"],
      });

      const ok = verifyBulkVerifyWalletContinuation({
        token,
        actorId: "admin-1",
        action: "pending",
        chunkSubmissionIds: ["s3"],
      });
      assert.equal(ok.ok, true);
      if (ok.ok) {
        assert.equal(ok.skipWalletDebitIds.has("s1"), true);
        assert.equal(ok.skipWalletDebitIds.has("s2"), true);
      }
    });
  });

  it("rejects forged tokens, actor mismatch, and IDs outside preflight", () => {
    withTestSecret(() => {
      const token = issueBulkVerifyWalletContinuation({
        actorId: "admin-1",
        action: "rejected",
        reversalIds: ["s1", "s2"],
        skipWalletDebitIds: ["s1"],
      });

      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token: token.slice(0, -4) + "xxxx",
          actorId: "admin-1",
          action: "rejected",
          chunkSubmissionIds: ["s2"],
        }).ok,
        false,
      );

      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token,
          actorId: "other-admin",
          action: "rejected",
          chunkSubmissionIds: ["s2"],
        }).ok,
        false,
      );

      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token,
          actorId: "admin-1",
          action: "pending",
          chunkSubmissionIds: ["s2"],
        }).ok,
        false,
      );

      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token,
          actorId: "admin-1",
          action: "rejected",
          chunkSubmissionIds: ["s99"],
        }).ok,
        false,
      );

      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token: true,
          actorId: "admin-1",
          action: "rejected",
          chunkSubmissionIds: ["s1"],
        }).ok,
        false,
      );
    });
  });
});
