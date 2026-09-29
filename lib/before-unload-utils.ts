const SKIP_BEFORE_UNLOAD_KEY = "goviral:skip-beforeunload";
const CREATE_RETURN_STEP_KEY = "goviral:create-return-step";
const EDIT_RETURN_SCROLL_KEY = "goviral:edit-return-scroll";
const EDIT_PENDING_TOAST_KEY = "goviral:edit-pending-toast";

/** Call before intentional full-page navigation (e.g. Stripe checkout). */
export function allowNextBeforeUnload() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(SKIP_BEFORE_UNLOAD_KEY, "1");
  }
}

/** Remember create-flow step to restore after external redirect (e.g. Stripe). */
export function markCreateFlowReturnStep(step: string) {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(CREATE_RETURN_STEP_KEY, step);
  }
}

/** Read and clear the stored create-flow return step, if any. */
export function consumeCreateFlowReturnStep(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const step = sessionStorage.getItem(CREATE_RETURN_STEP_KEY);
  if (step) {
    sessionStorage.removeItem(CREATE_RETURN_STEP_KEY);
  }
  return step;
}

/** Remember to scroll edit page to bottom actions after Stripe return. */
export function markEditFlowReturnScroll() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(EDIT_RETURN_SCROLL_KEY, "1");
  }
}

/** Returns true once if edit page should scroll to bottom after return. */
export function consumeEditFlowReturnScroll(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const shouldScroll = sessionStorage.getItem(EDIT_RETURN_SCROLL_KEY) === "1";
  if (shouldScroll) {
    sessionStorage.removeItem(EDIT_RETURN_SCROLL_KEY);
  }
  return shouldScroll;
}

/** Stash a toast to show after edit page rehydrates from Stripe redirect. */
export function markEditFlowPendingToast(title: string, description: string) {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(
      EDIT_PENDING_TOAST_KEY,
      JSON.stringify({ title, description }),
    );
  }
}

/** Read and clear a pending edit-flow toast, if any. */
export function consumeEditFlowPendingToast(): {
  title: string;
  description: string;
} | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(EDIT_PENDING_TOAST_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(EDIT_PENDING_TOAST_KEY);
  try {
    return JSON.parse(raw) as { title: string; description: string };
  } catch {
    return null;
  }
}

/** Returns true once for the next beforeunload, then clears the flag. */
export function shouldSkipBeforeUnload(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  if (sessionStorage.getItem(SKIP_BEFORE_UNLOAD_KEY) === "1") {
    sessionStorage.removeItem(SKIP_BEFORE_UNLOAD_KEY);
    return true;
  }
  return false;
}
