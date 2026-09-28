"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { InlineSubmissionVideoPlayer } from "@/components/InlineSubmissionVideoPlayer";
import {
  CONTEST_DETAILED_MEDIA_HEIGHT,
  CONTEST_DETAILED_MEDIA_WIDTH,
} from "@/lib/contest-submissions-virtual-table";

type LazyInlineSubmissionVideoPlayerProps = {
  contentLink: string | null | undefined;
  submissionId: string;
  platform?: string | null;
  videoId?: string | null;
  videoThumbnailUrl?: string | null;
  isDark?: boolean;
  className?: string;
};

/** Survives virtual-row unmounts so re-entering rows render the player immediately. */
const seenSubmissionIds = new Set<string>();

/**
 * Loads submission preview API only when the row is near the viewport.
 * The tile has a fixed size so virtualized rows never change height while loading.
 */
export function LazyInlineSubmissionVideoPlayer(
  props: LazyInlineSubmissionVideoPlayerProps,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(() =>
    seenSubmissionIds.has(props.submissionId),
  );

  useEffect(() => {
    if (isVisible) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          seenSubmissionIds.add(props.submissionId);
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0.01 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible, props.submissionId]);

  return (
    <div
      ref={containerRef}
      className={cn("shrink-0", props.className)}
      style={{
        width: CONTEST_DETAILED_MEDIA_WIDTH,
        height: CONTEST_DETAILED_MEDIA_HEIGHT,
      }}
    >
      {isVisible ? (
        <InlineSubmissionVideoPlayer
          contentLink={props.contentLink}
          submissionId={props.submissionId}
          platform={props.platform}
          videoId={props.videoId}
          videoThumbnailUrl={props.videoThumbnailUrl}
          isDark={props.isDark}
          enabled={isVisible}
          fillSlot
        />
      ) : (
        <div
          className={cn(
            "h-full w-full animate-pulse rounded-xl",
            props.isDark ? "bg-slate-800" : "bg-slate-200",
          )}
        />
      )}
    </div>
  );
}
