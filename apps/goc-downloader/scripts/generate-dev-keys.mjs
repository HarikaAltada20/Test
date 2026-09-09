#!/usr/bin/env node
/**
 * Generates an Ed25519 keypair for local manifest signing.
 * Private key → apps/goc-downloader/.keys/ (gitignored)
 * Public key → src-tauri/resources/public_keys.json
 *
 * Cross-language vector matches lib/goc-download/test-vector.ts
 */

import { generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const keysDir = join(root, ".keys");
const publicKeysPath = join(root, "src-tauri", "resources", "public_keys.json");

function canonicalize(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`)
      .join(",")}}`;
  }
  throw new Error(`Unsupported value: ${typeof value}`);
}

const TEST_VECTOR_UNSIGNED = {
  version: 1,
  context: {
    jobId: "11111111-1111-4111-8111-111111111111",
    contestId: "22222222-2222-4222-8222-222222222222",
    userId: "33333333-3333-4333-8333-333333333333",
    namingPattern: "views_username",
    createdAt: "2026-09-05T00:00:00.000Z",
    expiresAt: "2026-09-05T01:00:00.000Z",
  },
  archives: [
    {
      archiveId: "44444444-4444-4444-8444-444444444444",
      zipFilename: "contest_part_1_of_1.zip",
      itemIds: ["55555555-5555-4555-8555-555555555555"],
    },
  ],
  items: [
    {
      itemId: "55555555-5555-4555-8555-555555555555",
      submissionId: "66666666-6666-4666-8666-666666666666",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      filename: "000000012345_creator.mp4",
      platform: "youtube",
    },
  ],
  callback: {
    statusUrl: "https://example.com/api/admin/bulk-download/desktop-status",
    statusToken: "test.status.token.placeholder.value",
  },
};

function main() {
  mkdirSync(keysDir, { recursive: true });

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pubDer = publicKey.export({ type: "spki", format: "der" });
  const rawPub = pubDer.subarray(pubDer.length - 32);
  const publicKeyBase64 = rawPub.toString("base64");
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" });

  writeFileSync(join(keysDir, "dev-1.private.pem"), privPem, { mode: 0o600 });
  writeFileSync(
    join(keysDir, "dev-1.env.snippet"),
    [
      "GOC_DOWNLOAD_SIGNING_KEY_ID=dev-1",
      `GOC_DOWNLOAD_SIGNING_PRIVATE_KEY="${String(privPem).replace(/\n/g, "\\n")}"`,
      "GOC_DOWNLOAD_STATUS_HMAC_SECRET=dev-status-hmac-secret-at-least-32-chars",
      "NEXT_PUBLIC_DESKTOP_DOWNLOAD_ENABLED=true",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );

  writeFileSync(
    publicKeysPath,
    `${JSON.stringify(
      {
        keys: [
          {
            keyId: "dev-1",
            algorithm: "Ed25519",
            publicKeyBase64,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  const canonical = canonicalize(TEST_VECTOR_UNSIGNED);
  const signature = sign(null, Buffer.from(canonical, "utf8"), privateKey).toString(
    "base64",
  );

  console.log("Wrote private key to .keys/dev-1.private.pem");
  console.log("Updated resources/public_keys.json");
  console.log("Test-vector signature (base64):", signature);
  console.log("Canonical length:", canonical.length);
}

main();
