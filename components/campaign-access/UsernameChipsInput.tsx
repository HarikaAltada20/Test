"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { FileUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseUsernameCsv, parseUsernames } from "@/lib/campaign-access";

type Props = {
  id: string;
  /** Usernames entered so far, valid and invalid, as typed (without "@"). */
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  /** Shows a button to load usernames from a CSV or text file. */
  allowFile?: boolean;
  /** Hide the valid-count / clear / upload row (parent can render its own). */
  hideFooter?: boolean;
  placeholder?: string;
  labelledBy?: string;
  accent?: "purple" | "ink";
  className?: string;
};

/** Adds tokens to the list, dropping "@" and case-insensitive duplicates. */
function merge(current: string[], incoming: string[]): string[] {
  const seen = new Set(current.map((n) => n.toLowerCase()));
  const next = [...current];
  for (const raw of incoming) {
    const name = raw.trim().replace(/^@+/, "");
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    next.push(name);
  }
  return next;
}

/**
 * Username entry as removable chips. Typing a comma, space or Enter, pasting a
 * list, or loading a file turns the text into chips; invalid names are shown in red.
 */
export function UsernameChipsInput({
  id,
  value,
  onChange,
  disabled,
  allowFile,
  hideFooter,
  placeholder = "Type or paste usernames",
  labelledBy,
  accent = "purple",
  className,
}: Props) {
  const ink = accent === "ink";
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { invalid } = parseUsernames(value);
  const invalidSet = new Set(invalid.map((n) => n.toLowerCase()));
  const validCount = value.length - invalidSet.size;
  const showFooter = !hideFooter;

  const commit = (text: string) => {
    const tokens = text.split(/[\s,;]+/).filter(Boolean);
    if (tokens.length) onChange(merge(value, tokens));
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " " || e.key === ";") {
      // Never let Enter submit a surrounding form (e.g. the campaign editor).
      e.preventDefault();
      if (draft.trim()) commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (/[\s,;]/.test(text)) {
      e.preventDefault();
      commit(draft + text);
    }
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    onChange(merge(value, parseUsernameCsv(text)));
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "flex min-h-[3rem] flex-wrap items-center gap-1.5 rounded-xl border border-input bg-white px-2 py-1.5 focus-within:ring-2 dark:border-white/15 dark:bg-white/5",
          ink ? "focus-within:ring-[#1a1a1a]" : "focus-within:ring-[#7F39EC]",
          disabled && "opacity-50",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((name) => {
          const bad = invalidSet.has(name.toLowerCase());
          return (
            <span
              key={name}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                bad
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300"
                  : ink
                    ? "border-[#e6e6ea] bg-[#f3f3f5] text-[#1a1a1a] dark:border-white/20 dark:bg-white/10 dark:text-white"
                    : "border-purple-200 bg-purple-50 text-[#4A00BE] dark:border-[#7F39EC]/40 dark:bg-[#2B1159] dark:text-purple-200",
              )}
            >
              @{name}
              {bad && <span className="sr-only"> (invalid)</span>}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                disabled={disabled}
                className={cn(
                  "rounded-full p-0.5 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 dark:hover:bg-white/10",
                  ink ? "focus-visible:ring-[#1a1a1a]" : "focus-visible:ring-[#7F39EC]",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((n) => n !== name));
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <input
          id={id}
          ref={inputRef}
          aria-labelledby={labelledBy}
          aria-describedby={`${id}-count`}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
          placeholder={value.length ? "" : placeholder}
          value={draft}
          disabled={disabled}
          onChange={(e) => {
            // Mobile keyboards often skip key events, so separators are handled here too.
            const text = e.target.value;
            const lastSep = Math.max(text.lastIndexOf(","), text.lastIndexOf(" "), text.lastIndexOf(";"));
            if (lastSep === -1) {
              setDraft(text);
              return;
            }
            const done = text.slice(0, lastSep).split(/[\s,;]+/).filter(Boolean);
            if (done.length) onChange(merge(value, done));
            setDraft(text.slice(lastSep + 1));
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => draft.trim() && commit(draft)}
        />
      </div>
      {showFooter && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={`${id}-count`} className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
            {validCount} valid
            {invalidSet.size > 0 && (
              <span className="text-red-600 dark:text-red-400"> · {invalidSet.size} invalid</span>
            )}
            {value.length > 0 && (
              <>
                {" · "}
                <button
                  type="button"
                  className={cn(
                    "rounded-sm underline underline-offset-2 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 dark:hover:text-gray-200",
                    ink ? "focus-visible:ring-[#1a1a1a]" : "focus-visible:ring-[#7F39EC]",
                  )}
                  onClick={() => onChange([])}
                  disabled={disabled}
                >
                  Clear
                </button>
              </>
            )}
          </p>
          {allowFile && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => loadFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "h-8",
                  ink
                    ? "border border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#f3f3f5] dark:border-white/40 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
                    : "dark:text-gray-200 dark:hover:bg-white/10",
                )}
                disabled={disabled}
                onClick={() => fileRef.current?.click()}
              >
                <FileUp className="mr-1.5 h-4 w-4" /> Upload CSV
              </Button>
            </>
          )}
        </div>
      )}
      {hideFooter && (
        <span id={`${id}-count`} className="sr-only" aria-live="polite">
          {validCount} valid
          {invalidSet.size > 0 ? `, ${invalidSet.size} invalid` : ""}
        </span>
      )}
    </div>
  );
}
