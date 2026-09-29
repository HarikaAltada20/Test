import { NextRequest, NextResponse } from "next/server";
import { ingestInboundUniboxMessage } from "@/lib/admin-email/unibox";
import { handleWarmUpInbound } from "@/lib/admin-email/warm-up-inbound";
import { parseMailbox } from "@/lib/email/inbound-email-parse";
import {
  processInboundRawEmail,
  processInboundS3Object,
  processSesInboundNotification,
} from "@/lib/email/inbound-s3";
import {
  handleSnsSubscriptionConfirmation,
  isAuthorizedSnsTopic,
  verifySnsEnvelopeSignature,
  type SnsEnvelope,
} from "@/lib/aws/sns-webhook";

type InboundPayload = {
  fromEmail?: string;
  fromName?: string;
  toEmail?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  sesMessageId?: string;
  inReplyToMessageId?: string;
  attachments?: Array<{
    filename: string;
    contentType?: string;
    sizeBytes?: number;
    storagePath?: string;
  }>;
};

function isAuthorizedToken(req: NextRequest): boolean {
  const token = req.headers.get("x-inbound-token")?.trim();
  const expected = process.env.INBOUND_LAMBDA_TOKEN?.trim();
  if (!expected) return false;
  return token === expected;
}

export async function POST(req: NextRequest) {
  let body: InboundPayload & SnsEnvelope & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.Type === "SubscriptionConfirmation" && body.SubscribeURL) {
    const subscription = await handleSnsSubscriptionConfirmation(body);
    if (subscription.error) {
      return NextResponse.json({ error: subscription.error }, { status: 401 });
    }
    return NextResponse.json({ ok: true, subscribed: subscription.subscribed });
  }

  if (body.Type === "Notification" && typeof body.Message === "string") {
    if (!isAuthorizedSnsTopic(body.TopicArn)) {
      return NextResponse.json({ error: "Unauthorized SNS topic" }, { status: 401 });
    }

    const signatureError = await verifySnsEnvelopeSignature(body);
    if (signatureError) {
      return NextResponse.json({ error: signatureError }, { status: 401 });
    }

    try {
      const inner = JSON.parse(body.Message) as Record<string, unknown>;

      if (inner.notificationType === "Received") {
        const stats = await processSesInboundNotification(
          inner as Parameters<typeof processSesInboundNotification>[0],
        );
        return NextResponse.json({ ok: true, ...stats });
      }

      if (
        inner.bucket &&
        inner.key &&
        typeof inner.bucket === "string" &&
        typeof inner.key === "string"
      ) {
        const result = await processInboundS3Object(inner.bucket, inner.key);
        return NextResponse.json({ ok: true, ...result });
      }

      const fromRaw =
        (inner.fromEmail as string | undefined) ??
        (inner.from as string | undefined);
      const toRaw =
        (inner.toEmail as string | undefined) ??
        (inner.to as string | undefined);

      if (fromRaw && toRaw && inner.subject) {
        const from = parseMailbox(fromRaw);
        const to = parseMailbox(toRaw);
        await handleWarmUpInbound({
          fromEmail: from.email || fromRaw,
          toEmail: to.email || toRaw,
          inReplyToMessageId: inner.inReplyToMessageId as string | undefined,
          sesMessageId: inner.sesMessageId as string | undefined,
        });
        const result = await ingestInboundUniboxMessage({
          fromEmail: from.email || fromRaw,
          fromName:
            (inner.fromName as string | undefined) ?? from.name ?? undefined,
          toEmail: to.email || toRaw,
          subject: String(inner.subject),
          bodyText: inner.bodyText as string | undefined,
          bodyHtml: inner.bodyHtml as string | undefined,
          sesMessageId: inner.sesMessageId as string | undefined,
          inReplyToMessageId: inner.inReplyToMessageId as string | undefined,
          stopOnReply: true,
        });
        return NextResponse.json({ ok: true, ...result });
      }

      if (typeof inner.rawEmail === "string") {
        const result = await processInboundRawEmail(inner.rawEmail);
        return NextResponse.json({ ok: true, ...result });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "SNS message parse failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!isAuthorizedToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fromParsed = parseMailbox(body.fromEmail?.trim() ?? null);
  const toParsed = parseMailbox(body.toEmail?.trim() ?? null);
  const fromEmail = fromParsed.email || body.fromEmail?.trim();
  const toEmail = toParsed.email || body.toEmail?.trim();
  const subject = body.subject?.trim();

  if (!fromEmail || !toEmail || !subject) {
    return NextResponse.json(
      { error: "fromEmail, toEmail, and subject are required" },
      { status: 400 },
    );
  }

  try {
    await handleWarmUpInbound({
      fromEmail,
      toEmail,
      inReplyToMessageId: body.inReplyToMessageId,
      sesMessageId: body.sesMessageId,
    });

    const result = await ingestInboundUniboxMessage({
      fromEmail,
      fromName: body.fromName ?? fromParsed.name,
      toEmail,
      subject,
      bodyText: body.bodyText,
      bodyHtml: body.bodyHtml,
      sesMessageId: body.sesMessageId,
      inReplyToMessageId: body.inReplyToMessageId,
      stopOnReply: true,
      attachments: body.attachments,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to ingest inbound email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
