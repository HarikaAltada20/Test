"use client";

import { cn } from "@/lib/utils";

export type BulkVideoDownloadProgressState = {
  successCount: number;
  failedCount: number;
  total: number;
};

export function BulkVideoDownloadProgress({
  successCount,
  failedCount,
  total,
  isDark = false,
  compact = false,
}: BulkVideoDownloadProgressState & {
  isDark?: boolean;
  compact?: boolean;
}) {
  const safeTotal = Math.max(0, total);
  const success = Math.max(0, successCount);
  const failed = Math.max(0, failedCount);
  const processed = Math.min(safeTotal, success + failed);
  const successPct = safeTotal > 0 ? (success / safeTotal) * 100 : 0;
  const failedPct = safeTotal > 0 ? (failed / safeTotal) * 100 : 0;

  return (
    <div className={cn("w-full min-w-[12rem] space-y-1.5", compact && "min-w-[9rem]")}>
      <div
        className={cn(
          "flex h-2 w-full overflow-hidden rounded-full",
          isDark ? "bg-white/15" : "bg-slate-200 dark:bg-white/15",
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeTotal || 1}
        aria-valuenow={processed}
        aria-label="Video download progress"
      >
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${successPct}%` }}
        />
        <div
          className="h-full bg-red-500 transition-all duration-300"
          style={{ width: `${failedPct}%` }}
        />
      </div>
      <p
        className={cn(
          "flex flex-wrap gap-x-2 text-xs",
          compact ? "justify-between" : "gap-3",
          isDark ? "text-slate-300" : "text-slate-600 dark:text-slate-400",
        )}
      >
        <span className="text-emerald-600 dark:text-emerald-400">
          {success} succeeded
        </span>
        <span className="text-red-600 dark:text-red-400">{failed} failed</span>
        <span>
          {processed}/{safeTotal || 0}
        </span>
      </p>
    </div>
  );
}
