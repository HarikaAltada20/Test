"use client";

import { cn } from "@/lib/utils";
import type { BulkVideoDownloadResultRow } from "@/lib/video-download-ui";

export type BulkVideoDownloadProgressState = {
  successCount: number;
  failedCount: number;
  total: number;
  results?: BulkVideoDownloadResultRow[];
  finished?: boolean;
  chunkIndex?: number;
  totalChunks?: number;
  chunkSize?: number;
};

export function BulkVideoDownloadProgress({
  successCount,
  failedCount,
  total,
  chunkIndex,
  totalChunks,
  chunkSize,
  finished = false,
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
  const remaining = Math.max(0, safeTotal - processed);
  const successPct = safeTotal > 0 ? (success / safeTotal) * 100 : 0;
  const failedPct = safeTotal > 0 ? (failed / safeTotal) * 100 : 0;
  const overallPct =
    safeTotal > 0 ? Math.round((processed / safeTotal) * 100) : 0;
  const batches = Math.max(1, totalChunks || 1);
  const currentBatch = Math.min(batches, Math.max(1, chunkIndex || 1));

  if (compact) {
    return (
      <div className="w-full min-w-[9rem] space-y-1.5">
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
            "flex flex-wrap justify-between gap-x-2 text-xs",
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

  return (
    <div className="w-full space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={cn(
              "text-sm font-semibold",
              isDark ? "text-white" : "text-slate-900",
            )}
          >
            {finished
              ? "All batches finished"
              : batches > 1
                ? `ZIP batch ${currentBatch} of ${batches}`
                : "Preparing ZIP"}
          </p>
          <p
            className={cn(
              "mt-0.5 text-xs",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            {finished
              ? `${success} succeeded · ${failed} failed · ${safeTotal} videos`
              : batches > 1
                ? `Downloading part ${currentBatch}${
                    chunkSize ? ` (up to ${chunkSize} videos)` : ""
                  }`
                : `${processed} of ${safeTotal} videos processed`}
          </p>
        </div>
        <div
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
            finished
              ? isDark
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-emerald-100 text-emerald-700"
              : isDark
                ? "bg-purple-500/20 text-purple-200"
                : "bg-purple-100 text-purple-700",
          )}
        >
          {overallPct}%
        </div>
      </div>

      {batches > 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className={isDark ? "text-slate-400" : "text-slate-500"}>
              ZIP parts
            </span>
            <span
              className={cn(
                "font-medium tabular-nums",
                isDark ? "text-slate-200" : "text-slate-700",
              )}
            >
              {finished ? batches : currentBatch} / {batches}
            </span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: batches }, (_, index) => {
              const part = index + 1;
              const isDone = finished || part < currentBatch;
              const isActive = !finished && part === currentBatch;
              return (
                <div
                  key={part}
                  title={`ZIP part ${part}`}
                  className={cn(
                    "h-2 flex-1 rounded-full transition-colors",
                    isDone
                      ? "bg-emerald-500"
                      : isActive
                        ? isDark
                          ? "bg-purple-400 animate-pulse"
                          : "bg-purple-500 animate-pulse"
                        : isDark
                          ? "bg-white/15"
                          : "bg-slate-200",
                  )}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className={isDark ? "text-slate-400" : "text-slate-500"}>
            Videos overall
          </span>
          <span
            className={cn(
              "font-medium tabular-nums",
              isDark ? "text-slate-200" : "text-slate-700",
            )}
          >
            {processed} / {safeTotal}
          </span>
        </div>
        <div
          className={cn(
            "flex h-3 w-full overflow-hidden rounded-full",
            isDark ? "bg-white/15" : "bg-slate-200",
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
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div
          className={cn(
            "rounded-lg border px-3 py-2",
            isDark
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-emerald-200 bg-emerald-50",
          )}
        >
          <p
            className={cn(
              "text-[11px] uppercase tracking-wide",
              isDark ? "text-emerald-300/80" : "text-emerald-700/80",
            )}
          >
            Succeeded
          </p>
          <p
            className={cn(
              "mt-0.5 text-lg font-semibold tabular-nums",
              isDark ? "text-emerald-300" : "text-emerald-700",
            )}
          >
            {success}
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg border px-3 py-2",
            isDark
              ? "border-red-500/30 bg-red-500/10"
              : "border-red-200 bg-red-50",
          )}
        >
          <p
            className={cn(
              "text-[11px] uppercase tracking-wide",
              isDark ? "text-red-300/80" : "text-red-700/80",
            )}
          >
            Failed
          </p>
          <p
            className={cn(
              "mt-0.5 text-lg font-semibold tabular-nums",
              isDark ? "text-red-300" : "text-red-700",
            )}
          >
            {failed}
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg border px-3 py-2",
            isDark
              ? "border-slate-500/30 bg-white/5"
              : "border-slate-200 bg-white",
          )}
        >
          <p
            className={cn(
              "text-[11px] uppercase tracking-wide",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            Remaining
          </p>
          <p
            className={cn(
              "mt-0.5 text-lg font-semibold tabular-nums",
              isDark ? "text-slate-100" : "text-slate-800",
            )}
          >
            {remaining}
          </p>
        </div>
      </div>
    </div>
  );
}
