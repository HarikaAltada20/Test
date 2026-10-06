"use client";

import { CheckCircle2, Copy, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BulkActionBar({
  count,
  skydoCount,
  total,
  allMatching,
  canSelectAllMatching,
  selectingAll,
  busy,
  onSelectAllMatching,
  onCopyEmails,
  onMarkSent,
  onMarkVerified,
  onClear,
}: {
  count: number;
  skydoCount: number;
  total: number;
  allMatching: boolean;
  canSelectAllMatching: boolean;
  selectingAll: boolean;
  busy: boolean;
  onSelectAllMatching: () => void;
  onCopyEmails: () => void;
  onMarkSent: () => void;
  onMarkVerified: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  const noSkydo = skydoCount === 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div
        role="toolbar"
        aria-label="Bulk actions"
        className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#140B3A] px-3 py-2 text-white shadow-2xl animate-in slide-in-from-bottom-4"
      >
        <div className="flex items-center gap-2 px-1 text-sm">
          <span className="font-semibold tabular-nums">
            {allMatching ? `All ${count}` : count} selected
          </span>
          {skydoCount !== count && (
            <span className="text-xs text-white/60">({skydoCount} Skydo)</span>
          )}
          {canSelectAllMatching && !allMatching && (
            <button
              type="button"
              onClick={onSelectAllMatching}
              disabled={selectingAll}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#C9A7FF] underline-offset-2 hover:underline disabled:opacity-60"
            >
              {selectingAll && <Loader2 className="h-3 w-3 animate-spin" />}
              Select all {total} matching
            </button>
          )}
        </div>
        <span className="hidden h-6 w-px bg-white/15 sm:block" aria-hidden />
        <Button
          size="sm"
          variant="ghost"
          disabled={noSkydo || busy}
          onClick={onCopyEmails}
          className="h-8 gap-1.5 text-white hover:bg-white/10 hover:text-white"
        >
          <Copy className="h-3.5 w-3.5" /> Copy emails
        </Button>
        <Button
          size="sm"
          disabled={noSkydo || busy}
          onClick={onMarkSent}
          className="h-8 gap-1.5 bg-[#7F39EC] text-white hover:bg-[#6a2fd0]"
        >
          <Send className="h-3.5 w-3.5" /> Mark email sent
        </Button>
        <Button
          size="sm"
          disabled={noSkydo || busy}
          onClick={onMarkVerified}
          className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Mark verified
        </Button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className={cn("rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
