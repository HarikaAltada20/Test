import { z } from "zod";

export const GOC_DOWNLOAD_MANIFEST_VERSION = 1 as const;

export const gocDownloadItemSchema = z.object({
  itemId: z.string().uuid(),
  submissionId: z.string().uuid().optional(),
  url: z.string().url().max(2048),
  filename: z.string().min(1).max(240),
  platform: z.literal("youtube"),
});

export const gocDownloadArchiveSchema = z.object({
  archiveId: z.string().uuid(),
  zipFilename: z.string().min(1).max(240),
  itemIds: z.array(z.string().uuid()).min(1).max(100),
});

export const gocDownloadContextSchema = z.object({
  jobId: z.string().uuid(),
  contestId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  namingPattern: z.string().min(1).max(64),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const gocDownloadCallbackSchema = z.object({
  statusUrl: z.string().url().max(2048),
  statusToken: z.string().min(16).max(4096),
});

export const gocDownloadUnsignedPayloadSchema = z.object({
  version: z.literal(GOC_DOWNLOAD_MANIFEST_VERSION),
  context: gocDownloadContextSchema,
  archives: z.array(gocDownloadArchiveSchema).min(1).max(100),
  items: z.array(gocDownloadItemSchema).min(1).max(100),
  callback: gocDownloadCallbackSchema,
});

export const gocDownloadSignatureSchema = z.object({
  keyId: z.string().min(1).max(128),
  algorithm: z.literal("Ed25519"),
  value: z.string().min(1).max(512),
});

export const gocDownloadManifestSchema = gocDownloadUnsignedPayloadSchema.extend(
  {
    signature: gocDownloadSignatureSchema,
  },
);

export type GocDownloadItem = z.infer<typeof gocDownloadItemSchema>;
export type GocDownloadArchive = z.infer<typeof gocDownloadArchiveSchema>;
export type GocDownloadContext = z.infer<typeof gocDownloadContextSchema>;
export type GocDownloadCallback = z.infer<typeof gocDownloadCallbackSchema>;
export type GocDownloadUnsignedPayload = z.infer<
  typeof gocDownloadUnsignedPayloadSchema
>;
export type GocDownloadSignature = z.infer<typeof gocDownloadSignatureSchema>;
export type GocDownloadManifest = z.infer<typeof gocDownloadManifestSchema>;

export const desktopStatusEventTypes = [
  "accepted",
  "started",
  "item_completed",
  "item_failed",
  "archive_completed",
  "job_completed",
  "job_failed",
] as const;

export type DesktopStatusEventType = (typeof desktopStatusEventTypes)[number];

export const desktopStatusEventSchema = z.object({
  eventId: z.string().min(8).max(128),
  eventType: z.enum(desktopStatusEventTypes),
  jobId: z.string().uuid(),
  itemId: z.string().uuid().optional(),
  archiveId: z.string().uuid().optional(),
  submissionId: z.string().uuid().optional(),
  error: z.string().max(2000).optional(),
  errorMessage: z.string().max(2000).optional(),
  occurredAt: z.string().datetime(),
  successCount: z.number().int().nonnegative().optional(),
  failedCount: z.number().int().nonnegative().optional(),
  totalCount: z.number().int().nonnegative().optional(),
  zipPartIndex: z.number().int().positive().optional(),
  zipFilename: z.string().max(240).optional(),
  meta: z
    .object({
      successCount: z.number().int().nonnegative().optional(),
      failedCount: z.number().int().nonnegative().optional(),
      totalCount: z.number().int().nonnegative().optional(),
      zipFilename: z.string().max(240).optional(),
    })
    .optional(),
});

export type DesktopStatusEvent = z.infer<typeof desktopStatusEventSchema>;
