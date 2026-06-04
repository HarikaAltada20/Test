import type { SupabaseClient } from "@supabase/supabase-js";
import { formatSenderRoleLabel } from "@/lib/support/sender-role";
import {
  parseLegacySupportMessageResolved,
  resolveSupportSenderDisplayName,
  type SupportThreadUser,
} from "@/lib/user-notifications/support-sender-display";

export type NotificationListRow = {
  notification_type: string;
  support_thread_id: string | null;
  message_resolved: string;
  title: string | null;
  [key: string]: unknown;
};

export type SupportSenderEnrichment = {
  sender_display_name: string;
  sender_avatar_url: string | null;
  sender_role_label: string | null;
};

function resolveThreadUser(
  users: SupportThreadUser | SupportThreadUser[] | null | undefined,
): SupportThreadUser | null {
  if (!users) return null;
  if (Array.isArray(users)) return users[0] ?? null;
  return users;
}

function messagePreview(message: string): string {
  const legacy = parseLegacySupportMessageResolved(message);
  return legacy.displayName ? legacy.preview : message;
}

/**
 * Adds sender display fields for support_user_message rows by joining
 * support_threads → users (no extra columns on user_notifications).
 */
export async function enrichSupportUserMessageNotifications<
  T extends NotificationListRow,
>(supabase: SupabaseClient, notifications: T[]): Promise<(T & Partial<SupportSenderEnrichment>)[]> {
  const needsEnrich = notifications.filter(
    (n) =>
      n.notification_type === "support_user_message" &&
      typeof n.support_thread_id === "string",
  );
  if (needsEnrich.length === 0) {
    return notifications;
  }

  const threadIds = [
    ...new Set(needsEnrich.map((n) => n.support_thread_id as string)),
  ];

  const { data: threads, error } = await supabase
    .from("support_threads")
    .select(
      "id, user_type, users!user_id ( email, username, full_name, profile_picture_url )",
    )
    .in("id", threadIds);

  if (error || !threads?.length) {
    return notifications;
  }

  const byThreadId = new Map(
    threads.map((t) => {
      const row = t as {
        id: string;
        user_type: string | null;
        users: SupportThreadUser | SupportThreadUser[] | null;
      };
      return [row.id, row] as const;
    }),
  );

  return notifications.map((n) => {
    if (
      n.notification_type !== "support_user_message" ||
      !n.support_thread_id
    ) {
      return n;
    }

    const thread = byThreadId.get(n.support_thread_id);
    if (!thread) return n;

    const user = resolveThreadUser(thread.users);
    const legacy = parseLegacySupportMessageResolved(n.message_resolved);

    return {
      ...n,
      sender_display_name: resolveSupportSenderDisplayName(user),
      sender_avatar_url: user?.profile_picture_url ?? null,
      sender_role_label: thread.user_type
        ? formatSenderRoleLabel(thread.user_type)
        : legacy.roleLabel,
      message_resolved: messagePreview(n.message_resolved),
    };
  });
}
