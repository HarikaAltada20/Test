export function normalizeSesMessageId(id: string | null | undefined): string | null {
  if (!id?.trim()) return null;
  const stripped = id.trim().replace(/^<|>$/g, "");
  const base = stripped.split("@")[0]?.trim();
  return base || stripped;
}

function unfoldHeaders(raw: string): string {
  return raw.replace(/\r?\n[ \t]+/g, " ");
}

function getHeader(headers: string, name: string): string | null {
  const unfolded = unfoldHeaders(headers);
  const regex = new RegExp(`(?:^|\\n)${name}:\\s*([^\\n]+)`, "i");
  const match = unfolded.match(regex);
  return match?.[1]?.trim() ?? null;
}

function decodeMimeWords(value: string): string {
  return value.replace(
    /=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g,
    (_match, _charset, encoding, text) => {
      try {
        if (encoding.toUpperCase() === "B") {
          return Buffer.from(text, "base64").toString("utf-8");
        }
        return text
          .replace(/_/g, " ")
          .replace(/=([0-9A-F]{2})/gi, (_m: string, hex: string) =>
            String.fromCharCode(parseInt(hex, 16)),
          );
      } catch {
        return text;
      }
    },
  );
}

export function parseMailbox(value: string | null): {
  email: string;
  name: string | null;
} {
  if (!value) return { email: "", name: null };
  const decoded = decodeMimeWords(value).trim();

  // Use the last angle-bracketed address (RFC 5322 "Display Name <email@domain>")
  const bracketed = [...decoded.matchAll(/<([^<>]+@[^<>]+)>/g)];
  if (bracketed.length > 0) {
    const last = bracketed[bracketed.length - 1];
    const email = last[1].trim().toLowerCase();
    let name = decoded
      .slice(0, last.index)
      .replace(/"/g, "")
      .replace(/<[^>]*$/, "")
      .trim();
    if (name.includes("<")) {
      name = name.match(/^([^<]+)/)?.[1]?.trim() ?? "";
    }
    return { email, name: name || null };
  }

  const plainEmail = decoded.match(/[^\s<>]+@[^\s<>]+/);
  if (plainEmail) {
    return { email: plainEmail[0].trim().toLowerCase(), name: null };
  }

  return { email: decoded.toLowerCase(), name: null };
}

function extractFirstEmail(value: string | null): string {
  const { email } = parseMailbox(value);
  return email;
}

function decodeQuotedPrintable(input: string): string {
  const normalized = input.replace(/\r\n/g, "\n");
  const withoutSoftBreaks = normalized.replace(/=\n/g, "");

  const bytes: number[] = [];
  for (let i = 0; i < withoutSoftBreaks.length; i += 1) {
    const char = withoutSoftBreaks[i];
    if (
      char === "=" &&
      i + 2 < withoutSoftBreaks.length &&
      /^[0-9A-F]{2}$/i.test(withoutSoftBreaks.slice(i + 1, i + 3))
    ) {
      bytes.push(parseInt(withoutSoftBreaks.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    bytes.push(withoutSoftBreaks.charCodeAt(i));
  }

  const decoded = Buffer.from(bytes).toString("utf-8");
  return decoded
    .replace(/= (?![0-9A-F]{2})/gi, " ")
    .replace(/\u00A0|\u202F|\u2009/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function looksLikeQuotedPrintable(input: string): boolean {
  return /=([0-9A-F]{2})/i.test(input) && /=(?:\r?\n|[0-9A-F]{2})/i.test(input);
}

function getTransferEncoding(headers: string): string {
  return (getHeader(headers, "Content-Transfer-Encoding") ?? "7bit")
    .toLowerCase()
    .trim();
}

function decodeBodyContent(headers: string, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";

  const encoding = getTransferEncoding(headers);

  if (encoding === "base64") {
    try {
      return Buffer.from(trimmed.replace(/\s/g, ""), "base64").toString("utf-8");
    } catch {
      return trimmed;
    }
  }

  if (encoding === "quoted-printable" || encoding === "qp") {
    return decodeQuotedPrintable(trimmed);
  }

  if (looksLikeQuotedPrintable(trimmed)) {
    return decodeQuotedPrintable(trimmed);
  }

  return trimmed;
}

/** Decode quoted-printable artifacts in stored/displayed inbound text. */
export function decodeInboundBodyText(text: string | null | undefined): string {
  if (!text?.trim()) return text ?? "";
  if (!looksLikeQuotedPrintable(text)) return text;
  return decodeQuotedPrintable(text);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMultipartBody(
  body: string,
  boundary: string,
): { text: string; html: string | null } {
  const parts = body.split(`--${boundary}`);
  let text = "";
  let html: string | null = null;

  for (const part of parts) {
    if (!part.trim() || part.startsWith("--")) continue;
    const partHeaderEnd = part.search(/\r?\n\r?\n/);
    const partHeaders =
      partHeaderEnd >= 0 ? part.slice(0, partHeaderEnd) : "";
    const partBody =
      partHeaderEnd >= 0
        ? part.slice(partHeaderEnd).replace(/^\r?\n\r?\n/, "")
        : part;
    const contentType = getHeader(partHeaders, "Content-Type") ?? "";
    const nestedBoundary = contentType.match(/boundary="?([^";\s]+)"?/i)?.[1];

    if (nestedBoundary) {
      const nested = parseMultipartBody(partBody, nestedBoundary);
      if (!text && nested.text) text = nested.text;
      if (!html && nested.html) html = nested.html;
      continue;
    }

    if (contentType.includes("text/plain") && !text) {
      text = decodeBodyContent(partHeaders, partBody);
    } else if (contentType.includes("text/html") && !html) {
      html = decodeBodyContent(partHeaders, partBody);
    }
  }

  return { text, html };
}

export type ParsedInboundEmail = {
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
};

export function parseRawEmail(raw: string): ParsedInboundEmail {
  const normalized = raw.replace(/\r\n/g, "\n");
  const headerEnd = normalized.search(/\n\n/);
  const headerBlock = headerEnd >= 0 ? normalized.slice(0, headerEnd) : normalized;
  const bodyBlock =
    headerEnd >= 0 ? normalized.slice(headerEnd + 2) : "";

  const from = parseMailbox(getHeader(headerBlock, "From"));
  const toEmail =
    extractFirstEmail(getHeader(headerBlock, "To")) ||
    extractFirstEmail(getHeader(headerBlock, "Delivered-To")) ||
    extractFirstEmail(getHeader(headerBlock, "Envelope-To")) ||
    extractFirstEmail(getHeader(headerBlock, "X-Original-To")) ||
    extractFirstEmail(getHeader(headerBlock, "X-Forwarded-To"));

  const subject = decodeMimeWords(getHeader(headerBlock, "Subject") ?? "(No subject)");
  const messageId = getHeader(headerBlock, "Message-ID");
  const inReplyTo = getHeader(headerBlock, "In-Reply-To");
  const references = getHeader(headerBlock, "References");

  const contentType = getHeader(headerBlock, "Content-Type") ?? "";
  const boundary = contentType.match(/boundary="?([^";\s]+)"?/i)?.[1];

  let bodyText = "";
  let bodyHtml: string | null = null;

  if (boundary) {
    const parsed = parseMultipartBody(bodyBlock, boundary);
    bodyText = parsed.text;
    bodyHtml = parsed.html;
  } else if (contentType.includes("text/html")) {
    bodyHtml = decodeBodyContent(headerBlock, bodyBlock);
    bodyText = stripHtml(bodyHtml);
  } else {
    bodyText = decodeBodyContent(headerBlock, bodyBlock);
  }

  bodyText = decodeInboundBodyText(bodyText);
  if (bodyHtml) {
    bodyHtml = decodeInboundBodyText(bodyHtml);
  }

  if (!bodyText && bodyHtml) {
    bodyText = stripHtml(bodyHtml);
  }

  return {
    fromEmail: from.email,
    fromName: from.name,
    toEmail,
    subject,
    bodyText,
    bodyHtml,
    messageId,
    inReplyTo,
    references,
  };
}

export function collectReferenceMessageIds(
  inReplyTo: string | null,
  references: string | null,
): string[] {
  const ids: string[] = [];
  const add = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (trimmed && !ids.includes(trimmed)) ids.push(trimmed);
  };

  add(inReplyTo);
  if (references?.trim()) {
    for (const id of references.trim().split(/\s+/)) add(id);
  }

  return ids.reverse();
}

export function pickInReplyToId(
  inReplyTo: string | null,
  references: string | null,
): string | null {
  if (inReplyTo?.trim()) return inReplyTo.trim();
  if (!references?.trim()) return null;
  const ids = references.trim().split(/\s+/);
  return ids[ids.length - 1] ?? null;
}
