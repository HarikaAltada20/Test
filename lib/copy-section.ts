/**
 * Text that the "Copy" buttons on a campaign page put on the clipboard.
 * Every copy carries both plain text (chat apps, notes) and simple HTML
 * (Google Docs, Notion, email), so pasting keeps headings, lists and links.
 */

export interface CopyPayload {
  text: string;
  html: string;
}

export interface CopyLinkItem {
  url: string;
  /** Shown before the link, e.g. a resource's name. */
  title?: string | null;
  /** Shown under the link, e.g. what to look for in an inspiration video. */
  note?: string | null;
}

export interface CopyLinkGroup {
  /** e.g. "YouTube, Instagram" when the campaign lists links per platform. */
  label?: string | null;
  items: CopyLinkItem[];
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Inline uploads (data: URLs) are huge and unreadable once pasted. */
export function isCopyableUrl(url: string | null | undefined): url is string {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  return trimmed !== "" && !/^data:/i.test(trimmed);
}

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/**
 * A titled list of links. Uploaded files without a usable URL keep their name
 * with "(open on the campaign page)", so nothing silently disappears.
 */
export function formatLinkListForCopy(heading: string, groups: CopyLinkGroup[]): CopyPayload {
  const textLines: string[] = [heading];
  const htmlParts: string[] = [`<h3>${escapeHtml(heading)}</h3>`];
  const nonEmpty = groups.filter((g) => g.items.length > 0);

  for (const group of nonEmpty) {
    const label = clean(group.label);
    if (label) {
      textLines.push("", `${label}:`);
      htmlParts.push(`<p><strong>${escapeHtml(label)}</strong></p>`);
    }
    const lis: string[] = [];
    group.items.forEach((item, i) => {
      const title = clean(item.title);
      const note = clean(item.note);
      const url = isCopyableUrl(item.url) ? item.url.trim() : "";
      const first = [title, url || (title ? "(open on the campaign page)" : "")]
        .filter(Boolean)
        .join(": ");
      if (!first && !note) return;
      textLines.push(`${i + 1}. ${first || note}`);
      if (first && note && note !== title) textLines.push(`   ${note}`);

      const link = url ? `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>` : "";
      const head = title
        ? `<strong>${escapeHtml(title)}</strong>${link ? `: ${link}` : url ? "" : " (open on the campaign page)"}`
        : link;
      const tail = note && note !== title ? `${head ? "<br>" : ""}${escapeHtml(note)}` : "";
      lis.push(`<li>${head}${tail}</li>`);
    });
    if (lis.length > 0) htmlParts.push(`<ol>${lis.join("")}</ol>`);
  }

  return { text: textLines.join("\n").trim(), html: htmlParts.join("") };
}

/** Plain text of rendered rich text: collapse runs of blank lines. */
export function tidyCopiedText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** One link, for the small copy button on a single row. */
export function linkCopyPayload(url: string): CopyPayload {
  const trimmed = url.trim();
  return { text: trimmed, html: `<a href="${escapeHtml(trimmed)}">${escapeHtml(trimmed)}</a>` };
}
