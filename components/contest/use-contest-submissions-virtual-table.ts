"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

/**
 * Virtualize an already-filtered/sorted (and usually paginated) list
 * using the window as the scroll parent so table layout matches the pre-virtual
 * design (no nested fixed-height scrollport).
 *
 * Callers should pass the current page slice — not the full dataset.
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
  const count = enabled ? rows.length : 0;

  /** Anchor at the top of the table — used for scrollMargin + scroll-into-view. */
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) {
      setScrollMargin(0);
      return;
    }
    const el = listRef.current;
    if (!el) return;

    const update = () => {
      setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [enabled, count, estimateSize]);

  const virtualizer = useWindowVirtualizer({
    count,
    estimateSize: () => estimateSize,
    overscan: 8,
    scrollMargin,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Before measure, TanStack Virtual can return []. Fall back so the tab isn't blank.
  const itemsToRender = useMemo(() => {
    if (virtualItems.length > 0) return virtualItems;
    if (count === 0) return [];
    const fallbackCount = Math.min(count, 30);
    return Array.from({ length: fallbackCount }, (_, index) => ({
      index,
      start: scrollMargin + index * estimateSize,
      size: estimateSize,
      end: scrollMargin + (index + 1) * estimateSize,
      key: index,
      lane: 0,
    }));
  }, [virtualItems, count, estimateSize, scrollMargin]);

  const totalSize = virtualizer.getTotalSize() || count * estimateSize;
  const paddingTop =
    itemsToRender.length > 0
      ? Math.max(0, itemsToRender[0]!.start - scrollMargin)
      : 0;
  const paddingBottom =
    itemsToRender.length > 0
      ? Math.max(
          0,
          totalSize -
            (itemsToRender[itemsToRender.length - 1]!.end - scrollMargin),
        )
      : 0;

  const visibleRows = useMemo(() => {
    const out: Array<{
      row: T;
      /** Alias for submission-table call sites. */
      submission: T;
      virtualIndex: number;
      size: number;
      start: number;
    }> = [];
    for (const item of itemsToRender) {
      const row = rows[item.index];
      if (row === undefined || row === null) continue;
      out.push({
        row,
        submission: row,
        virtualIndex: item.index,
        size: item.size,
        start: item.start,
      });
    }
    return out;
  }, [itemsToRender, rows]);

  const scrollToStart = () => {
    const el = listRef.current;
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 16;
      window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    }
    try {
      virtualizer.scrollToIndex(0, { align: "start" });
    } catch {
      // Virtualizer may not be ready yet.
    }
  };

  return {
    /** Attach to a zero-height (or thin) anchor immediately above the `<Table>`. */
    listRef,
    scrollRef: listRef,
    virtualizer,
    visibleRows,
    paddingTop,
    paddingBottom,
    totalRowCount: count,
    scrollToStart,
    /** No nested scrollport — keep original Table overflow behavior. */
    scrollClassName: "",
  };
}
