import { resolveNotificationTemplate } from "@/lib/admin-notifications/template";
import type { RecipientUserRow } from "@/lib/admin-notifications/types";
import type { ContestTemplateContext } from "@/lib/admin-notifications/template";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://gameofcreators.com";

const DEFAULT_FROM_NAME = "Game of Creators";
const DEFAULT_REPLY_TO =
  process.env.SES_REPLY_TO?.trim() || "support@gameofcreators.com";

const MINIMAL_EMAIL_WRAPPER = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111827;background:#ffffff;">
  <div style="max-width:600px;margin:0 auto;padding:24px 20px;">
    {{BODY}}
  </div>
  <img src="{{TRACKING_PIXEL}}" width="1" height="1" alt="" style="display:none" />
</body>
</html>`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Replace non-breaking spaces (entity or character) with normal spaces. */
export function sanitizeEmailContent(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&#x0*a0;/gi, " ");
}

/** Strip editor/marketing markup so HTML resembles a personal note. */
export function stripPromotionalHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/<font[^>]*>/gi, "")
    .replace(/<\/font>/gi, "")
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "");
}

/** True when the body is short text without images/tables (Primary-friendly). */
export function isSimplePersonalContent(html: string): boolean {
  if (/<img\b/i.test(html)) return false;
  if (/<table\b/i.test(html)) return false;
  if (/<center\b/i.test(html)) return false;
  const linkCount = (html.match(/<a\b/gi) ?? []).length;
  return linkCount <= 2;
}

/** Turn plain text or partial HTML from the editor into sendable HTML. */
export function normalizeBodyHtml(body: string): string {
  const trimmed = sanitizeEmailContent(body).trim();
  if (!trimmed) return "";

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const withBreaks = escapeHtml(paragraph).replace(/\n/g, "<br />");
      return `<p style="margin:0 0 16px 0;">${withBreaks}</p>`;
    })
    .join("");
}

export function wrapEmailHtml(bodyHtml: string, trackingPixelUrl: string): string {
  return MINIMAL_EMAIL_WRAPPER.replace(/\{\{BODY\}\}/g, bodyHtml).replace(
    /\{\{TRACKING_PIXEL\}\}/g,
    trackingPixelUrl,
  );
}

export function wrapClickUrl(trackingId: string, targetUrl: string): string {
  const encoded = encodeURIComponent(targetUrl);
  return `${APP_URL}/track/click/${trackingId}?url=${encoded}`;
}

export function injectTrackedLinks(
  html: string,
  trackingId: string,
): string {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (_match, url: string) => {
      if (url.includes("/track/click/")) return `href="${url}"`;
      return `href="${wrapClickUrl(trackingId, url)}"`;
    },
  );
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getMarketingUnsubscribeUrl(userId: string): string {
  return `${APP_URL}/dashboard/settings?unsubscribe=marketing&user=${encodeURIComponent(userId)}`;
}

export function buildBulkEmailHtml(input: {
  bodyTemplate: string;
  user: RecipientUserRow;
  trackingId: string;
  contest?: ContestTemplateContext | null;
  /** When true, skip bulk marketing signals (pixel, tracked links, wrapper). */
  personalInbox?: boolean;
}): {
  subject: string;
  html: string;
  text: string;
  plainTextOnly: boolean;
} {
  const resolvedBody = resolveNotificationTemplate(
    input.bodyTemplate,
    input.user,
    "UTC",
    input.contest,
  );
  const bodyHtml = normalizeBodyHtml(resolvedBody);
  const personal = input.personalInbox !== false;

  if (personal) {
    const cleanHtml = stripPromotionalHtml(bodyHtml);
    const text = htmlToPlainText(cleanHtml);
    return {
      subject: "",
      html: cleanHtml,
      text,
      plainTextOnly: false,
    };
  }

  const trackingPixelUrl = `${APP_URL}/track/open/${input.trackingId}`;
  const html = injectTrackedLinks(
    wrapEmailHtml(bodyHtml, trackingPixelUrl),
    input.trackingId,
  );
  const text = htmlToPlainText(html);

  return { subject: "", html, text, plainTextOnly: false };
}

export function buildBulkEmailSubject(
  subjectTemplate: string,
  user: RecipientUserRow,
  contest?: ContestTemplateContext | null,
): string {
  const resolved = resolveNotificationTemplate(
    subjectTemplate,
    user,
    "UTC",
    contest,
    `${user.id}:subject`,
  );
  return sanitizeEmailContent(resolved).replace(/  +/g, " ").trim();
}

export function getUnsubscribeFooter(userId: string): string {
  const url = getMarketingUnsubscribeUrl(userId);
  return `<p style="margin:24px 0 0;font-size:12px;color:#666;">—<br><a href="${url}" style="color:#666;">Unsubscribe</a></p>`;
}

export function getUnsubscribePlainTextFooter(unsubscribeUrl: string): string {
  return `\n\n---\nUnsubscribe: ${unsubscribeUrl}`;
}

export function getBulkEmailFromName(_fromEmail?: string): string {
  const envName = process.env.SES_FROM_DISPLAY_NAME?.trim();
  if (envName) return envName;
  return DEFAULT_FROM_NAME;
}

/** Reply-To must share the From domain for DMARC alignment (avoids spam). */
export function getBulkEmailReplyTo(fromEmail?: string): string {
  const envReply = process.env.SES_REPLY_TO?.trim();
  if (!fromEmail?.includes("@")) {
    return envReply || DEFAULT_REPLY_TO;
  }

  const fromDomain = fromEmail.split("@")[1]?.toLowerCase();
  if (!fromDomain) return envReply || DEFAULT_REPLY_TO;

  if (envReply) {
    const replyDomain = envReply.split("@")[1]?.toLowerCase();
    if (replyDomain === fromDomain) return envReply;
    const local = envReply.split("@")[0]?.trim() || "support";
    return `${local}@${fromDomain}`;
  }

  return `support@${fromDomain}`;
}
