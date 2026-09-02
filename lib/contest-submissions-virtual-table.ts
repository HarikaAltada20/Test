export type VirtualTableItem = {
  start: number;
  end: number;
};

/** Convert CSS `zoom` (dashboard compact mode uses 0.85) into a positive scale. */
export function readCssZoom(element: Element | null | undefined): number {
  if (!element || typeof window === "undefined") return 1;
  let current: Element | null = element;
  while (current) {
    const raw = Number.parseFloat(
      window.getComputedStyle(current).zoom || "1",
    );
    if (Number.isFinite(raw) && raw > 0 && raw !== 1) return raw;
    current = current.parentElement;
  }
  return 1;
}

export function scaleViewportToLayout(
  viewportPx: number,
  zoom: number,
): number {
  const scale = zoom > 0 ? zoom : 1;
  return viewportPx / scale;
}

export function scaleLayoutToViewport(layoutPx: number, zoom: number): number {
  const scale = zoom > 0 ? zoom : 1;
  return layoutPx * scale;
}

/**
 * Document offset of the list start, in un-zoomed CSS pixels, so
 * useWindowVirtualizer's scrollMargin matches estimateSize / offsetHeight.
 */
export function getWindowScrollMargin(
  node: HTMLElement,
  scrollY = typeof window === "undefined" ? 0 : window.scrollY,
  zoom = readCssZoom(node),
): number {
  const top = node.getBoundingClientRect().top + scrollY;
  return scaleViewportToLayout(top, zoom);
}

/** Row height in un-zoomed CSS pixels (getBoundingClientRect is zoomed). */
export function measureVirtualTableRow(
  element: Element,
  zoom = readCssZoom(element),
): number {
  const html = element as HTMLElement;
  if (html.offsetHeight > 0) return html.offsetHeight;
  return scaleViewportToLayout(
    element.getBoundingClientRect().height,
    zoom,
  );
}

/**
 * Spacer heights for a window-virtualized table body.
 * TanStack item.start/end include scrollMargin; totalSize does not.
 */
export function getVirtualTablePadding(
  virtualItems: readonly VirtualTableItem[],
  totalSize: number,
  scrollMargin: number,
): { paddingTop: number; paddingBottom: number } {
  if (virtualItems.length === 0 || totalSize <= 0) {
    return { paddingTop: 0, paddingBottom: 0 };
  }
  const first = virtualItems[0];
  const last = virtualItems[virtualItems.length - 1];
  return {
    paddingTop: Math.max(0, first.start - scrollMargin),
    paddingBottom: Math.max(0, totalSize - (last.end - scrollMargin)),
  };
}
