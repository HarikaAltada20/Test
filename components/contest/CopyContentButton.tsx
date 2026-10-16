"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tidyCopiedText, type CopyPayload } from "@/lib/copy-section";
import { cn } from "@/lib/utils";

/** Rendered rich text as clean HTML (no classes or inline styles) plus plain text. */
export function copyPayloadFromElement(el: HTMLElement | null): CopyPayload | null {
  if (!el) return null;
  const clone = el.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll("[data-copy-skip], svg, button, script, style, img[src^='data:']")
    .forEach((n) => n.remove());
  clone.querySelectorAll("*").forEach((n) => {
    n.removeAttribute("class");
    n.removeAttribute("style");
  });
  // innerText needs a laid-out element to keep line breaks, so read it from
  // the live node with the skipped parts hidden from the text.
  const skipped = Array.from(el.querySelectorAll<HTMLElement>("[data-copy-skip]"));
  const prev = skipped.map((n) => n.style.display);
  skipped.forEach((n) => (n.style.display = "none"));
  const text = tidyCopiedText(el.innerText);
  skipped.forEach((n, i) => (n.style.display = prev[i]));
  if (!text) return null;
  return { text, html: clone.innerHTML };
}

async function writeToClipboard({ text, html }: CopyPayload): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return;
    } catch {
      // Some browsers refuse rich clipboard data; fall back to plain text.
    }
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(area);
  if (!ok) throw new Error("copy failed");
}

interface CopyContentButtonProps {
  /** What is copied, e.g. "brief"; used in the label and the toast. */
  what: string;
  getContent: () => CopyPayload | null;
  isDark?: boolean;
  /** "section" shows "Copy" next to the icon on wider screens; "item" is icon only. */
  variant?: "section" | "item";
  className?: string;
}

export function CopyContentButton({
  what,
  getContent,
  isDark,
  variant = "section",
  className,
}: CopyContentButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = getContent();
    if (!payload || !payload.text) {
      toast({ title: "Nothing to copy", description: `This ${what} is empty.` });
      return;
    }
    try {
      await writeToClipboard(payload);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
      toast({ title: `${what.charAt(0).toUpperCase()}${what.slice(1)} copied` });
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Your browser blocked the clipboard. Select the text and copy it instead.",
        variant: "destructive",
      });
    }
  };

  const Icon = copied ? Check : Copy;
  const label = copied ? "Copied" : `Copy ${what}`;

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      data-copy-skip=""
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]",
        variant === "section" ? "h-9 px-2.5" : "h-8 w-8 justify-center",
        copied
          ? isDark
            ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
            : "border-emerald-300 bg-emerald-50 text-emerald-700"
          : isDark
            ? "border-white/20 bg-white/5 text-slate-200 hover:bg-white/10"
            : "border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:bg-purple-50 hover:text-[#6C43D0]",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
      {variant === "section" ? (
        <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
      ) : null}
    </button>
  );
}
