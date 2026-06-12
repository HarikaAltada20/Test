import { readFileSync } from "fs";
import { join } from "path";
import { resolveNotificationTemplate } from "@/lib/admin-notifications/template";
import type { RecipientUserRow } from "@/lib/admin-notifications/types";
import type { ContestTemplateContext } from "@/lib/admin-notifications/template";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://gameofcreators.com";

let cachedWrapper: string | null = null;

function loadEmailWrapper(): string {
  if (cachedWrapper) return cachedWrapper;
  try {
    const path = join(
      process.cwd(),
      "EMAIL_TEMPLATES",
      "campaign-notification-goc.html",
    );
    cachedWrapper = readFileSync(path, "utf-8");
    return cachedWrapper;
  } catch {
    cachedWrapper = `<!DOCTYPE html><html><body>{{BODY}}<img src="{{TRACKING_PIXEL}}" width="1" height="1" alt="" /></body></html>`;
    return cachedWrapper;
  }
}

export function wrapEmailHtml(bodyHtml: string, trackingPixelUrl: string): string {
  const wrapper = loadEmailWrapper();
  if (wrapper.includes("{{BODY}}")) {
    return wrapper
      .replace(/\{\{BODY\}\}/g, bodyHtml)
      .replace(/\{\{TRACKING_PIXEL\}\}/g, trackingPixelUrl);
  }
  const pixel = `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none" />`;
  if (wrapper.includes("</body>")) {
    return wrapper.replace("</body>", `${pixel}</body>`);
  }
  return `${wrapper}${bodyHtml}${pixel}`;
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

export function buildBulkEmailHtml(input: {
  bodyTemplate: string;
  user: RecipientUserRow;
  trackingId: string;
  contest?: ContestTemplateContext | null;
}): { subject: string; html: string } {
  const resolvedBody = resolveNotificationTemplate(
    input.bodyTemplate,
    input.user,
    "UTC",
    input.contest,
  );
  const bodyWithLinks = injectTrackedLinks(resolvedBody, input.trackingId);
  const trackingPixelUrl = `${APP_URL}/track/open/${input.trackingId}`;
  const html = wrapEmailHtml(bodyWithLinks, trackingPixelUrl);

  return { subject: "", html };
}

export function buildBulkEmailSubject(
  subjectTemplate: string,
  user: RecipientUserRow,
  contest?: ContestTemplateContext | null,
): string {
  return resolveNotificationTemplate(
    subjectTemplate,
    user,
    "UTC",
    contest,
  );
}

export function getUnsubscribeFooter(userId: string): string {
  return `<p style="font-size:12px;color:#888;margin-top:24px;">
    <a href="${APP_URL}/dashboard/settings?unsubscribe=marketing">Unsubscribe</a> from marketing emails.
  </p>`;
}
