import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  canonicalMessageId,
  parseRawEmail,
  pickInReplyToId,
  collectReferenceMessageIds,
} from "@/lib/email/inbound-email-parse";
import { ingestInboundUniboxMessage } from "@/lib/admin-email/unibox";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!region || !accessKeyId || !secretAccessKey) return null;
  if (!s3Client) {
    s3Client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return s3Client;
}

export function getInboundBucket(): string | null {
  return process.env.INBOUND_SHARED_BUCKET?.trim() || null;
}

/** SES stores received messages under inbound/<domain>/<id> — not bucket root. */
export function getInboundPrefix(): string {
  return process.env.INBOUND_S3_PREFIX?.trim() || "inbound/";
}

async function streamToString(body: unknown): Promise<string> {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return Buffer.from(body).toString("utf-8");
  if (Buffer.isBuffer(body)) return body.toString("utf-8");

  const stream = body as AsyncIterable<Uint8Array>;
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export async function fetchInboundEmailFromS3(
  bucket: string,
  key: string,
): Promise<string> {
  const client = getS3Client();
  if (!client) throw new Error("AWS S3 is not configured");

  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  return streamToString(result.Body);
}

export async function isInboundS3KeyProcessed(key: string): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db
    .from("admin_email_inbound_processed")
    .select("thread_id, ses_message_id")
    .eq("s3_key", key)
    .maybeSingle();
  return !!(data?.thread_id || data?.ses_message_id);
}

export async function markInboundS3KeyProcessed(
  key: string,
  sesMessageId: string | null,
  threadId?: string,
): Promise<void> {
  const db = createAdminClient();
  await db.from("admin_email_inbound_processed").upsert({
    s3_key: key,
    ses_message_id: sesMessageId,
    thread_id: threadId ?? null,
    processed_at: new Date().toISOString(),
  });
}

async function getSuccessfullyProcessedS3Keys(
  keys: string[],
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();

  const db = createAdminClient();
  const processed = new Set<string>();

  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    const { data } = await db
      .from("admin_email_inbound_processed")
      .select("s3_key, thread_id, ses_message_id")
      .in("s3_key", chunk);

    for (const row of data ?? []) {
      if (row.thread_id || row.ses_message_id) {
        processed.add(row.s3_key);
      }
    }
  }

  return processed;
}

export async function processInboundRawEmail(
  raw: string,
): Promise<{
  threadId?: string;
  messageId?: string;
  skipped?: boolean;
  sesMessageId?: string | null;
}> {
  const parsed = parseRawEmail(raw);
  if (!parsed.fromEmail || !parsed.toEmail) {
    return { skipped: true };
  }

  const inReplyTo = pickInReplyToId(parsed.inReplyTo, parsed.references);

  const result = await ingestInboundUniboxMessage({
    fromEmail: parsed.fromEmail,
    fromName: parsed.fromName,
    toEmail: parsed.toEmail,
    subject: parsed.subject,
    bodyText: parsed.bodyText,
    bodyHtml: parsed.bodyHtml,
    sesMessageId: parsed.messageId,
    inReplyToMessageId: inReplyTo,
    referenceMessageIds: collectReferenceMessageIds(
      parsed.inReplyTo,
      parsed.references,
    ),
    receivedAt: parsed.date,
    stopOnReply: true,
  });

  return { ...result, sesMessageId: canonicalMessageId(parsed.messageId) ?? parsed.messageId, skipped: result.skipped };
}

export async function processInboundS3Object(
  bucket: string,
  key: string,
): Promise<{ threadId?: string; messageId?: string; skipped?: boolean }> {
  if (await isInboundS3KeyProcessed(key)) {
    return { skipped: true };
  }

  const raw = await fetchInboundEmailFromS3(bucket, key);
  const result = await processInboundRawEmail(raw);

  if (result.skipped || result.messageId) {
    await markInboundS3KeyProcessed(key, result.sesMessageId ?? null, result.threadId);
  }

  return result;
}

type SesS3Receipt = {
  notificationType?: string;
  mail?: { messageId?: string };
  receipt?: {
    action?: {
      type?: string;
      bucketName?: string;
      objectKey?: string;
    };
  };
};

export async function processSesInboundNotification(
  payload: SesS3Receipt,
): Promise<{ processed: number; skipped: number; errors: number }> {
  const action = payload.receipt?.action;
  if (action?.type !== "S3" || !action.bucketName || !action.objectKey) {
    return { processed: 0, skipped: 0, errors: 0 };
  }

  try {
    const result = await processInboundS3Object(
      action.bucketName,
      action.objectKey,
    );
    if (result.skipped) return { processed: 0, skipped: 1, errors: 0 };
    if (result.messageId) return { processed: 1, skipped: 0, errors: 0 };
    return { processed: 0, skipped: 1, errors: 0 };
  } catch (err) {
    console.error("[inbound-s3] process failed:", err);
    return { processed: 0, skipped: 0, errors: 1 };
  }
}

export async function syncInboundEmailsFromBucket(options?: {
  maxKeys?: number;
  prefix?: string;
  /** Max S3 objects to list (paginated under prefix, then sorted by date). */
  maxObjects?: number;
}): Promise<{
  processed: number;
  skipped: number;
  errors: number;
  scanned: number;
}> {
  const bucket = getInboundBucket();
  if (!bucket) throw new Error("INBOUND_SHARED_BUCKET is not configured");

  const client = getS3Client();
  if (!client) throw new Error("AWS S3 is not configured");

  const processLimit = options?.maxKeys ?? 15;
  const maxObjects = options?.maxObjects ?? 1000;
  const prefix = options?.prefix ?? getInboundPrefix();

  type ListedObject = { Key: string; LastModified?: Date };
  const collected: ListedObject[] = [];
  let continuationToken: string | undefined;

  while (collected.length < maxObjects) {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        MaxKeys: Math.min(1000, maxObjects - collected.length),
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of list.Contents ?? []) {
      if (obj.Key) {
        collected.push({ Key: obj.Key, LastModified: obj.LastModified });
      }
    }

    if (!list.IsTruncated) break;
    continuationToken = list.NextContinuationToken;
  }

  const objects = collected.sort(
    (a, b) =>
      (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0),
  );

  const processedKeys = await getSuccessfullyProcessedS3Keys(
    objects.map((obj) => obj.Key),
  );
  const pending = objects.filter((obj) => !processedKeys.has(obj.Key));

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let scanned = 0;

  for (const obj of pending) {
    scanned += 1;
    try {
      const result = await processInboundS3Object(bucket, obj.Key);
      if (result.skipped) {
        skipped += 1;
      } else if (result.messageId) {
        processed += 1;
        if (processed >= processLimit) break;
      } else {
        skipped += 1;
      }
    } catch (err) {
      console.error("[inbound-s3] sync key failed:", obj.Key, err);
      errors += 1;
    }
  }

  return { processed, skipped, errors, scanned };
}

let lastRecentSyncAt = 0;
const RECENT_SYNC_MIN_INTERVAL_MS = 12_000;

/** Lightweight sync for live polling — checks newest inbound objects first. */
export async function syncRecentInboundEmails(): Promise<{
  processed: number;
  skipped: number;
  errors: number;
  scanned: number;
  throttled?: boolean;
}> {
  const now = Date.now();
  if (now - lastRecentSyncAt < RECENT_SYNC_MIN_INTERVAL_MS) {
    return { processed: 0, skipped: 0, errors: 0, scanned: 0, throttled: true };
  }
  lastRecentSyncAt = now;

  return syncInboundEmailsFromBucket({
    maxKeys: 5,
    maxObjects: 100,
  });
}
