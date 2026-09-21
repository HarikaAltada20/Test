"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkVideoDownloadStatusDialog } from "@/components/BulkVideoDownloadStatusDialog";
import {
  useBulkVideoDownloadProgress,
  type BulkVideoDownloadSession,
} from "@/components/BulkVideoDownloadProgressProvider";
import { cn } from "@/lib/utils";
import { parseBulkZipFilenamePrefix } from "@/lib/video-download-filename";
import {
  isBulkDownloadJobInProgress,
  sortBulkDownloadJobsNewestFirst,
  type BulkDownloadSummaryUserType,
  type BulkVideoDownloadJobSummary,
} from "@/lib/bulk-video-download-summary";

function liveJobSummary(
  session: BulkVideoDownloadSession,
  viewerUserType: BulkDownloadSummaryUserType | null,
): BulkVideoDownloadJobSummary | null {
  const id = session.supabaseJobId;
  if (!id) return null;
  return {
    id,
    contestId: session.contestId,
    userId: "",
    userType: session.userType || viewerUserType || "admin",
    status:
      session.status === "failed"
        ? "failed"
        : session.status === "finished"
          ? "completed"
          : "running",
    totalCount: session.progress.total || session.submissionIds.length,
    successCount: session.progress.successCount || 0,
    failedCount: session.progress.failedCount || 0,
    zipPartTotal: session.progress.totalChunks || 1,
    namingPattern: session.namingPattern,
    fileNamePrefix: session.fileNamePrefix || null,
    createdAt: new Date(session.startedAt).toISOString(),
    finishedAt: session.progress.finished ? new Date().toISOString() : null,
    source: session.source === "desktop" ? "desktop" : "cloud",
    deliveryMode: session.delivery_mode ?? null,
  };
}

function jobCompletedLabel(job: BulkVideoDownloadJobSummary): string {
  const raw = job.finishedAt || job.createdAt;
  if (!raw) return "Unknown date";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleString();
}

export function BulkVideoDownloadSummaryButton({
  isDark,
}: {
  isDark: boolean;
}) {
  const {
    session,
    progress,
    downloading,
    contestJobSummaries,
    openVideoSummary,
    setStatusOpen,
  } = useBulkVideoDownloadProgress();

  const hasHistory = contestJobSummaries.length > 0;
  const hasLive = !!session && !!progress;
  if (!hasHistory && !hasLive) return null;

  const isRunning = downloading || session?.status === "running";
  const processed = Math.min(
    progress?.total || 0,
    (progress?.successCount || 0) + (progress?.failedCount || 0),
  );

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        if (isRunning) {
          setStatusOpen(true);
        } else {
          openVideoSummary();
        }
      }}
      className={cn(
        "h-auto gap-2 rounded-2xl py-2 px-4 text-sm font-medium",
        isDark
          ? "border-purple-500/50 bg-purple-950/40 text-purple-100 hover:bg-purple-900/50"
          : "border-[#D1B7F9] bg-white text-[#4A00BE] hover:bg-purple-50",
      )}
    >
      {isRunning ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isRunning
        ? progress && progress.total > 0
          ? `View progress (${processed}/${progress.total})`
          : "View progress"
        : "Video Downloads"}
    </Button>
  );
}

/**
 * Contest-scoped download progress/summary UI.
 * Restores ZIP progress + video results from Supabase on mount/reload.
 */
export function BulkVideoDownloadContestStatus({
  contestId,
  isDark,
}: {
  contestId: string;
  isDark: boolean;
}) {
  const {
    session,
    progress,
    downloading,
    statusOpen,
    setStatusOpen,
    hydrateForContest,
    contestJobSummaries,
    viewerUserType,
    hydrateContestJobs,
    fetchJobSession,
  } = useBulkVideoDownloadProgress();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [remoteByJobId, setRemoteByJobId] = useState<
    Record<string, BulkVideoDownloadSession>
  >({});
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!contestId) return;
    void hydrateForContest(String(contestId));
    void hydrateContestJobs(String(contestId));
  }, [contestId, hydrateForContest, hydrateContestJobs]);

  const matchesContest = !!session && session.contestId === String(contestId);
  const isCloudLiveSession =
    matchesContest && (session.source ?? "cloud") !== "desktop";
  const liveRunning =
    isCloudLiveSession && (downloading || session.status === "running");
  const summaries = useMemo(() => {
    const list = contestJobSummaries.filter(
      (job) => job.contestId === String(contestId),
    );
    if (!matchesContest) return list;
    const live = liveJobSummary(session, viewerUserType);
    if (!live) return list;
    if (list.some((job) => job.id === live.id)) return list;
    return [live, ...list];
  }, [contestJobSummaries, contestId, matchesContest, session, viewerUserType]);

  const allJobs = useMemo(
    () => sortBulkDownloadJobsNewestFirst(summaries),
    [summaries],
  );
  useEffect(() => {
    if (!liveRunning) return;
    const id = session?.supabaseJobId;
    if (id) setSelectedJobId(id);
  }, [liveRunning, session?.supabaseJobId]);

  const showJobList = statusOpen && !liveRunning && !selectedJobId;
  const resolvedJobId = liveRunning
    ? session.supabaseJobId || selectedJobId
    : selectedJobId;

  const liveMatchesSelected =
    matchesContest &&
    ((liveRunning &&
      (!resolvedJobId ||
        !session.supabaseJobId ||
        session.supabaseJobId === resolvedJobId)) ||
      (!!session.supabaseJobId && session.supabaseJobId === resolvedJobId));

  useEffect(() => {
    if (!statusOpen || showJobList || !resolvedJobId || liveMatchesSelected) {
      return;
    }
    if (remoteByJobId[resolvedJobId]) return;
    let cancelled = false;
    setLoadingJobId(resolvedJobId);
    void fetchJobSession(resolvedJobId).then((restored) => {
      if (cancelled) return;
      setLoadingJobId(null);
      if (!restored) return;
      setRemoteByJobId((prev) => ({ ...prev, [resolvedJobId]: restored }));
    });
    return () => {
      cancelled = true;
    };
  }, [
    statusOpen,
    showJobList,
    resolvedJobId,
    liveMatchesSelected,
    remoteByJobId,
    fetchJobSession,
  ]);

  const displaySession = liveMatchesSelected
    ? session
    : resolvedJobId
      ? remoteByJobId[resolvedJobId] || null
      : null;
  const displayProgress = liveMatchesSelected
    ? progress
    : displaySession?.progress || null;
  const displayDownloading = liveMatchesSelected && downloading;
  const loading =
    !showJobList &&
    !!resolvedJobId &&
    !liveMatchesSelected &&
    loadingJobId === resolvedJobId &&
    !displaySession;
  const emptyMessage =
    showJobList || loading || displaySession
      ? null
      : resolvedJobId
        ? "Download not found."
        : "No video downloads yet.";

  const jobCards = allJobs.map((job) => {
    const parsed = parseBulkZipFilenamePrefix(job.fileNamePrefix);
    return {
      id: job.id,
      completedLabel: jobCompletedLabel(job),
      inProgress: isBulkDownloadJobInProgress(job),
      totalCount: job.totalCount,
      successCount: job.successCount,
      failedCount: job.failedCount,
      sortLabel: parsed.sortLabel,
      qualityLabel: parsed.qualityLabel,
      statusLabel: parsed.statusLabel,
      statusSlug: parsed.statusSlug,
      source: job.source === "desktop" ? ("desktop" as const) : ("cloud" as const),
      deliveryMode: job.deliveryMode ?? null,
    };
  });

  return (
    <BulkVideoDownloadStatusDialog
      open={statusOpen}
      onOpenChange={(open) => {
        setStatusOpen(open);
        if (!open) setSelectedJobId(null);
      }}
      isDark={isDark}
      downloading={!!displayDownloading}
      progress={displayProgress}
      namingPattern={displaySession?.namingPattern}
      zipParts={displaySession?.zipParts}
      source={displaySession?.source}
      deliveryMode={displaySession?.delivery_mode}
      jobs={jobCards}
      showJobList={showJobList}
      onBackToList={() => setSelectedJobId(null)}
      selectedJobId={resolvedJobId}
      onSelectJobId={setSelectedJobId}
      loading={loading}
      emptyMessage={emptyMessage}
    />
  );
}
