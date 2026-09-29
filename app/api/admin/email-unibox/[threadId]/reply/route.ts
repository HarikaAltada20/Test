import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  getUniboxThreadDetail,
} from "@/lib/admin-email/unibox";
import {
  getBulkEmailFromName,
  getBulkEmailReplyTo,
  htmlToPlainText,
} from "@/lib/email/admin-bulk-email";
import { sendSesEmail, sesCorrelationMessageId, mimeThreadingMessageId } from "@/lib/email/ses-client";

type RouteContext = { params: Promise<{ threadId: string }> };

function formatSesMessageId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed;
  return `<${trimmed}>`;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { threadId } = await context.params;

  let body: { message?: string; replyAll?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messageBody = body.message?.trim();
  if (!messageBody) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const detail = await getUniboxThreadDetail(threadId);
  if (!detail) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const db = createAdminClient();
  const { data: campaign } = detail.thread.campaignId
    ? await db
        .from("admin_email_campaigns")
        .select("from_email")
        .eq("id", detail.thread.campaignId)
        .maybeSingle()
    : { data: null };

  const { data: defaultSender } = detail.thread.projectId
    ? await db
        .from("admin_email_project_senders")
        .select("email")
        .eq("project_id", detail.thread.projectId)
        .eq("is_default", true)
        .maybeSingle()
    : { data: null };

  const lastOutbound = [...detail.messages]
    .reverse()
    .find((m) => m.direction === "outbound" && m.sesMessageId);

  const fromEmail = campaign?.from_email ?? defaultSender?.email ?? null;

  if (!fromEmail) {
    return NextResponse.json(
      { error: "No sender email configured for this thread" },
      { status: 400 },
    );
  }

  const toEmail = detail.thread.contactEmail;
  const subject = detail.thread.subject?.startsWith("Re:")
    ? detail.thread.subject
    : `Re: ${detail.thread.subject ?? "No subject"}`;

  const html = messageBody.includes("<")
    ? messageBody
    : messageBody
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
  const text = htmlToPlainText(html);

  const inReplyTo = lastOutbound?.sesMessageId
    ? formatSesMessageId(lastOutbound.sesMessageId)
    : undefined;

  const sendResult = await sendSesEmail({
    from: fromEmail,
    fromName: getBulkEmailFromName(fromEmail),
    to: toEmail,
    subject,
    html,
    text,
    replyTo: getBulkEmailReplyTo(fromEmail),
    inReplyTo,
    references: inReplyTo,
    useRaw: true,
    plainTextOnly: !messageBody.includes("<"),
  });

  const storedSesMessageId = sesCorrelationMessageId(sendResult);
  if (!storedSesMessageId) {
    return NextResponse.json(
      { error: sendResult.error ?? "Failed to send reply" },
      { status: 500 },
    );
  }

  const threadingMessageId =
    mimeThreadingMessageId(sendResult) ?? storedSesMessageId;

  const now = new Date().toISOString();
  await db.from("admin_email_unibox_messages").insert({
    thread_id: threadId,
    direction: "outbound",
    project_id: detail.thread.projectId,
    campaign_id: detail.thread.campaignId,
    user_id: detail.thread.userId,
    from_email: fromEmail,
    from_name: getBulkEmailFromName(fromEmail),
    to_email: toEmail,
    to_name: detail.thread.contactName,
    subject,
    body_text: text,
    body_html: html,
    snippet: text.slice(0, 200),
    ses_message_id: threadingMessageId,
    in_reply_to_message_id: lastOutbound?.sesMessageId ?? null,
    created_at: now,
  });

  await db
    .from("admin_email_unibox_threads")
    .update({
      subject,
      last_message_at: now,
      latest_snippet: text.slice(0, 200),
      latest_direction: "outbound",
      is_read: true,
      updated_at: now,
    })
    .eq("id", threadId);

  return NextResponse.json({ ok: true, messageId: threadingMessageId });
}
