import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { canonicalize } from "./canonicalize";
import {
  buildSignedManifest,
  unsignedPayloadFromManifest,
  verifyManifestSignature,
} from "./sign";
import { TEST_VECTOR_UNSIGNED_PAYLOAD } from "./test-vector";

describe("goc-download manifest-sign", () => {
  it("signs and verifies the fixed test vector; detects tampering", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    process.env.GOC_DOWNLOAD_SIGNING_PRIVATE_KEY = privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    process.env.GOC_DOWNLOAD_SIGNING_KEY_ID = "test-1";
    const publicPem = publicKey
      .export({ type: "spki", format: "pem" })
      .toString();

    const signed = buildSignedManifest(TEST_VECTOR_UNSIGNED_PAYLOAD);
    assert.equal(signed.signature.algorithm, "Ed25519");
    assert.equal(signed.signature.keyId, "test-1");
    assert.ok(signed.signature.value.length > 20);

    const unsigned = unsignedPayloadFromManifest(signed);
    const verified = verifyManifestSignature({
      payload: unsigned,
      signature: signed.signature,
      publicKeyPem: publicPem,
      expectedKeyId: "test-1",
    });
    assert.equal(verified.ok, true);

    const tampered = {
      ...unsigned,
      items: unsigned.items.map((item, i) =>
        i === 0 ? { ...item, filename: "evil.mp4" } : item,
      ),
    };
    const bad = verifyManifestSignature({
      payload: tampered,
      signature: signed.signature,
      publicKeyPem: publicPem,
    });
    assert.equal(bad.ok, false);

    assert.equal(
      canonicalize(unsigned),
      canonicalize(TEST_VECTOR_UNSIGNED_PAYLOAD),
    );
  });
});
