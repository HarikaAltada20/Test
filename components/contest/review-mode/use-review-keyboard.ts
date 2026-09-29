"use client";

import { useEffect, useRef } from "react";

export type ReviewKeyboardHandlers = {
  next: () => void;
  prev: () => void;
  togglePlay: () => void;
  toggleMute: () => void;
  toggleSelect: () => void;
  approve: () => void;
  reject: () => void;
  moveToPending: () => void;
  speedUp: () => void;
  speedDown: () => void;
  /** Number keys 1-9; return false to let the key through. */
  digit: (n: number) => boolean;
  openOriginal: () => void;
  exit: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/** Moderation dialogs (quality score, rejection reason, reversal) own the keyboard while open. */
function isDialogOpen(): boolean {
  return !!document.querySelector(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
  );
}

export function useReviewKeyboard(
  handlers: ReviewKeyboardHandlers,
  enabled = true,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || isDialogOpen()) return;

      const h = handlersRef.current;
      const key = event.key.toLowerCase();
      let handled = true;
      if (/^[1-9]$/.test(key)) {
        handled = h.digit(Number(key));
      } else {
        switch (key) {
          case "arrowdown":
          case "j":
            h.next();
            break;
          case "arrowup":
          case "k":
            h.prev();
            break;
          case " ":
            h.togglePlay();
            break;
          case "m":
            h.toggleMute();
            break;
          case "s":
          case "x":
            h.toggleSelect();
            break;
          case "a":
            h.approve();
            break;
          case "r":
            h.reject();
            break;
          case "p":
            h.moveToPending();
            break;
          case ">":
          case ".":
            h.speedUp();
            break;
          case "<":
          case ",":
            h.speedDown();
            break;
          case "o":
            h.openOriginal();
            break;
          case "escape":
            h.exit();
            break;
          default:
            handled = false;
        }
      }
      if (handled) {
        event.preventDefault();
        // Otherwise Space/Enter would also activate the last clicked button.
        if (event.target instanceof HTMLButtonElement) event.target.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
