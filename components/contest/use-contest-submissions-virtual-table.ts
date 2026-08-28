"use client";

import { useMemo, useRef } from "react";

/**
 * Contest submissions are already paginated (25–200 rows). Window
 * virtualization blanked the table on scroll: the shadcn Table wrapper
 * uses overflow-auto (a nested scrollport), the dashboard applies CSS zoom,
 * and spacer-row height was animated by a global `transition: all`.
 *
 * Render the current page in document flow so rows stay visible.
 */
export function useContestSubmissionsVirtualTable<T>(
  rows: T[],
  options: {
    estimateSize: number;
    enabled?: boolean;
  },
) {
  const enabled = options.enabled !== false;
  const estimateSize = options.estimateSize;
  const listRef = useRef<HTMLDivElement | null>(null);
  const pageRows = enabled ? rows : [];

  const visibleRows = useMemo(() => {
    return pageRows.map((row, index) => ({
      row,
      submission: row,
      virtualIndex: index,
      size: estimateSize,
      start: index * estimateSize,
    }));
  }, [pageRows, estimateSize]);

  const scrollToStart = () => {
    const el = listRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  };

  return {
    listRef,
    scrollRef: listRef,
    virtualizer: null,
    visibleRows,
    paddingTop: 0,
    paddingBottom: 0,
    totalRowCount: pageRows.length,
    scrollToStart,
    scrollClassName: "",
  };
}
