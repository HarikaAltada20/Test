"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { InlineSubmissionVideoPlayer } from "@/components/InlineSubmissionVideoPlayer";

type LazyInlineSubmissionVideoPlayerProps = {
  contentLink: string | null | undefined;
  submissionId: string;
  platform?: string | null;
  videoId?: string | null;
  videoThumbnailUrl?: string | null;
  isDark?: boolean;
  className?: string;
};

/** Loads submission preview API only when the row is near the viewport. */
export function LazyInlineSubmissionVideoPlayer(
  props: LazyInlineSubmissionVideoPlayerProps,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0.01 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={cn("min-h-[120px]", props.className)}>
      {isVisible ? (
        <InlineSubmissionVideoPlayer
          contentLink={props.contentLink}
          submissionId={props.submissionId}
          platform={props.platform}
          videoId={props.videoId}
          videoThumbnailUrl={props.videoThumbnailUrl}
          isDark={props.isDark}
          className={props.className}
          enabled={isVisible}
        />
      ) : null}
    </div>
  );
}
