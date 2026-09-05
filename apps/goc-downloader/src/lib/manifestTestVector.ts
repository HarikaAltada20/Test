/**
 * Fixed cross-language Ed25519 + RFC 8785/JCS test vector.
 * Must match `lib/goc-download/test-vector.ts` and Rust `manifest::test_vector_unsigned_json`.
 */
export const MANIFEST_TEST_VECTOR_UNSIGNED = {
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
} as const;
