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
import { handleWarmUpInbound } from "@/lib/admin-email/warm-up-inbound";

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
  warmUpHandled?: boolean;
}> {
  const parsed = parseRawEmail(raw);
  if (!parsed.fromEmail || !parsed.toEmail) {
    return { skipped: true };
  }

  const inReplyTo = pickInReplyToId(parsed.inReplyTo, parsed.references);
  const referenceMessageIds = collectReferenceMessageIds(
    parsed.inReplyTo,
    parsed.references,
  );

  const warmUp = await handleWarmUpInbound({
    fromEmail: parsed.fromEmail,
    toEmail: parsed.toEmail,
    inReplyToMessageId: inReplyTo,
    referenceMessageIds,
    sesMessageId: parsed.messageId,
    receivedAt: parsed.date,
  });

  const result = await ingestInboundUniboxMessage({
    fromEmail: parsed.fromEmail,
    fromName: parsed.fromName,
    toEmail: parsed.toEmail,
    subject: parsed.subject,
    bodyText: parsed.bodyText,
    bodyHtml: parsed.bodyHtml,
    sesMessageId: parsed.messageId,
    inReplyToMessageId: inReplyTo,
    referenceMessageIds,
    receivedAt: parsed.date,
    stopOnReply: true,
  });

  return {
    ...result,
    sesMessageId: canonicalMessageId(parsed.messageId) ?? parsed.messageId,
    skipped: result.skipped,
    warmUpHandled: warmUp.handled,
  };
}

export async function processInboundS3Object(
  bucket: string,
  key: string,
): Promise<{
  threadId?: string;
  messageId?: string;
  skipped?: boolean;
  warmUpHandled?: boolean;
}> {
  if (await isInboundS3KeyProcessed(key)) {
    return { skipped: true };
  }

  const raw = await fetchInboundEmailFromS3(bucket, key);
  const result = await processInboundRawEmail(raw);

  if (result.skipped || result.messageId || result.warmUpHandled) {
    await markInboundS3KeyProcessed(
      key,
      result.sesMessageId ?? null,
      result.threadId,
    );
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

type ListedObject = { Key: string; LastModified?: Date };

function emailDomain(email: string | null | undefined): string | null {
  const domain = email?.trim().toLowerCase().split("@")[1];
  if (!domain || domain.includes("amazonaws.com")) return null;
  return domain;
}

function retainNewest(
  buffer: ListedObject[],
  candidate: ListedObject,
  limit: number,
): void {
  buffer.push(candidate);
  buffer.sort(
    (a, b) =>
      (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0),
  );
  if (buffer.length > limit) buffer.length = limit;
}

/** Domains we receive mail on — campaign senders, warm-up inboxes, outbound recipients. */
async function getInboundReceivingDomains(): Promise<string[]> {
  const db = createAdminClient();
  const domains = new Set<string>();

  const addEmail = (email: string | null | undefined) => {
    const domain = emailDomain(email);
    if (domain) domains.add(domain);
  };

  const [warmUpRes, campaignRes, outboundRes, recipientRes] = await Promise.all([
    db.from("admin_email_warm_up_accounts").select("email"),
    db
      .from("admin_email_campaigns")
      .select("from_email")
      .not("from_email", "is", null),
    db
      .from("admin_email_unibox_messages")
      .select("to_email")
      .eq("direction", "outbound")
      .not("to_email", "is", null)
      .order("created_at", { ascending: false })
      .limit(150),
    db
      .from("admin_email_campaign_recipients")
      .select("from_email")
      .not("from_email", "is", null)
      .order("updated_at", { ascending: false })
      .limit(150),
  ]);

  for (const row of warmUpRes.data ?? []) addEmail(row.email);
  for (const row of campaignRes.data ?? []) addEmail(row.from_email);
  for (const row of outboundRes.data ?? []) addEmail(row.to_email);
  for (const row of recipientRes.data ?? []) addEmail(row.from_email);

  return Array.from(domains).slice(0, 25);
}

async function listNewestUnderPrefix(
  client: S3Client,
  bucket: string,
  prefix: string,
  options: {
    maxObjects: number;
    maxPages: number;
    deadline: number | null;
  },
): Promise<{ objects: ListedObject[]; listed: number }> {
  const newest: ListedObject[] = [];
  let continuationToken: string | undefined;
  let listed = 0;

  for (let page = 0; page < options.maxPages; page++) {
    if (options.deadline && Date.now() > options.deadline) break;

    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 200,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of list.Contents ?? []) {
      if (!obj.Key) continue;
      listed += 1;
      retainNewest(
        newest,
        { Key: obj.Key, LastModified: obj.LastModified },
        options.maxObjects,
      );
    }

    if (!list.IsTruncated) break;
    continuationToken = list.NextContinuationToken;
  }

  return { objects: newest, listed };
}

export type InboundSyncResult = {
  processed: number;
  warmUpHandled: number;
  skipped: number;
  errors: number;
  scanned: number;
  listed: number;
  throttled?: boolean;
};

async function processPendingObjects(
  bucket: string,
  pending: ListedObject[],
  processLimit: number,
  deadline: number | null,
): Promise<Pick<InboundSyncResult, "processed" | "warmUpHandled" | "skipped" | "errors" | "scanned">> {
  let processed = 0;
  let warmUpHandled = 0;
  let skipped = 0;
  let errors = 0;
  let scanned = 0;

  for (const obj of pending) {
    if (deadline && Date.now() > deadline) break;
    if (processed + warmUpHandled >= processLimit) break;

    scanned += 1;
    try {
      const result = await processInboundS3Object(bucket, obj.Key);
      if (result.skipped) {
        skipped += 1;
      } else if (result.messageId) {
        processed += 1;
      } else if (result.warmUpHandled) {
        warmUpHandled += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      console.error("[inbound-s3] sync key failed:", obj.Key, err);
      errors += 1;
    }
  }

  return { processed, warmUpHandled, skipped, errors, scanned };
}

export async function syncInboundEmailsFromBucket(options?: {
  maxKeys?: number;
  prefix?: string;
  maxObjects?: number;
  timeBudgetMs?: number;
  maxPagesPerPrefix?: number;
}): Promise<InboundSyncResult> {
  const bucket = getInboundBucket();
  if (!bucket) throw new Error("INBOUND_SHARED_BUCKET is not configured");

  const client = getS3Client();
  if (!client) throw new Error("AWS S3 is not configured");

  const processLimit = options?.maxKeys ?? 15;
  const maxObjects = options?.maxObjects ?? 50;
  const maxPagesPerPrefix = options?.maxPagesPerPrefix ?? 2;
  const basePrefix = options?.prefix ?? getInboundPrefix();
  const deadline = options?.timeBudgetMs
    ? Date.now() + options.timeBudgetMs
    : null;

  const domains = await getInboundReceivingDomains();
  const prefixes =
    domains.length > 0
      ? domains.map((domain) => `${basePrefix}${domain}/`)
      : [basePrefix];

  const candidates: ListedObject[] = [];
  let listed = 0;

  for (const prefix of prefixes) {
    if (deadline && Date.now() > deadline) break;

    const { objects, listed: prefixListed } = await listNewestUnderPrefix(
      client,
      bucket,
      prefix,
      {
        maxObjects,
        maxPages: maxPagesPerPrefix,
        deadline,
      },
    );
    listed += prefixListed;
    candidates.push(...objects);
  }

  candidates.sort(
    (a, b) =>
      (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0),
  );
  const newest = candidates.slice(0, maxObjects);

  const processedKeys = await getSuccessfullyProcessedS3Keys(
    newest.map((obj) => obj.Key),
  );
  const pending = newest.filter((obj) => !processedKeys.has(obj.Key));

  const stats = await processPendingObjects(
    bucket,
    pending,
    processLimit,
    deadline,
  );

  return { ...stats, listed };
}

let lastRecentSyncAt = 0;
const RECENT_SYNC_MIN_INTERVAL_MS = 12_000;

/** Lightweight sync for live polling — checks newest inbound objects first. */
export async function syncRecentInboundEmails(): Promise<InboundSyncResult> {
  const now = Date.now();
  if (now - lastRecentSyncAt < RECENT_SYNC_MIN_INTERVAL_MS) {
    return {
      processed: 0,
      warmUpHandled: 0,
      skipped: 0,
      errors: 0,
      scanned: 0,
      listed: 0,
      throttled: true,
    };
  }
  lastRecentSyncAt = now;

  return syncInboundEmailsFromBucket({
    maxKeys: 5,
    maxObjects: 40,
    maxPagesPerPrefix: 1,
    timeBudgetMs: 8_000,
  });
}

/** User-triggered sync — scoped to campaign/project/warm-up domains, finishes quickly. */
export async function syncManualInboundEmails(): Promise<InboundSyncResult> {
  return syncInboundEmailsFromBucket({
    maxKeys: 15,
    maxObjects: 60,
    maxPagesPerPrefix: 2,
    timeBudgetMs: 18_000,
  });
}
