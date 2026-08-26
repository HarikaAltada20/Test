"use client";

import { useEffect } from "react";
import {
  BulkVideoDownloadStatusButton,
  BulkVideoDownloadStatusDialog,
} from "@/components/BulkVideoDownloadStatusDialog";
import { useBulkVideoDownloadProgress } from "@/components/BulkVideoDownloadProgressProvider";

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
    openVideoSummary,
    hydrateForContest,
  } = useBulkVideoDownloadProgress();

  useEffect(() => {
    if (!contestId) return;
    void hydrateForContest(String(contestId));
  }, [contestId, hydrateForContest]);

  const matchesContest = !!session && session.contestId === String(contestId);
  if (!matchesContest || !progress) return null;

  const isFinished =
    !!progress.finished ||
    session.status === "finished" ||
    session.status === "failed";
  const isRunning = downloading || session.status === "running" || !isFinished;
  const summaryAlreadyViewed =
    !!session.summaryViewed || !!session.summaryViewedAt;
  // While downloading: show View progress. After finish: show View video summary
  // only until the user opens it once (persisted via summary_viewed).
  const showButton =
    !statusOpen && (isRunning || (!summaryAlreadyViewed && isFinished));

  return (
    <>
      <BulkVideoDownloadStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        isDark={isDark}
        downloading={downloading}
        progress={progress}
        namingPattern={session.namingPattern}
        zipParts={session.zipParts}
      />
      {showButton && (
        <BulkVideoDownloadStatusButton
          floating
          isDark={isDark}
          downloading={downloading || session.status === "running"}
          progress={progress}
          onClick={() => {
            if (isFinished && !downloading) {
              openVideoSummary();
            } else {
              setStatusOpen(true);
            }
          }}
        />
      )}
    </>
  );
}
