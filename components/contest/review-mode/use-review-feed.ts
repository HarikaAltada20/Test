"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const REVIEW_URL_PARAM = "review";

/** Read `?review=<submissionId>` from the current URL. */
export function readReviewParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(REVIEW_URL_PARAM);
}

/** Update `?review=` without a Next router navigation (no page re-render). */
export function writeReviewParam(submissionId: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (submissionId) url.searchParams.set(REVIEW_URL_PARAM, submissionId);
  else url.searchParams.delete(REVIEW_URL_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
}

/**
 * Snap-scrolling feed where each slide is exactly one container height.
 * The active index is derived from scrollTop, so wheel, trackpad, touch,
 * keyboard and arrow buttons all stay in sync.
 */
export function useReviewFeed({
  count,
  initialIndex,
}: {
  count: number;
  initialIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const clampIndex = useCallback(
    (index: number) => Math.max(0, Math.min(count - 1, index)),
    [count],
  );
  const [activeIndex, setActiveIndex] = useState(() =>
    clampIndex(initialIndex),
  );
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = clampIndex(initialIndex) * el.clientHeight;
    // Only on mount: later index changes come from scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = el.clientHeight || 1;
        setActiveIndex(clampIndex(Math.round(el.scrollTop / height)));
      });
    };
    const onResize = () => {
      el.scrollTop = activeIndexRef.current * el.clientHeight;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [clampIndex]);

  const goTo = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const el = containerRef.current;
      if (!el || count === 0) return;
      const target = clampIndex(index);
      el.scrollTo({ top: target * el.clientHeight, behavior });
    },
    [clampIndex, count],
  );

  const next = useCallback(
    () => goTo(activeIndexRef.current + 1),
    [goTo],
  );
  const prev = useCallback(
    () => goTo(activeIndexRef.current - 1),
    [goTo],
  );

  /** Wheel deltas forwarded from shielded embeds move one slide per gesture. */
  const wheelLockRef = useRef(0);
  const forwardWheel = useCallback(
    (deltaY: number) => {
      const now = Date.now();
      if (Math.abs(deltaY) < 4 || now - wheelLockRef.current < 450) return;
      wheelLockRef.current = now;
      if (deltaY > 0) next();
      else prev();
    },
    [next, prev],
  );

  return {
    containerRef,
    activeIndex,
    goTo,
    next,
    prev,
    forwardWheel,
  };
}
