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

function parseMailbox(value: string | null): { email: string; name: string | null } {
  if (!value) return { email: "", name: null };
  const decoded = decodeMimeWords(value);
  const angle = decoded.match(/<([^>]+)>/);
  if (angle) {
    const email = angle[1].trim().toLowerCase();
    const name = decoded.replace(/<[^>]+>/, "").replace(/"/g, "").trim();
    return { email, name: name || null };
  }
  const email = decoded.trim().toLowerCase();
  return { email, name: null };
}

function extractFirstEmail(value: string | null): string {
  const { email } = parseMailbox(value);
  return email;
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
      text = partBody.trim();
    } else if (contentType.includes("text/html") && !html) {
      html = partBody.trim();
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
    extractFirstEmail(getHeader(headerBlock, "Envelope-To"));

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
    bodyHtml = bodyBlock.trim();
    bodyText = stripHtml(bodyHtml);
  } else {
    bodyText = bodyBlock.trim();
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

export function pickInReplyToId(
  inReplyTo: string | null,
  references: string | null,
): string | null {
  if (inReplyTo?.trim()) return inReplyTo.trim();
  if (!references?.trim()) return null;
  const ids = references.trim().split(/\s+/);
  return ids[ids.length - 1] ?? null;
}
