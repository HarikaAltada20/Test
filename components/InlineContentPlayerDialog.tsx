"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSubmissionContentPreview } from "@/hooks/use-submission-content-preview";
import { SubmissionContentPlayerSurface } from "@/components/SubmissionContentPlayerSurface";
import { isYoutubeShortUrl } from "@/lib/youtube-url";

type InlineContentPlayerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentLink: string | null;
  submissionId?: string | null;
  platform?: string | null;
  videoId?: string | null;
  videoThumbnailUrl?: string | null;
  title?: string;
  isDark?: boolean;
};

export function InlineContentPlayerDialog({
  open,
  onOpenChange,
  contentLink,
  submissionId,
  platform,
  videoId,
  videoThumbnailUrl,
  title = "Content preview",
  isDark = false,
}: InlineContentPlayerDialogProps) {
  const {
    playerLoading,
    thumbnailLoading,
    error,
    preview,
    thumbnailUrl,
    platform: resolvedPlatform,
  } = useSubmissionContentPreview({
    contentLink,
    submissionId,
    platform,
    videoId,
    videoThumbnailUrl,
    enabled: open,
  });

  const isVertical =
    resolvedPlatform === "tiktok" ||
    resolvedPlatform === "instagram" ||
    (resolvedPlatform === "youtube" && isYoutubeShortUrl(contentLink));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-3xl w-[95vw] p-0 gap-0 overflow-hidden",
          isDark ? "bg-[#1e293b] border-slate-700" : "bg-white",
        )}
      >
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className={isDark ? "text-white" : "text-slate-900"}>
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-4">
          {preview?.mode === "iframe" && preview.fallbackMessage && (
            <p
              className={cn(
                "text-xs mb-2 text-center",
                isDark ? "text-amber-300" : "text-amber-700",
              )}
            >
              {preview.fallbackMessage}
            </p>
          )}

          {error && !thumbnailUrl && !preview && (
            <p
              className={cn(
                "text-sm py-8 text-center",
                isDark ? "text-slate-300" : "text-slate-600",
              )}
            >
              {error}
            </p>
          )}

          {(thumbnailUrl || preview) && (
            <div
              className={cn(
                "relative w-full overflow-hidden rounded-lg bg-black",
                isVertical ? "aspect-[9/16] max-h-[80vh]" : "aspect-video min-h-[240px]",
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
                title={title}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
