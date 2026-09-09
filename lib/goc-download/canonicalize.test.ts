import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalize } from "@/lib/goc-download/canonicalize";
import {
  TEST_VECTOR_CANONICAL,
  TEST_VECTOR_UNSIGNED_PAYLOAD,
} from "@/lib/goc-download/test-vector";

describe("goc-download canonicalize (JCS)", () => {
  it("is stable for nested objects regardless of key insertion order", () => {
    const a = { b: 1, a: { z: 2, y: 3 } };
    const b = { a: { y: 3, z: 2 }, b: 1 };
    assert.equal(canonicalize(a), canonicalize(b));
    assert.equal(canonicalize(a), '{"a":{"y":3,"z":2},"b":1}');
  });

  it("matches the fixed cross-language test vector canonical form", () => {
    assert.equal(canonicalize(TEST_VECTOR_UNSIGNED_PAYLOAD), TEST_VECTOR_CANONICAL);
    assert.ok(TEST_VECTOR_CANONICAL.startsWith("{"));
    assert.ok(TEST_VECTOR_CANONICAL.includes('"version":1'));
  });

  it("rejects non-finite numbers", () => {
    assert.throws(() => canonicalize(Number.NaN));
    assert.throws(() => canonicalize(Number.POSITIVE_INFINITY));
  });
});
