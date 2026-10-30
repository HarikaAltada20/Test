"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FolderArchive, ExternalLink, ArrowLeft, Monitor } from "lucide-react";
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
  countBulkDownloadResultStatuses,
  triggerBulkZipFileDownload,
  type BulkVideoDownloadResultRow,
} from "@/lib/video-download-ui";
import type { BulkVideoDownloadZipPartRef } from "@/components/BulkVideoDownloadProgressProvider";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import {
  VIDEO_FILENAME_PATTERN_LABELS,
  isVideoFilenamePattern,
  type VideoFilenamePattern,
} from "@/lib/video-download-filename";
import {
  DOWNLOAD_SUMMARY_STATUS_TABS,
  countDownloadJobsByStatusTab,
  jobMatchesListStatusTab,
  sortDownloadSummaryRows,
  type DownloadSummaryStatusTab,
} from "@/lib/bulk-video-download-summary";
import {
  getDesktopDeepLinkImportUrl,
  getDesktopDownloaderInstallUrl,
} from "@/lib/goc-download/config";

function countZipPartResultStatuses(
  part: BulkVideoDownloadZipPartRef,
  results: BulkVideoDownloadResultRow[] | undefined,
): { successCount: number; failedCount: number } {
  const ids = new Set(
    Array.isArray(part.submissionIds) ? part.submissionIds : [],
  );
  if (ids.size === 0 || !results?.length) {
    return { successCount: 0, failedCount: 0 };
  }
  const partRows = results.filter((row) => ids.has(row.submissionId));
  const { successCount, failedCount } = countBulkDownloadResultStatuses(partRows);
  return { successCount, failedCount };
}

export type BulkDownloadJobListItem = {
  id: string;
  completedLabel: string;
  inProgress: boolean;
  totalCount: number;
  successCount: number;
  failedCount: number;
  sortLabel: string;
  qualityLabel: string;
  statusLabel: string;
  statusSlug?: string | null;
  source?: "cloud" | "desktop";
  deliveryMode?: string | null;
};

const JOB_LIST_PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_JOB_LIST_PAGE_SIZE = 25;

export function BulkVideoDownloadStatusDialog({
  open,
  onOpenChange,
  isDark,
  downloading,
  progress,
  namingPattern,
  zipParts,
  source,
  deliveryMode: _deliveryMode,
  jobs,
  showJobList = false,
  onBackToList,
  selectedJobId,
  onSelectJobId,
  loading = false,
  emptyMessage = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
  downloading: boolean;
  progress: BulkVideoDownloadProgressState | null;
  namingPattern?: VideoFilenamePattern | string | null;
  zipParts?: BulkVideoDownloadZipPartRef[] | null;
  source?: "cloud" | "desktop" | null;
  deliveryMode?: string | null;
  jobs?: BulkDownloadJobListItem[];
  showJobList?: boolean;
  onBackToList?: () => void;
  selectedJobId?: string | null;
  onSelectJobId?: (jobId: string) => void;
  loading?: boolean;
  emptyMessage?: string | null;
}) {
  const allRows = progress?.results ?? [];
  const isDesktopJob = source === "desktop";
  const isCloudJob = !isDesktopJob;
  const installUrl = getDesktopDownloaderInstallUrl() || "";
  const deepLinkUrl = getDesktopDeepLinkImportUrl();
  const [listStatusTab, setListStatusTab] =
    useState<DownloadSummaryStatusTab>("all");
  const [jobPage, setJobPage] = useState(1);
  const [jobPageSize, setJobPageSize] = useState(DEFAULT_JOB_LIST_PAGE_SIZE);
  const [downloadingZipJobId, setDownloadingZipJobId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setListStatusTab("all");
    setJobPage(1);
    setJobPageSize(DEFAULT_JOB_LIST_PAGE_SIZE);
  }, [open]);

  const jobStatusCounts = useMemo(
    () => countDownloadJobsByStatusTab(jobs || []),
    [jobs],
  );
  const filteredJobs = useMemo(
    () =>
      (jobs || []).filter((job) =>
        jobMatchesListStatusTab(job.statusSlug, listStatusTab),
      ),
    [jobs, listStatusTab],
  );
  const jobTotalPages = Math.max(
    1,
    Math.ceil(filteredJobs.length / Math.max(1, jobPageSize)),
  );
  useEffect(() => {
    if (jobPage > jobTotalPages) setJobPage(jobTotalPages);
  }, [jobPage, jobTotalPages]);
  const pagedJobs = useMemo(() => {
    const page = Math.min(jobPage, jobTotalPages);
    const start = (page - 1) * jobPageSize;
    return filteredJobs.slice(start, start + jobPageSize);
  }, [filteredJobs, jobPage, jobPageSize, jobTotalPages]);

  const displayRows = useMemo(
    () => sortDownloadSummaryRows(allRows, "views_desc"),
    [allRows],
  );

  const total = progress?.total ?? 0;
  const successCount = progress?.successCount ?? 0;
  const failedCount = progress?.failedCount ?? 0;
  const hasResults = displayRows.length > 0;
  const finished =
    (!!progress?.finished && !downloading) ||
    (!downloading && (!!emptyMessage || !progress));
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
  const safeJobPage = Math.min(jobPage, jobTotalPages);

  const openJobSummary = (jobId: string) => {
    onSelectJobId?.(jobId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} isdark={isDark}>
      <DialogContent
        className={cn(
          "z-[80] flex max-h-[92vh] w-[min(980px,96vw)] flex-col gap-4 overflow-y-auto rounded-2xl border p-6 sm:max-w-[980px]",
          isDark
            ? "border-white/10 bg-[#161616] text-white"
            : "border-[#ececef] bg-white text-[#1a1a1a]",
        )}
      >
        <DialogHeader className="space-y-2 pb-1">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                isDark
                  ? "bg-white/10 text-white"
                  : "bg-[#f3f3f5] text-[#1a1a1a]",
              )}
            >
              <Download className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle
                className={cn(isDark ? "text-white" : "text-gray-900")}
              >
                {showJobList
                  ? "Download summary"
                  : finished
                    ? "Download summary"
                    : "Download progress"}
              </DialogTitle>
              <DialogDescription
                className={cn(
                  "mt-1",
                  isDark ? "text-slate-400" : "text-slate-600",
                )}
              >
                {showJobList
                  ? "Filter by status, then click a card or View for the full summary."
                  : finished
                    ? isDesktopJob
                      ? "Your .gocdownload file was saved. Open it in the desktop app to download videos."
                      : "You are viewing the Download summary."
                    : batches > 1
                      ? `Working on ZIP batch ${currentBatch} of ${batches}. Close anytime and reopen with View progress.`
                      : "Close anytime and keep working. Reopen with View progress."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {showJobList ? (
          <div className="space-y-3">
            <div
              className={cn(
                "flex w-full flex-nowrap items-center gap-0.5 overflow-x-auto rounded-xl p-1",
                isDark ? "bg-white/[0.06]" : "bg-[#f5f5f5]",
              )}
            >
              {DOWNLOAD_SUMMARY_STATUS_TABS.map((tab) => {
                const selected = listStatusTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setListStatusTab(tab.id);
                      setJobPage(1);
                    }}
                    className={cn(
                      "inline-flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-[9px] px-2.5 py-1.5 text-[13px] transition-colors",
                      selected
                        ? isDark
                          ? "bg-white/10 font-semibold text-white shadow-[0px_1px_6px_0px_rgba(10,10,10,0.1)]"
                          : "bg-white font-semibold text-[#0a0a0a] shadow-[0px_1px_6px_0px_rgba(10,10,10,0.1)]"
                        : isDark
                          ? "font-medium text-slate-400 hover:text-white"
                          : "font-medium text-[#737373] hover:text-[#0a0a0a]",
                    )}
                  >
                    <span className="truncate">{tab.label}</span>
                    <span className="tabular-nums">{jobStatusCounts[tab.id]}</span>
                  </button>
                );
              })}
            </div>

            {(jobs || []).length === 0 ? (
              <p
                className={cn(
                  "py-8 text-center text-sm",
                  isDark ? "text-slate-400" : "text-slate-500",
                )}
              >
                No video downloads yet.
              </p>
            ) : filteredJobs.length === 0 ? (
              <p
                className={cn(
                  "py-8 text-center text-sm",
                  isDark ? "text-slate-400" : "text-slate-500",
                )}
              >
                No downloads for this status.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  {pagedJobs.map((job) => (
                    <div
                      key={job.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openJobSummary(job.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openJobSummary(job.id);
                        }
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors",
                        isDark
                          ? "border-white/10 bg-[#111113] hover:bg-white/5"
                          : "border-[#ececef] bg-white hover:bg-[#fafafa]",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm font-semibold",
                            isDark ? "text-white" : "text-slate-900",
                          )}
                        >
                          {job.inProgress ? "In progress" : "Downloaded at"}{" "}
                          <span
                            className={cn(
                              "font-medium",
                              isDark ? "text-slate-300" : "text-slate-600",
                            )}
                          >
                            {job.completedLabel}
                          </span>
                          {job.source === "desktop" ? (
                            <span
                              className={cn(
                                "ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                isDark
                                  ? "bg-white/10 text-white"
                                  : "bg-[#f3f3f5] text-[#1a1a1a]",
                              )}
                            >
                              Desktop
                            </span>
                          ) : null}
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]",
                            isDark ? "text-slate-300" : "text-slate-600",
                          )}
                        >
                          <span className="text-sm">
                            Videos{" "}
                            <span
                              className={cn(
                                "font-semibold tabular-nums",
                                isDark ? "text-white" : "text-slate-900",
                              )}
                            >
                              {job.totalCount}
                            </span>
                          </span>
                          <span className="text-sm">
                            Sort{" "}
                            <span
                              className={cn(
                                "font-semibold",
                                isDark ? "text-white" : "text-slate-900",
                              )}
                            >
                              {job.sortLabel}
                            </span>
                          </span>
                          <span className="text-sm">
                            Quality{" "}
                            <span
                              className={cn(
                                "font-semibold",
                                isDark ? "text-white" : "text-slate-900",
                              )}
                            >
                              {job.qualityLabel}
                            </span>
                          </span>
                          {job.source === "desktop" ? (
                            <span
                              className={
                                isDark ? "text-slate-300" : "text-[#737373]"
                              }
                            >
                              {job.totalCount} YouTube link
                              {job.totalCount === 1 ? "" : "s"} in this file
                            </span>
                          ) : (
                            <>
                              <span
                                className={
                                  isDark
                                    ? "text-emerald-300"
                                    : "text-emerald-700"
                                }
                              >
                                Succeeded {job.successCount}
                              </span>
                              <span
                                className={
                                  isDark ? "text-red-300" : "text-red-700"
                                }
                              >
                                Failed {job.failedCount}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          openJobSummary(job.id);
                        }}
                        className={cn(
                          "h-8 shrink-0 rounded-full px-3.5 text-sm font-medium shadow-none",
                          isDark
                            ? "border-white/10 bg-transparent text-white hover:bg-white/10"
                            : "border-[#e5e5e5] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7]",
                        )}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
                {filteredJobs.length > 0 && (
                  <PaginationControls
                    page={safeJobPage}
                    limit={jobPageSize}
                    total={filteredJobs.length}
                    totalPages={jobTotalPages}
                    hasNextPage={safeJobPage < jobTotalPages}
                    hasPreviousPage={safeJobPage > 1}
                    onPageChange={setJobPage}
                    onLimitChange={(limit) => {
                      setJobPageSize(limit);
                      setJobPage(1);
                    }}
                    isDark={isDark}
                    pageSizeOptions={JOB_LIST_PAGE_SIZE_OPTIONS}
                    hide200Option
                  />
                )}
              </>
            )}
          </div>
        ) : (
          <>
        {!downloading && onBackToList && (jobs?.length || 0) > 0 && (
          <button
            type="button"
            onClick={onBackToList}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium",
              isDark
                ? "text-slate-300 hover:text-white"
                : "text-[#1a1a1a] hover:text-black",
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to downloads
          </button>
        )}

        <div
          className={cn(
            "rounded-xl border p-3 sm:p-4 space-y-3",
            isDark
              ? "border-white/10 bg-white/5"
              : "border-[#ececef] bg-[#f6f6f7]",
          )}
        >
          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center py-10">
              <PageLoadingSpinner mode={isDark ? "dark" : "light"} />
            </div>
          ) : emptyMessage ? (
            <p
              className={cn(
                "py-8 text-center text-sm",
                isDark ? "text-slate-400" : "text-slate-500",
              )}
            >
              {emptyMessage}
            </p>
          ) : (
            <>
          {isDesktopJob ? (
            <div
              className={cn(
                "space-y-3 rounded-lg border p-3",
                isDark
                  ? "border-white/10 bg-white/5"
                  : "border-[#ececef] bg-white",
              )}
            >
              <div className="flex items-start gap-2.5">
                <Monitor
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isDark ? "text-slate-300" : "text-[#1a1a1a]",
                  )}
                />
                <div className="min-w-0 space-y-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isDark ? "text-slate-100" : "text-slate-900",
                    )}
                  >
                    {finished ? "Download file saved" : "Desktop download"}
                  </p>
                  <p
                    className={cn(
                      "text-xs",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    {finished
                      ? `${total} YouTube link${total === 1 ? "" : "s"} are in this .gocdownload file. Open it with Game of Creators Downloader to save videos on your computer.`
                      : "Videos download in the Game of Creators desktop app. Re-open your .gocdownload file if needed, or use the links below."}
                  </p>
                  {currentZipParts.length > 0 ? (
                    <p
                      className={cn(
                        "text-xs",
                        isDark ? "text-slate-400" : "text-slate-500",
                      )}
                    >
                      {currentZipParts.length} local archive
                      {currentZipParts.length === 1 ? "" : "s"} in this manifest
                      (saved on your computer, not as a cloud ZIP).
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {installUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    asChild
                    className={cn(
                      "h-8 gap-1.5 text-xs font-medium",
                      isDark
                        ? "rounded-full border-white/10 bg-transparent text-white hover:bg-white/10"
                        : "rounded-full border-[#e5e5e5] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7]",
                    )}
                  >
                    <a href={installUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-3 w-3 opacity-80" />
                      Get the desktop app
                    </a>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  asChild
                  className={cn(
                    "h-8 gap-1.5 text-xs font-medium",
                    isDark
                      ? "rounded-full border-white/10 bg-transparent text-white hover:bg-white/10"
                      : "rounded-full border-[#e5e5e5] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7]",
                  )}
                >
                  <a href={deepLinkUrl}>
                    <ExternalLink className="h-3 w-3 opacity-80" />
                    Open desktop app
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <BulkVideoDownloadProgress
              successCount={successCount}
              failedCount={failedCount}
              total={total}
              chunkIndex={progress?.chunkIndex}
              totalChunks={progress?.totalChunks}
              chunkSize={progress?.chunkSize}
              finished={finished}
              isDark={isDark}
            />
          )}

          {patternMeta && (
            <div
              className={cn(
                "rounded-lg border px-3 py-2.5",
                isDark
                  ? "border-white/10 bg-white/5"
                  : "border-[#ececef] bg-white",
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
                  isDark ? "text-slate-400" : "text-[#737373]",
                )}
                title={patternMeta.example}
              >
                Example: {patternMeta.example}
              </p>
            </div>
          )}

          {finished && isCloudJob && currentZipParts.length > 0 && (
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
                    ? "border-white/10 divide-white/10"
                    : "border-[#ececef] divide-[#ececef]",
                )}
              >
                {currentZipParts.map((part) => {
                  const videoCount = Array.isArray(part.submissionIds)
                    ? part.submissionIds.length
                    : 0;
                  const { successCount, failedCount } = countZipPartResultStatuses(
                    part,
                    progress?.results,
                  );
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
                            isDark ? "text-slate-300" : "text-[#1a1a1a]",
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
                            {" · "}
                            <span
                              className={
                                isDark ? "text-emerald-300" : "text-emerald-700"
                              }
                            >
                              {successCount} succeeded
                            </span>
                            {" · "}
                            <span
                              className={
                                isDark ? "text-red-300" : "text-red-600"
                              }
                            >
                              {failedCount} failed
                            </span>
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
                            ? "rounded-full border-white/10 bg-transparent text-white hover:bg-white/10"
                            : "rounded-full border-[#e5e5e5] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7]",
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

          {isCloudJob && hasResults ? (
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
                key={selectedJobId || "live"}
                rows={displayRows}
                isDark={isDark}
              />
            </div>
          ) : isCloudJob && (allRows.length > 0 || finished) ? (
            <p
              className={cn(
                "pt-2 text-center text-sm",
                isDark ? "text-slate-400" : "text-slate-500",
              )}
            >
              No videos in this download.
            </p>
          ) : null}
            </>
          )}
        </div>
          </>
        )}
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
          ? "rounded-full border-white/10 bg-[#161616] text-white hover:bg-white/10"
          : "rounded-full border-[#e5e5e5] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7]",
        floating && "fixed bottom-4 right-4 z-[75] h-10 shadow-lg px-3",
      )}
    >
      {downloading
        ? batches > 1
          ? `View progress · batch ${currentBatch}/${batches}`
          : `View progress (${processed}/${progress.total || 0})`
        : "Download summary"}
    </Button>
  );
}
