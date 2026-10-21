import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  formatLinkListForCopy,
  isCopyableUrl,
  linkCopyPayload,
  tidyCopiedText,
} from "./copy-section";

test("inspiration links copy as a numbered list with notes", () => {
  const out = formatLinkListForCopy("Inspiration Links", [
    {
      items: [
        { url: "https://youtube.com/shorts/a", note: "Clean, premium edit" },
        { url: "https://youtube.com/shorts/b", note: "" },
      ],
    },
  ]);
  assert.equal(
    out.text,
    "Inspiration Links\n1. https://youtube.com/shorts/a\n   Clean, premium edit\n2. https://youtube.com/shorts/b",
  );
  assert.match(out.html, /<ol><li><a href="https:\/\/youtube.com\/shorts\/a">/);
});

test("resources copy as name: url, grouped by platform label", () => {
  const out = formatLinkListForCopy("Resources & Tools", [
    { label: "YouTube", items: [{ url: "https://x.com/v", title: "Full episode" }] },
    { label: "Instagram", items: [] },
  ]);
  assert.equal(out.text, "Resources & Tools\n\nYouTube:\n1. Full episode: https://x.com/v");
  assert.ok(!out.text.includes("Instagram"));
  assert.match(out.html, /<h3>Resources &amp; Tools<\/h3>/);
});

test("inline uploads keep their name but not the data URL", () => {
  const out = formatLinkListForCopy("Resources & Tools", [
    { items: [{ url: "data:image/png;base64,AAAA", title: "Logo" }] },
  ]);
  assert.equal(out.text, "Resources & Tools\n1. Logo: (open on the campaign page)");
  assert.ok(!out.html.includes("data:"));
  assert.equal(isCopyableUrl("data:image/png;base64,AA"), false);
  assert.equal(isCopyableUrl("  "), false);
  assert.equal(isCopyableUrl("https://a.b"), true);
});

test("html is escaped", () => {
  assert.equal(escapeHtml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  const out = formatLinkListForCopy("Links", [{ items: [{ url: "https://a.b/?q=<x>", note: "<b>hi</b>" }] }]);
  assert.ok(!out.html.includes("<b>"));
  assert.equal(linkCopyPayload(' https://a.b/"x" ').html, '<a href="https://a.b/&quot;x&quot;">https://a.b/&quot;x&quot;</a>');
});

test("copied rich text drops extra blank lines and nbsp", () => {
  assert.equal(tidyCopiedText("A B  \n\n\n\nC\n"), "A B\n\nC");
});
