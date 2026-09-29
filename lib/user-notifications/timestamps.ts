/** ISO timestamp fields for user_notifications writes. */
export function userNotificationNow(): string {
  return new Date().toISOString();
}

export function userNotificationInsertTimestamps(
  now: string = userNotificationNow(),
) {
  return { updated_at: now };
}

export function userNotificationMarkReadPatch(
  now: string = userNotificationNow(),
) {
  return {
    is_read: true as const,
    read_at: now,
    updated_at: now,
  };
}
