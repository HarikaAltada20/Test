import { createAdminClient } from "@/utils/supabase/admin";
import {
  buildSupportMessagePreview,
  resolveSupportSenderDisplayName,
} from "@/lib/user-notifications/support-sender-display";
import {
  userNotificationInsertTimestamps,
  userNotificationNow,
} from "@/lib/user-notifications/timestamps";

/**
 * Creates a single admin notification for a user support message.
 * Idempotent: safe to call multiple times for the same message id.
 */
export async function notifyAdminsOfUserSupportMessage(input: {
  messageId: string;
  threadId: string;
  body: string;
  senderRole: string;
  threadUserId: string;
}): Promise<void> {
  const db = createAdminClient();

  const { count: existingCount } = await db
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("support_message_id", input.messageId)
    .eq("notification_type", "support_user_message");

  if (existingCount && existingCount > 0) {
    return;
  }

  const [{ data: threadUser }, { data: admin }] = await Promise.all([
    db
      .from("users")
      .select("email, username, full_name, profile_picture_url")
      .eq("id", input.threadUserId)
      .maybeSingle(),
    db
      .from("users")
      .select("id")
      .eq("user_type", "admin")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!admin) {
    return;
  }

  const senderDisplayName = resolveSupportSenderDisplayName(threadUser);
  const messageResolved = buildSupportMessagePreview(input.body);

  const createdAt = userNotificationNow();
  const { error } = await db.from("user_notifications").insert({
    user_id: admin.id,
    notification_type: "support_user_message",
    support_thread_id: input.threadId,
    support_message_id: input.messageId,
    title: senderDisplayName,
    message_resolved: messageResolved,
    ...userNotificationInsertTimestamps(createdAt),
  });

  // Unique index on support_message_id — ignore race duplicates.
  if (error?.code === "23505") {
    return;
  }

  if (error) {
    console.error("Failed to create support admin notification:", error.message);
  }
}
