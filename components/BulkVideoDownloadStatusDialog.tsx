"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BulkVideoDownloadProgress } from "@/components/BulkVideoDownloadProgress";
import type { BulkVideoDownloadProgressState } from "@/components/BulkVideoDownloadProgress";
import { BulkVideoDownloadResultsTable } from "@/components/BulkVideoDownloadResultsTable";

export function BulkVideoDownloadStatusDialog({
  open,
  onOpenChange,
  isDark,
  downloading,
  progress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
  downloading: boolean;
  progress: BulkVideoDownloadProgressState | null;
}) {
  const total = progress?.total ?? 0;
  const hasResults = (progress?.results?.length ?? 0) > 0;
  const finished = !!progress?.finished && !downloading;
  const batches = Math.max(1, progress?.totalChunks || 1);
  const currentBatch = Math.min(
    batches,
    Math.max(1, progress?.chunkIndex || 1),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} isdark={isDark}>
      <DialogContent className="sm:max-w-[840px] z-[80] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                finished
                  ? isDark
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-emerald-100 text-emerald-700"
                  : isDark
                    ? "bg-purple-500/20 text-purple-200"
                    : "bg-purple-100 text-purple-700",
              )}
            >
              <Download className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle
                className={cn(isDark ? "text-white" : "text-gray-900")}
              >
                {finished ? "Download summary" : "Download progress"}
              </DialogTitle>
              <DialogDescription
                className={cn(
                  "mt-1",
                  isDark ? "text-slate-400" : "text-slate-600",
                )}
              >
                {finished
                  ? "Review succeeded and failed videos below. Reopen anytime with View download summary."
                  : batches > 1
                    ? `Working on ZIP batch ${currentBatch} of ${batches}. You can hide this and reopen with View download progress.`
                    : "You can hide this and keep working. Reopen with View download progress."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div
          className={cn(
            "rounded-xl border p-4 space-y-4",
            isDark
              ? "border-gray-600 bg-gradient-to-b from-[#1a0a2e] to-[#120624]"
              : "border-slate-200 bg-gradient-to-b from-white to-slate-50",
          )}
        >
          <BulkVideoDownloadProgress
            successCount={progress?.successCount ?? 0}
            failedCount={progress?.failedCount ?? 0}
            total={total}
            chunkIndex={progress?.chunkIndex}
            totalChunks={progress?.totalChunks}
            chunkSize={progress?.chunkSize}
            finished={finished}
            isDark={isDark}
          />

          {hasResults && (
            <div className="space-y-2 pt-1 border-t border-dashed border-slate-300/60 dark:border-white/10">
              <p
                className={cn(
                  "text-sm font-medium pt-3",
                  isDark ? "text-slate-100" : "text-slate-800",
                )}
              >
                Video results
              </p>
              <BulkVideoDownloadResultsTable
                rows={progress?.results ?? []}
                isDark={isDark}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={cn(
              isDark
                ? "border-gray-600 text-slate-200 hover:bg-white/5"
                : undefined,
            )}
          >
            {finished ? "Close" : "Hide"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BulkVideoDownloadStatusButton({
  isDark,
  downloading,
  progress,
  onClick,
  floating = false,
}: {
  isDark: boolean;
  downloading: boolean;
  progress: BulkVideoDownloadProgressState | null;
  onClick: () => void;
  floating?: boolean;
}) {
  if (!progress) return null;
  if (!downloading && !progress.finished && !(progress.results?.length ?? 0)) {
    return null;
  }

  const processed = Math.min(
    progress.total || 0,
    (progress.successCount || 0) + (progress.failedCount || 0),
  );
  const batches = Math.max(1, progress.totalChunks || 1);
  const currentBatch = Math.min(
    batches,
    Math.max(1, progress.chunkIndex || 1),
  );

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      className={cn(
        isDark
          ? "border-purple-500/50 bg-purple-950/40 text-purple-200 hover:bg-purple-900/50"
          : "border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100",
        floating && "fixed bottom-4 right-4 z-[75] h-10 shadow-lg px-3",
      )}
    >
      {downloading
        ? batches > 1
          ? `View progress · batch ${currentBatch}/${batches}`
          : `View download progress (${processed}/${progress.total || 0})`
        : "View download summary"}
    </Button>
  );
}
