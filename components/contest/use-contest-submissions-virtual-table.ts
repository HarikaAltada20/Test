"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  observeWindowOffset,
  observeWindowRect,
  useWindowVirtualizer,
  windowScroll,
} from "@tanstack/react-virtual";
import {
  getVirtualTablePadding,
  getWindowScrollMargin,
  measureVirtualTableRow,
  readCssZoom,
  scaleLayoutToViewport,
  scaleViewportToLayout,
} from "@/lib/contest-submissions-virtual-table";

/** Disable the dashboard `transition: all` on spacer rows so height snaps. */
export const CONTEST_VIRTUAL_SPACER_CLASS =
  "contest-virtual-spacer hover:bg-transparent";

/**
 * Virtualize the current paginated slice using the window as the scroll parent.
 * Callers should pass the current page (25–200 rows), not the full dataset.
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
  const pageRows = enabled ? rows : [];
  const count = pageRows.length;
  const overscan = estimateSize >= 150 ? 5 : 8;

  const listRef = useRef<HTMLTableSectionElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const getItemKey = useCallback(
    (index: number) => {
      const row = pageRows[index] as
        | { id?: unknown; creator?: { id?: unknown } }
        | undefined;
      if (row && typeof row === "object") {
        if (typeof row.id === "string" || typeof row.id === "number") {
          return `id:${row.id}`;
        }
        const creatorId = row.creator?.id;
        if (typeof creatorId === "string" || typeof creatorId === "number") {
          return `creator:${creatorId}`;
        }
      }
      return index;
    },
    [pageRows],
  );

  const virtualizer = useWindowVirtualizer({
    count,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin,
    enabled: enabled && count > 0,
    // Ref callbacks run during commit; flushSync there throws.
    useFlushSync: false,
    getItemKey,
    measureElement: (element) =>
      measureVirtualTableRow(element, readCssZoom(element)),
    observeElementOffset: (instance, cb) =>
      observeWindowOffset(instance, (offset, isScrolling) => {
        cb(
          scaleViewportToLayout(offset, readCssZoom(listRef.current)),
          isScrolling,
        );
      }),
    observeElementRect: (instance, cb) =>
      observeWindowRect(instance, (rect) => {
        const zoom = readCssZoom(listRef.current);
        cb({
          width: scaleViewportToLayout(rect.width, zoom),
          height: scaleViewportToLayout(rect.height, zoom),
        });
      }),
    scrollToFn: (offset, scrollOptions, instance) => {
      windowScroll(
        scaleLayoutToViewport(offset, readCssZoom(listRef.current)),
        scrollOptions,
        instance,
      );
    },
  });

  useLayoutEffect(() => {
    const node = listRef.current;
    if (!enabled || !node) {
      setScrollMargin(0);
      return;
    }

    const update = () => {
      setScrollMargin(getWindowScrollMargin(node));
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(node);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [enabled, count, estimateSize]);

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
      key: getItemKey(index),
      lane: 0,
    }));
  }, [virtualItems, count, estimateSize, scrollMargin, getItemKey]);

  const totalSize = virtualizer.getTotalSize() || count * estimateSize;
  const { paddingTop, paddingBottom } = getVirtualTablePadding(
    itemsToRender,
    totalSize,
    scrollMargin,
  );

  const visibleRows = useMemo(() => {
    const out: Array<{
      row: T;
      submission: T;
      virtualIndex: number;
      size: number;
      start: number;
    }> = [];
    for (const item of itemsToRender) {
      const row = pageRows[item.index];
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
  }, [itemsToRender, pageRows]);

  const measureElement = useCallback(
    (node: HTMLTableRowElement | null) => {
      queueMicrotask(() => {
        if (node && !node.isConnected) return;
        virtualizer.measureElement(node);
      });
    },
    [virtualizer],
  );

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
    listRef,
    scrollRef: listRef,
    virtualizer,
    visibleRows,
    paddingTop,
    paddingBottom,
    totalRowCount: count,
    scrollToStart,
    measureElement,
    /** Horizontal overflow only — vertical scroll stays on the window. */
    scrollClassName: "overflow-x-auto overflow-y-clip",
  };
}
