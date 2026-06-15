import { randomUUID } from "crypto";

function encodeHeaderValue(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const encoded = Buffer.from(value, "utf-8").toString("base64");
  return `=?UTF-8?B?${encoded}?=`;
}

function formatMailbox(email: string, name?: string): string {
  const trimmed = email.trim();
  if (!name?.trim()) return trimmed;
  const safeName = name.replace(/"/g, '\\"');
  return `"${safeName}" <${trimmed}>`;
}

function wrapBase64Lines(input: string): string {
  return input.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

function messageIdDomain(fromEmail: string): string {
  const domain = fromEmail.split("@")[1]?.trim();
  return domain || "localhost";
}

export function buildMimeMessage(input: {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  listUnsubscribeUrl?: string;
  /** Send a single text/plain part (best for Gmail Primary on simple notes). */
  plainTextOnly?: boolean;
}): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const subject = encodeHeaderValue(input.subject);
  const from = formatMailbox(input.from, input.fromName);
  const now = new Date();
  const lines: string[] = [
    `From: ${from}`,
    `To: ${input.to.trim()}`,
    `Subject: ${subject}`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${randomUUID()}@${messageIdDomain(input.from)}>`,
    "MIME-Version: 1.0",
  ];

  if (input.replyTo?.trim()) {
    lines.push(`Reply-To: ${input.replyTo.trim()}`);
  }

  if (input.listUnsubscribeUrl?.trim()) {
    lines.push(`List-Unsubscribe: <${input.listUnsubscribeUrl.trim()}>`);
  }

  if (input.plainTextOnly) {
    lines.push(
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64Lines(Buffer.from(input.text, "utf-8").toString("base64")),
      "",
    );
    return lines.join("\r\n");
  }

  lines.push(
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64Lines(Buffer.from(input.text, "utf-8").toString("base64")),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64Lines(Buffer.from(input.html, "utf-8").toString("base64")),
    "",
    `--${boundary}--`,
    "",
  );

  return lines.join("\r\n");
}
