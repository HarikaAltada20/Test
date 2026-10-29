"use client";

import { forwardRef } from "react";
import { Check, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlatformIcon } from "@/lib/platform-icons";
import { ReviewPlayer, type ReviewPlayerHandle } from "./ReviewPlayer";
import {
  buildRailMetrics,
  isVerticalReviewContent,
  resolveReviewPlatform,
} from "./review-metrics";
import type { ReviewMetricsSource, ReviewSubmission } from "./types";
import type { SubmissionDraftLink } from "@/lib/content-drafts";
import { ApprovedDraftStage, StageLabel } from "@/components/content-drafts/SubmissionDraftCompare";

const RAIL_ICONS = {
  likes: Heart,
  comments: MessageCircle,
  shares: Share2,
  views: Eye,
} as const;

type ReviewSlideProps = {
  submission: ReviewSubmission | undefined;
  metrics: ReviewMetricsSource | null;
  /** Distance from the active slide; content renders only when <= 2. */
  distance: number;
  selected: boolean;
  muted: boolean;
  playbackRate: number;
  canSeeCore: boolean;
  overlaysVisible: boolean;
  onWheelForward: (deltaY: number) => void;
  /** Only passed for the active slide. */
  onWatchedChange?: (percent: number) => void;
  onDurationChange?: (seconds: number) => void;
  /** Show this approved draft next to the clip (active slide only). */
  compareDraft?: SubmissionDraftLink | null;
};

export const ReviewSlide = forwardRef<ReviewPlayerHandle, ReviewSlideProps>(
  function ReviewSlide(
    {
      submission,
      metrics,
      distance,
      selected,
      muted,
      playbackRate,
      canSeeCore,
      overlaysVisible,
      onWheelForward,
      onWatchedChange,
      onDurationChange,
      compareDraft,
    },
    playerRef,
  ) {
    const renderContent = distance <= 2 && !!submission;

    if (!renderContent) {
      return <div className="h-full w-full snap-start snap-always" />;
    }

    const platform = resolveReviewPlatform(
      submission.platform,
      submission.contentLink,
    );
    const vertical = isVerticalReviewContent(platform, submission.contentLink, {
      title: submission.videoTitle,
      durationSeconds: metrics?.duration_seconds,
    });
    const rail = buildRailMetrics(platform, metrics ?? {}, canSeeCore);
    const handle = submission.creatorUsername || submission.creatorDisplayName;
    const showOverlays = overlaysVisible || distance !== 0;
    const comparing = distance === 0 && !!compareDraft;

    return (
      <div className="relative flex h-full w-full snap-start snap-always items-center justify-center px-2 py-2 sm:px-4 sm:py-5 lg:px-10">
        <div
          className={cn(
            "flex max-h-full items-end gap-4",
            vertical ? "h-full" : "w-full max-w-[1000px]",
            // Phones: two stages side by side, sized by width. Larger screens: by height.
            comparing && "w-full items-center justify-center gap-2 sm:items-end sm:gap-4",
            comparing && vertical && "h-auto sm:h-full sm:w-auto",
          )}
        >
          {comparing && compareDraft && (
            <ApprovedDraftStage
              link={compareDraft}
              className={cn(
                "aspect-[9/16] shrink-0",
                vertical
                  ? "w-[48%] sm:h-full sm:w-auto sm:max-w-[48%]"
                  : "w-[30%] sm:h-full sm:max-h-full sm:w-auto",
              )}
            />
          )}
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10",
              vertical
                ? comparing
                  ? "aspect-[9/16] w-[48%] sm:h-full sm:w-auto sm:max-w-[48%]"
                  : "aspect-[9/16] h-full max-w-full sm:max-w-[calc(100vw-7rem)]"
                : "aspect-video w-full max-h-full",
            )}
          >
            {comparing && (
              <StageLabel tone="post" className="left-1/2 -translate-x-1/2">
                Posted
              </StageLabel>
            )}
            <ReviewPlayer
              ref={distance === 0 ? playerRef : undefined}
              submissionId={submission.id}
              contentLink={submission.contentLink}
              platform={submission.platform}
              videoId={submission.videoId}
              videoThumbnailUrl={submission.videoThumbnailUrl}
              live={distance === 0}
              prefetch={distance === 1}
              muted={muted}
              playbackRate={playbackRate}
              onWatchedChange={onWatchedChange}
              onDurationChange={onDurationChange}
              onWheelForward={onWheelForward}
            />

            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent p-3 transition-opacity duration-300",
                showOverlays ? "opacity-100" : "opacity-0",
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/90">
                {getPlatformIcon(submission.platform, "sm")}
              </span>
              {selected && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white shadow-lg ring-2 ring-white/70">
                  <Check className="h-4 w-4" />
                </span>
              )}
            </div>

            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 z-[36] bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-12 text-white transition-opacity duration-300",
                // Instagram / TikTok players keep their own control bar at the bottom.
                platform === "youtube" ? "pb-5" : "pb-16",
                showOverlays ? "opacity-100" : "opacity-0",
              )}
            >
              {handle && (
                <p className="truncate text-sm font-bold drop-shadow">
                  @{handle.replace(/^@/, "")}
                </p>
              )}
              {submission.videoTitle && (
                <p className="mt-1 line-clamp-2 text-xs text-white/85 drop-shadow">
                  {submission.videoTitle}
                </p>
              )}
            </div>
          </div>

          <div
            className={cn(
              "hidden w-14 shrink-0 flex-col items-center gap-4 pb-4 text-white transition-opacity duration-300 sm:flex",
              showOverlays ? "opacity-100" : "opacity-60",
            )}
          >
            {rail.map((item) => {
              const Icon = RAIL_ICONS[item.key as keyof typeof RAIL_ICONS];
              return (
                <div
                  key={item.key}
                  className="flex flex-col items-center gap-1"
                  title={item.label}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                    {Icon && <Icon className="h-5 w-5" />}
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);
