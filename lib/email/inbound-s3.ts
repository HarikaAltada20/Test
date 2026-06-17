import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  normalizeSesMessageId,
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
    .select("s3_key")
    .eq("s3_key", key)
    .maybeSingle();
  return !!data;
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

export async function processInboundRawEmail(
  raw: string,
  meta?: { s3Key?: string },
): Promise<{ threadId?: string; messageId?: string; skipped?: boolean }> {
  const parsed = parseRawEmail(raw);
  if (!parsed.fromEmail || !parsed.toEmail) {
    return { skipped: true };
  }

  const inReplyTo = pickInReplyToId(parsed.inReplyTo, parsed.references);
  const normalizedInboundId = normalizeSesMessageId(parsed.messageId);

  if (normalizedInboundId) {
    const db = createAdminClient();
    const { data: existing } = await db
      .from("admin_email_unibox_messages")
      .select("id")
      .ilike("ses_message_id", `%${normalizedInboundId}%`)
      .eq("direction", "inbound")
      .maybeSingle();
    if (existing) return { skipped: true, messageId: existing.id };
  }

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
    stopOnReply: true,
  });

  if (meta?.s3Key && result.threadId) {
    await markInboundS3KeyProcessed(
      meta.s3Key,
      parsed.messageId,
      result.threadId,
    );
  }

  return result;
}

export async function processInboundS3Object(
  bucket: string,
  key: string,
): Promise<{ threadId?: string; messageId?: string; skipped?: boolean }> {
  if (await isInboundS3KeyProcessed(key)) {
    return { skipped: true };
  }

  const raw = await fetchInboundEmailFromS3(bucket, key);
  const result = await processInboundRawEmail(raw, { s3Key: key });

  if (!result.skipped && result.threadId) {
    await markInboundS3KeyProcessed(key, null, result.threadId);
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
    return { processed: 1, skipped: 0, errors: 0 };
  } catch (err) {
    console.error("[inbound-s3] process failed:", err);
    return { processed: 0, skipped: 0, errors: 1 };
  }
}

export async function syncInboundEmailsFromBucket(options?: {
  maxKeys?: number;
  prefix?: string;
  maxScan?: number;
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
  const maxScan = options?.maxScan ?? 80;
  const prefix = options?.prefix ?? "";
  const pageSize = 100;
  const maxConsecutiveSkips = 20;

  type ListedObject = { Key: string; LastModified?: Date };
  const collected: ListedObject[] = [];
  let continuationToken: string | undefined;

  while (collected.length < maxScan) {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        MaxKeys: Math.min(pageSize, maxScan - collected.length),
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of list.Contents ?? []) {
      if (obj.Key) {
        collected.push({ Key: obj.Key, LastModified: obj.LastModified });
      }
    }

    if (!list.IsTruncated || collected.length >= maxScan) break;
    continuationToken = list.NextContinuationToken;
  }

  const objects = collected.sort(
    (a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0),
  );

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let scanned = 0;
  let consecutiveSkips = 0;

  for (const obj of objects) {
    scanned += 1;
    try {
      const result = await processInboundS3Object(bucket, obj.Key);
      if (result.skipped) {
        skipped += 1;
        consecutiveSkips += 1;
        if (consecutiveSkips >= maxConsecutiveSkips) break;
      } else {
        processed += 1;
        consecutiveSkips = 0;
        if (processed >= processLimit) break;
      }
    } catch (err) {
      console.error("[inbound-s3] sync key failed:", obj.Key, err);
      errors += 1;
      consecutiveSkips = 0;
    }
  }

  return { processed, skipped, errors, scanned };
}
