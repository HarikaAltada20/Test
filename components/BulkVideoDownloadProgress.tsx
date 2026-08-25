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
    <div className="w-full space-y-2.5">
      {finished ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p
              className={cn(
                "text-sm font-semibold",
                isDark ? "text-white" : "text-slate-900",
              )}
            >
              Download complete
            </p>
            {/* <p
              className={cn(
                "text-xs",
                isDark ? "text-slate-400" : "text-slate-500",
              )}
            >
              {success} succeeded · {failed} failed · {safeTotal} videos ·{" "}
              {batches} ZIP folder{batches === 1 ? "" : "s"}
            </p> */}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <StatChip
              label="Succeeded"
              value={success}
              tone="success"
              isDark={isDark}
            />
            <StatChip
              label="Failed"
              value={failed}
              tone="danger"
              isDark={isDark}
            />
            <StatChip
              label="Total videos"
              value={safeTotal}
              tone="neutral"
              isDark={isDark}
            />
            <StatChip
              label="ZIP folders"
              value={batches}
              tone="accent"
              isDark={isDark}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-semibold",
                  isDark ? "text-white" : "text-slate-900",
                )}
              >
                {batches > 1
                  ? `ZIP batch ${currentBatch} of ${batches}`
                  : "Preparing ZIP"}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  isDark ? "text-slate-400" : "text-slate-500",
                )}
              >
                {batches > 1
                  ? `Downloading part ${currentBatch}${
                      chunkSize ? ` (up to ${chunkSize} videos)` : ""
                    }`
                  : `${processed} of ${safeTotal} videos processed`}
              </p>
            </div>
            <div
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums shrink-0",
                isDark
                  ? "bg-purple-500/20 text-purple-200"
                  : "bg-purple-100 text-purple-700",
              )}
            >
              {overallPct}%
            </div>
          </div>

          {batches > 1 && (
            <div className="space-y-1.5">
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
                  {currentBatch} / {batches}
                </span>
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: batches }, (_, index) => {
                  const part = index + 1;
                  const isDone = part < currentBatch;
                  const isActive = part === currentBatch;
                  const batchSize = Math.max(1, chunkSize || 0);
                  const batchStart = (part - 1) * batchSize;
                  const inBatchDone = isActive
                    ? Math.max(
                        0,
                        Math.min(batchSize, processed - batchStart),
                      )
                    : 0;
                  const activeFillPct = isActive
                    ? Math.min(100, (inBatchDone / batchSize) * 100)
                    : 0;
                  return (
                    <div
                      key={part}
                      title={`ZIP part ${part}`}
                      className={cn(
                        "relative h-2.5 flex-1 overflow-hidden rounded-full",
                        isDark ? "bg-white/15" : "bg-slate-200",
                      )}
                    >
                      {isDone && (
                        <div className="absolute inset-0 bg-emerald-500" />
                      )}
                      {isActive && (
                        <div
                          className={cn(
                            "absolute inset-y-0 left-0 transition-all duration-300",
                            isDark
                              ? "bg-purple-400 animate-pulse"
                              : "bg-purple-500 animate-pulse",
                          )}
                          style={{ width: `${Math.max(8, activeFillPct)}%` }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
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
                "flex h-2.5 w-full overflow-hidden rounded-full",
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

          <div className="grid grid-cols-3 gap-1.5">
            <StatChip
              label="Succeeded"
              value={success}
              tone="success"
              isDark={isDark}
            />
            <StatChip
              label="Failed"
              value={failed}
              tone="danger"
              isDark={isDark}
            />
            <StatChip
              label="Remaining"
              value={remaining}
              tone="neutral"
              isDark={isDark}
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
  isDark,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "neutral" | "accent";
  isDark: boolean;
}) {
  const styles =
    tone === "success"
      ? isDark
        ? "border-emerald-500/30 bg-emerald-500/10"
        : "border-emerald-200 bg-emerald-50"
      : tone === "danger"
        ? isDark
          ? "border-red-500/30 bg-red-500/10"
          : "border-red-200 bg-red-50"
        : tone === "accent"
          ? isDark
            ? "border-purple-500/30 bg-purple-500/10"
            : "border-purple-200 bg-purple-50"
          : isDark
            ? "border-slate-500/30 bg-white/5"
            : "border-slate-200 bg-white";

  const labelStyles =
    tone === "success"
      ? isDark
        ? "text-emerald-300/80"
        : "text-emerald-700/80"
      : tone === "danger"
        ? isDark
          ? "text-red-300/80"
          : "text-red-700/80"
        : tone === "accent"
          ? isDark
            ? "text-purple-300/80"
            : "text-purple-700/80"
          : isDark
            ? "text-slate-400"
            : "text-slate-500";

  const valueStyles =
    tone === "success"
      ? isDark
        ? "text-emerald-300"
        : "text-emerald-700"
      : tone === "danger"
        ? isDark
          ? "text-red-300"
          : "text-red-700"
        : tone === "accent"
          ? isDark
            ? "text-purple-200"
            : "text-purple-800"
          : isDark
            ? "text-slate-100"
            : "text-slate-800";

  return (
    <div className={cn("rounded-md border px-2.5 py-1.5", styles)}>
      <p className={cn("text-[10px] uppercase tracking-wide", labelStyles)}>
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums leading-none",
          valueStyles,
        )}
      >
        {value}
      </p>
    </div>
  );
}
