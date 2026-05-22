"use client";

import { cn } from "@/lib/utils";
import { useSubmissionContentPreview } from "@/hooks/use-submission-content-preview";
import { SubmissionContentPlayerSurface } from "@/components/SubmissionContentPlayerSurface";

type InlineSubmissionVideoPlayerProps = {
  contentLink: string | null | undefined;
  submissionId: string;
  platform?: string | null;
  videoId?: string | null;
  videoThumbnailUrl?: string | null;
  isDark?: boolean;
  className?: string;
};

export function InlineSubmissionVideoPlayer({
  contentLink,
  submissionId,
  platform,
  videoId,
  videoThumbnailUrl,
  isDark = false,
  className,
}: InlineSubmissionVideoPlayerProps) {
  const {
    playerLoading,
    thumbnailLoading,
    error,
    preview,
    thumbnailUrl,
    platform: resolvedPlatform,
    isVertical,
    isYoutubeLandscape,
  } = useSubmissionContentPreview({
    contentLink,
    submissionId,
    platform,
    videoId,
    videoThumbnailUrl,
    enabled: true,
  });

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-black border shrink-0",
        isDark ? "border-slate-700" : "border-slate-200",
        isVertical &&
          "w-[280px] max-w-full aspect-[9/16] min-h-[420px] max-h-[560px]",
        isYoutubeLandscape &&
          "w-[360px] max-w-full min-h-[360px] aspect-video",
        !isVertical &&
          !isYoutubeLandscape &&
          "w-full min-h-[300px] aspect-video max-w-[360px]",
        className,
      )}
    >
      <SubmissionContentPlayerSurface
        thumbnailUrl={thumbnailUrl}
        thumbnailLoading={thumbnailLoading}
        preview={preview}
        platform={resolvedPlatform}
        error={error}
        playerLoading={playerLoading}
        isDark={isDark}
      />
    </div>
  );
}
