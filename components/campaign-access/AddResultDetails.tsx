"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  notFound?: string[];
  invalid?: string[];
  onDismiss?: () => void;
  className?: string;
};

/**
 * Collapsible list of usernames that could not be added, with a copy button,
 * so the toast can stay short.
 */
export function AddResultDetails({ notFound = [], invalid = [], onDismiss, className }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const total = notFound.length + invalid.length;
  if (total === 0) return null;

  const summary = [
    notFound.length ? `${notFound.length} not found` : null,
    invalid.length ? `${invalid.length} invalid` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText([...notFound, ...invalid].join(", "));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the names stay visible to copy by hand.
    }
  };

  const group = (label: string, names: string[]) =>
    names.length > 0 && (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-amber-900 dark:text-amber-200">{label}</p>
        <ul className="flex flex-wrap gap-1.5">
          {names.map((name) => (
            <li
              key={name}
              className="rounded-full border border-amber-200 bg-white px-2 py-0.5 font-mono text-xs text-gray-700 dark:border-amber-500/30 dark:bg-white/5 dark:text-gray-200"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div
      className={cn(
        "rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm dark:border-amber-500/30 dark:bg-amber-500/10",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          className="flex flex-1 items-center gap-1.5 rounded-sm text-left font-medium text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:text-amber-200"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
          {summary} · {open ? "hide" : "show"}
        </button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/20"
          onClick={copy}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {onDismiss && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Dismiss"
            className="h-7 w-7 text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/20"
            onClick={onDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-2 pl-5">
          {group("Not found", notFound)}
          {group("Invalid usernames", invalid)}
        </div>
      )}
    </div>
  );
}
