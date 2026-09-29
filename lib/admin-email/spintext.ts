const SPINTEXT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /\b(hello|hi|hey|dear)\b/gi,
    replacement: "{Hello|Hi|Hey|Greetings|Dear}",
  },
  {
    pattern:
      /\b(i hope this email finds you well|hope you are doing well|hope all is well)\b/gi,
    replacement:
      "{I hope this email finds you well|Hope you are doing well|Hope all is well}",
  },
  {
    pattern:
      /\b(best regards|kind regards|sincerely|cheers)\b/gi,
    replacement: "{Best regards|Kind regards|Sincerely|Cheers|Warm regards}",
  },
  {
    pattern:
      /\b(looking forward to hearing from you|look forward to your response)\b/gi,
    replacement:
      "{Looking forward to hearing from you|Look forward to your response|Hope to hear from you soon}",
  },
];

export function applySpintextToPlainText(text: string): string {
  if (!text || /\{[^}]*\|[^}]*\}/.test(text)) return text;
  for (const { pattern, replacement } of SPINTEXT_PATTERNS) {
    if (pattern.test(text)) {
      return text.replace(pattern, replacement);
    }
  }
  return text;
}

export function applySpintextToHtml(html: string): string {
  if (!html || typeof document === "undefined") return html;
  const temp = document.createElement("div");
  temp.innerHTML = html;
  const walker = document.createTreeWalker(temp, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    if (!textNode.textContent || /\{[^}]*\|[^}]*\}/.test(textNode.textContent)) {
      continue;
    }
    textNode.textContent = applySpintextToPlainText(textNode.textContent);
  }
  return temp.innerHTML;
}
