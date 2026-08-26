"use client";

import { useState } from "react";
import { Download, FolderArchive,ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BulkVideoDownloadProgress } from "@/components/BulkVideoDownloadProgress";
import type { BulkVideoDownloadProgressState } from "@/components/BulkVideoDownloadProgress";
import { BulkVideoDownloadResultsTable } from "@/components/BulkVideoDownloadResultsTable";
import {
  buildBulkZipFileDownloadUrl,
  triggerBulkZipFileDownload,
} from "@/lib/video-download-ui";
import type { BulkVideoDownloadZipPartRef } from "@/components/BulkVideoDownloadProgressProvider";
import {
  VIDEO_FILENAME_PATTERN_LABELS,
  isVideoFilenamePattern,
  type VideoFilenamePattern,
} from "@/lib/video-download-filename";

export function BulkVideoDownloadStatusDialog({
  open,
  onOpenChange,
  isDark,
  downloading,
  progress,
  namingPattern,
  zipParts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
  downloading: boolean;
  progress: BulkVideoDownloadProgressState | null;
  namingPattern?: VideoFilenamePattern | string | null;
  zipParts?: BulkVideoDownloadZipPartRef[] | null;
}) {
  const total = progress?.total ?? 0;
  const hasResults = (progress?.results?.length ?? 0) > 0;
  const finished = !!progress?.finished && !downloading;
  const batches = Math.max(1, progress?.totalChunks || 1);
  const currentBatch = Math.min(
    batches,
    Math.max(1, progress?.chunkIndex || 1),
  );
  const pattern = isVideoFilenamePattern(namingPattern)
    ? namingPattern
    : null;
  const patternMeta = pattern ? VIDEO_FILENAME_PATTERN_LABELS[pattern] : null;
  const currentZipParts = Array.isArray(zipParts)
    ? [...zipParts].sort(
        (a, b) => (a.zipPartIndex || 0) - (b.zipPartIndex || 0),
      )
    : [];
  const [downloadingZipJobId, setDownloadingZipJobId] = useState<string | null>(
    null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} isdark={isDark}>
      <DialogContent className="sm:max-w-[980px] w-[min(980px,96vw)] z-[80] max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-2 pb-1">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                finished
                  ? isDark
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-emerald-100 text-emerald-700"
                  : isDark
                    ? "bg-purple-500/20 text-purple-200"
                    : "bg-purple-100 text-purple-700",
              )}
            >
              <Download className="h-4 w-4" />
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
                  ? "Review succeeded and failed videos below. Reopen anytime with View video summary."
                  : batches > 1
                    ? `Working on ZIP batch ${currentBatch} of ${batches}. Close anytime and reopen with View progress.`
                    : "Close anytime and keep working. Reopen with View progress."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div
          className={cn(
            "rounded-xl border p-3 sm:p-4 space-y-3",
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

          {patternMeta && (
            <div
              className={cn(
                "rounded-lg border px-3 py-2.5",
                isDark
                  ? "border-gray-600 bg-white/[0.03]"
                  : "border-slate-200 bg-white",
              )}
            >
              <p
                className={cn(
                  "text-[10px] uppercase tracking-wide",
                  isDark ? "text-slate-400" : "text-slate-500",
                )}
              >
                Naming format used
              </p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-medium",
                  isDark ? "text-slate-100" : "text-slate-900",
                )}
              >
                {patternMeta.label}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-xs font-mono truncate",
                  isDark ? "text-purple-300" : "text-purple-700",
                )}
                title={patternMeta.example}
              >
                Example: {patternMeta.example}
              </p>
            </div>
          )}

          {finished && currentZipParts.length > 0 && (
            <div className="space-y-2">
              <p
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-slate-100" : "text-slate-800",
                )}
              >
                ZIP folders ({currentZipParts.length})
              </p>
              <ul
                className={cn(
                  "rounded-lg border divide-y",
                  isDark
                    ? "border-gray-600 divide-white/10"
                    : "border-slate-200 divide-slate-200",
                )}
              >
                {currentZipParts.map((part) => {
                  const videoCount = Array.isArray(part.submissionIds)
                    ? part.submissionIds.length
                    : 0;
                  const downloadUrl = buildBulkZipFileDownloadUrl(
                    part.jobId,
                    part.zipFilename || "bulk.zip",
                  );
                  return (
                    <li
                      key={part.jobId}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <FolderArchive
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            isDark ? "text-purple-300" : "text-purple-600",
                          )}
                        />
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "truncate text-sm font-medium",
                              isDark ? "text-slate-100" : "text-slate-900",
                            )}
                            title={part.zipFilename}
                          >
                            {part.zipFilename || `ZIP part ${part.zipPartIndex}`}
                          </p>
                          <p
                            className={cn(
                              "text-xs",
                              isDark ? "text-slate-400" : "text-slate-500",
                            )}
                          >
                            Part {part.zipPartIndex}
                            {part.zipPartTotal
                              ? ` of ${part.zipPartTotal}`
                              : ""}{" "}
                            · {videoCount} video{videoCount === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={downloadingZipJobId === part.jobId}
                        onClick={() => {
                          if (downloadingZipJobId === part.jobId) return;
                          setDownloadingZipJobId(part.jobId);
                          triggerBulkZipFileDownload(downloadUrl);
                          window.setTimeout(
                            () =>
                              setDownloadingZipJobId((current) =>
                                current === part.jobId ? null : current,
                              ),
                            3000,
                          );
                        }}
                        className={cn(
                          "h-8 gap-1.5 text-xs font-medium",
                          isDark
                            ? "border-white/20 bg-white/10 text-sky-300 hover:bg-white/15 hover:text-sky-200"
                            : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
                        )}
                      >
                        <ExternalLink className="h-3 w-3 opacity-80" />
                        Open ZIP file
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {hasResults && (
            <div className="space-y-2 pt-1 border-t border-dashed border-slate-300/60 dark:border-white/10 -mx-1 sm:mx-0">
              <p
                className={cn(
                  "text-sm font-medium pt-2 px-1",
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
  const finished = !!progress.finished && !downloading;
  if (!downloading && !finished) {
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
          : `View progress (${processed}/${progress.total || 0})`
        : "View video summary"}
    </Button>
  );
}
