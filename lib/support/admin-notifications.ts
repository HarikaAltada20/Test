import { createAdminClient } from "@/utils/supabase/admin";
import { formatSenderRoleLabel } from "@/lib/support/sender-role";

function buildSupportUserMessagePreview(
  senderRole: string,
  threadUser: { email: string; username: string | null } | null,
  body: string,
): string {
  const label = formatSenderRoleLabel(senderRole);
  const who =
    threadUser?.username?.trim() ||
    threadUser?.email ||
    "User";
  const preview =
    body.length > 200 ? `${body.slice(0, 200)}...` : body;
  return `${label} · ${who}: ${preview}`;
}

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
      .select("email, username")
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

  const messageResolved = buildSupportUserMessagePreview(
    input.senderRole,
    threadUser,
    input.body,
  );

  const { error } = await db.from("user_notifications").insert({
    user_id: admin.id,
    notification_type: "support_user_message",
    support_thread_id: input.threadId,
    support_message_id: input.messageId,
    title: "New support message",
    message_resolved: messageResolved,
  });

  // Unique index on support_message_id — ignore race duplicates.
  if (error?.code === "23505") {
    return;
  }

  if (error) {
    console.error("Failed to create support admin notification:", error.message);
  }
}
