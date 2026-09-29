/**
 * Fixed cross-language test vector for Ed25519 + JCS.
 * Rust verifier tests must use the same unsigned payload object.
 *
 * Keys are generated in tests (ephemeral). This file only defines the payload
 * shape and a stable canonical form for the unsigned object (without callback
 * secrets that change). The MINIMAL_UNSIGNED below uses fixed UUIDs/timestamps.
 */

import type { GocDownloadUnsignedPayload } from "@/lib/goc-download/schemas";
import { canonicalize } from "@/lib/goc-download/canonicalize";

/** Deterministic unsigned payload for TS ↔ Rust interop tests. */
export const TEST_VECTOR_UNSIGNED_PAYLOAD: GocDownloadUnsignedPayload = {
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

/** Precomputed JCS of TEST_VECTOR_UNSIGNED_PAYLOAD — keep in sync with Rust. */
export const TEST_VECTOR_CANONICAL = canonicalize(TEST_VECTOR_UNSIGNED_PAYLOAD);
