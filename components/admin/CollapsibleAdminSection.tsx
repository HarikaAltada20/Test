"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Admin card with a header that opens and closes the body. Starts closed.
 * The body is not rendered (and does not load data) until opened, so nothing
 * inside is visible on screen until an admin chooses to look.
 *
 * With `storageKey`, the open/closed state is remembered in this browser.
 * Without it, the section always starts closed.
 */
export function CollapsibleAdminSection({
  title,
  description,
  icon: Icon,
  summary,
  storageKey,
  isDark,
  className,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Short text shown in the header, e.g. "4 of 4 methods on". */
  summary?: ReactNode;
  storageKey?: string;
  isDark: boolean | null;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (window.localStorage.getItem(storageKey) === "open") setOpen(true);
    } catch {
      /* storage unavailable: stay closed */
    }
  }, [storageKey]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, next ? "open" : "closed");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  };

  return (
    <section
      className={cn(
        "rounded-2xl border shadow-[0_8px_28px_-18px_rgba(26,26,26,0.28)]",
        isDark ? "border-white/10 bg-[#161616] text-white" : "border-[#ececef] bg-white text-[#1a1a1a]",
        className
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left sm:px-5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1a1a]/30",
          isDark ? "hover:bg-white/5" : "hover:bg-[#f6f6f7]"
        )}
      >
        {Icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              isDark ? "bg-white/10 text-white" : "bg-[#f3f3f5] text-[#1a1a1a]"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">{title}</span>
          {description && (
            <span className={cn("block text-xs sm:text-sm", isDark ? "text-white/55" : "text-[#6d6d75]")}>
              {description}
            </span>
          )}
        </span>
        {summary && !open && (
          <span className={cn("hidden text-xs sm:block", isDark ? "text-white/55" : "text-[#6d6d75]")}>
            {summary}
          </span>
        )}
        <span className={cn("text-xs font-medium", isDark ? "text-white/70" : "text-[#1a1a1a]")}>
          {open ? "Hide" : "Show"}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div id={bodyId} className={cn("border-t px-4 pb-4 pt-4 sm:px-5", isDark ? "border-white/10" : "border-[#ececef]")}>
          {children}
        </div>
      )}
    </section>
  );
}
