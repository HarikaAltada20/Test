import type { MouseEvent } from "react";

/** True when the user intends native browser link behavior (new tab/window, etc.). */
export function isModifiedLinkClick(event: MouseEvent): boolean {
  return (
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.button === 1
  );
}
