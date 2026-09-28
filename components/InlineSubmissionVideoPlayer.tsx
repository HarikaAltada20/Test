"use client";

import { cn } from "@/lib/utils";
import { useSubmissionContentPreview } from "@/hooks/use-submission-content-preview";
import { SubmissionContentPlayerSurface } from "@/components/SubmissionContentPlayerSurface";
import { getPlatformIcon } from "@/lib/platform-icons";

type InlineSubmissionVideoPlayerProps = {
  contentLink: string | null | undefined;
  submissionId: string;
  platform?: string | null;
  videoId?: string | null;
  videoThumbnailUrl?: string | null;
  isDark?: boolean;
  className?: string;
  /** When false, skips content-preview API fetch (e.g. until row is visible). */
  enabled?: boolean;
  /**
   * Fill a fixed-size parent tile (Detailed View). Any orientation is shown
   * uncropped over a blurred backdrop, so height never depends on orientation.
   */
  fillSlot?: boolean;
};

export function InlineSubmissionVideoPlayer({
  contentLink,
  submissionId,
  platform,
  videoId,
  videoThumbnailUrl,
  isDark = false,
  className,
  enabled = true,
  fillSlot = false,
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
    enabled,
  });

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-black border shrink-0",
        isDark ? "border-slate-700" : "border-slate-200",
        fillSlot
          ? "h-full w-full shadow-sm"
          : [
              isVertical &&
                "w-[280px] max-w-full aspect-[9/16] min-h-[420px] max-h-[560px]",
              isYoutubeLandscape &&
                "w-[360px] max-w-full min-h-[360px] aspect-video",
              !isVertical &&
                !isYoutubeLandscape &&
                "w-full min-h-[300px] aspect-video max-w-[360px]",
            ],
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
        showcase={fillSlot}
        badge={
          fillSlot && resolvedPlatform ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm">
              {getPlatformIcon(resolvedPlatform, "sm")}
            </span>
          ) : undefined
        }
      />
    </div>
  );
}
