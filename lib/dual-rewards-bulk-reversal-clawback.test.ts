import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bulkReversalSrc = readFileSync(
  fileURLToPath(new URL("./dual-rewards-bulk-reversal.ts", import.meta.url)),
  "utf8",
);

describe("applyBulkDualRewardsWalletReversals clawback behavior", () => {
  it("debits full reversal via debitCreatorReversalClawback", () => {
    assert.match(bulkReversalSrc, /debitCreatorReversalClawback/);
    assert.doesNotMatch(bulkReversalSrc, /scaleDualReversalDuesToTotalCap/);
  });

  it("does not block or scale reversals when withdrawable balance is low", () => {
    assert.doesNotMatch(bulkReversalSrc, /availableCents/);
    assert.doesNotMatch(
      bulkReversalSrc,
      /creator withdrawable balance is \$0/,
    );
  });

  it("debits totalDueCents without partial cap branch", () => {
    assert.match(bulkReversalSrc, /const debitCents = totalDueCents/);
  });
});
