"use client";

import { useRef, useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { processingFeeExplainer } from "@/lib/payout-fees";

/**
 * (i) icon that explains the processing fee. Opens on hover with a mouse and on
 * tap or keyboard everywhere, since hover alone does not work on phones.
 */
export function ProcessingFeeInfo({ feeBps, isDark }: { feeBps: number; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hoverOpen = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Why is there a processing fee?"
          onPointerEnter={hoverOpen}
          onPointerLeave={hoverClose}
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full align-middle transition-colors",
            "focus-visible:outline-none focus-visible:ring-2",
            isDark
              ? "text-white/50 hover:text-white focus-visible:ring-[#ff7a1a]"
              : "text-gray-500 hover:text-gray-900 focus-visible:ring-[#171717]",
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "w-72 p-3 text-xs leading-relaxed",
          isDark ? "border-white/10 bg-[#161616] text-white/70" : "border-gray-200 bg-white text-gray-700"
        )}
      >
        <p className={cn("mb-1 text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>Processing fee</p>
        {processingFeeExplainer(feeBps)}
      </PopoverContent>
    </Popover>
  );
}
