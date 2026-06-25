import { resolveNotificationTemplate } from "@/lib/admin-notifications/template";
import type { RecipientUserRow } from "@/lib/admin-notifications/types";
import type {
  CampaignTemplateContext,
  ContestTemplateContext,
} from "@/lib/admin-notifications/template";

/** Public base URL embedded in open pixels and click redirects (must be reachable from email clients). */
export function getEmailTrackingBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return "";
  try {
    const origin = new URL(
      raw.includes("://") ? raw : `https://${raw}`,
    ).origin;
    return origin.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function getAppUrl(): string {
  return getEmailTrackingBaseUrl();
}

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

/** True when the body is a full HTML document (template file), not editor fragments. */
export function isFullHtmlEmailTemplate(html: string): boolean {
  const trimmed = html.trim();
  return (
    /<!DOCTYPE\s+html/i.test(trimmed) ||
    /<html[\s>]/i.test(trimmed)
  );
}

export function injectTrackingPixel(html: string, trackingPixelUrl: string): string {
  const pixel = `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none" />`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return `${html}${pixel}`;
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
  return `${getAppUrl()}/track/click/${trackingId}?url=${encoded}`;
}

const LINK_HREF_RE =
  /<a\b([^>]*?\s)?href\s*=\s*(["'])(https?:\/\/[^"']+)\2([^>]*)>/gi;

export function injectTrackedLinks(
  html: string,
  trackingId: string,
): string {
  const withAnchorLinks = html.replace(
    LINK_HREF_RE,
    (_match, before, _quote, url, after) => {
      if (url.includes("/track/click/")) return _match;
      const tracked = wrapClickUrl(trackingId, url);
      return `<a${before ?? ""} href="${tracked}"${after}>`;
    },
  );

  // Wrap bare https URLs in text (editor sometimes leaves them unlinked).
  return withAnchorLinks.replace(
    /(^|[\s>])((https?:\/\/)[^\s<>"']+)/gi,
    (match, prefix, url) => {
      if (url.includes("/track/click/")) return match;
      return `${prefix}${wrapClickUrl(trackingId, url)}`;
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
  return `${getAppUrl()}/dashboard/settings?unsubscribe=marketing&user=${encodeURIComponent(userId)}`;
}

export function buildBulkEmailHtml(input: {
  bodyTemplate: string;
  user: RecipientUserRow;
  trackingId: string;
  contest?: ContestTemplateContext | null;
  campaign?: CampaignTemplateContext | null;
  /** When true, prefer Primary-friendly delivery for simple notes only. */
  personalInbox?: boolean;
}): {
  subject: string;
  html: string;
  text: string;
  plainTextOnly: boolean;
  useRaw: boolean;
} {
  const resolvedBody = resolveNotificationTemplate(
    input.bodyTemplate,
    input.user,
    "UTC",
    {
      contest: input.contest,
      campaign: input.campaign,
    },
  );
  const bodyHtml = normalizeBodyHtml(resolvedBody);
  const personal = input.personalInbox !== false;
  const trackingPixelUrl = `${getAppUrl()}/track/open/${input.trackingId}`;
  const fullTemplate = isFullHtmlEmailTemplate(bodyHtml);

  // Full HTML templates: preserve design, inject tracking + link wrapping.
  if (fullTemplate) {
    const html = injectTrackingPixel(
      injectTrackedLinks(bodyHtml, input.trackingId),
      trackingPixelUrl,
    );
    const text = htmlToPlainText(html);
    return {
      subject: "",
      html,
      text,
      plainTextOnly: false,
      useRaw: true,
    };
  }

  // Personal notes: minimal HTML wrapper with open pixel + tracked links.
  if (personal) {
    const html = injectTrackedLinks(
      wrapEmailHtml(bodyHtml, trackingPixelUrl),
      input.trackingId,
    );
    const text = htmlToPlainText(html);
    return {
      subject: "",
      html,
      text,
      plainTextOnly: false,
      useRaw: true,
    };
  }

  const html = injectTrackedLinks(
    wrapEmailHtml(bodyHtml, trackingPixelUrl),
    input.trackingId,
  );
  const text = htmlToPlainText(html);

  return {
    subject: "",
    html,
    text,
    plainTextOnly: false,
    useRaw: true,
  };
}

export function buildBulkEmailSubject(
  subjectTemplate: string,
  user: RecipientUserRow,
  options?: {
    contest?: ContestTemplateContext | null;
    campaign?: CampaignTemplateContext | null;
  },
): string {
  const resolved = resolveNotificationTemplate(
    subjectTemplate,
    user,
    "UTC",
    {
      contest: options?.contest,
      campaign: options?.campaign,
      spinSeed: `${user.id}:subject`,
    },
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
  return process.env.SES_FROM_DISPLAY_NAME?.trim() ?? "";
}

/** Reply-To must share the From domain for DMARC alignment (avoids spam). */
export function getBulkEmailReplyTo(fromEmail?: string): string {
  const envReply = process.env.SES_REPLY_TO?.trim();
  if (!fromEmail?.includes("@")) {
    return envReply || fromEmail || "";
  }

  const fromDomain = fromEmail.split("@")[1]?.toLowerCase();
  if (!fromDomain) return envReply || fromEmail || "";

  if (envReply) {
    const replyDomain = envReply.split("@")[1]?.toLowerCase();
    if (replyDomain === fromDomain) return envReply;
  }

  return fromEmail;
}
