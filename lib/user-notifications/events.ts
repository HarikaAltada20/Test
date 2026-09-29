export const NOTIFICATIONS_CHANGED_EVENT = "notifications-changed";

/** Notify the dashboard bell to refresh unread count and list (no polling). */
export function dispatchNotificationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
}
