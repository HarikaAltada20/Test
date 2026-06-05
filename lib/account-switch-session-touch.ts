const TOUCH_STORAGE_KEY = "account_switch_session_touch_at";
const TOUCH_TTL_MS = 60 * 60 * 1000;

/** Records this browser session at most once per hour. */
export function touchAccountSwitchSessionIfNeeded(): void {
  if (typeof window === "undefined") return;

  try {
    const lastRaw = sessionStorage.getItem(TOUCH_STORAGE_KEY);
    const last = lastRaw ? Number(lastRaw) : 0;
    if (Number.isFinite(last) && Date.now() - last < TOUCH_TTL_MS) {
      return;
    }
    sessionStorage.setItem(TOUCH_STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore storage errors
  }

  void fetch("/api/account-switch/sessions/touch", { method: "POST" }).catch(
    () => {},
  );
}
