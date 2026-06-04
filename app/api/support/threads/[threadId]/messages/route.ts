import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupportUser } from "@/lib/support/auth";
import { supportDbForUser } from "@/lib/support/supabase-for-user";
import { countUserMessagesInThreadToday } from "@/lib/support/threads";
import { normalizeSupportBody } from "@/lib/support/validation";
import { customerSenderRole } from "@/lib/support/sender-role";
import { notifyAdminsOfUserSupportMessage } from "@/lib/support/admin-notifications";
import {
  MESSAGE_SELECT_COLUMNS,
  SUPPORT_MESSAGES_TABLE,
  mapQueryRowToMessage,
  messageInsertPayload,
} from "@/lib/support/queries-messages";
import {
  SUPPORT_RATE_LIMIT_MESSAGES_PER_THREAD_PER_DAY,
} from "@/lib/constants/support";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ threadId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const { threadId } = await context.params;
  const { user, error, status } = await getAuthenticatedSupportUser();
  if (!user) {
    return NextResponse.json({ error }, { status });
  }

  if (!user.support_chat_enabled) {
    return NextResponse.json(
      { error: "Support chat is disabled for your account" },
      { status: 403 },
    );
  }

  const body = normalizeSupportBody((await req.json())?.body);
  if (!body) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const supabase = supportDbForUser(user);
  const { data: thread, error: threadError } = await supabase
    .from("support_threads")
    .select("*")
    .eq("id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (threadError) {
    return NextResponse.json({ error: threadError.message }, { status: 500 });
  }
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  if (thread.status === "closed") {
    return NextResponse.json(
      {
        error:
          "This query is closed. Close this window and click Chat with us to submit a new query.",
      },
      { status: 400 },
    );
  }

  const msgCount = await countUserMessagesInThreadToday(
    supabase,
    threadId,
    user.id,
  );
  if (msgCount >= SUPPORT_RATE_LIMIT_MESSAGES_PER_THREAD_PER_DAY) {
    return NextResponse.json(
      { error: "Daily message limit reached for this thread" },
      { status: 429 },
    );
  }

  const { data: messageRow, error: msgError } = await supabase
    .from(SUPPORT_MESSAGES_TABLE)
    .insert(
      messageInsertPayload({
        thread_id: threadId,
        sender_role: customerSenderRole(user.user_type),
        sender_user_id: user.id,
        body,
      }),
    )
    .select(MESSAGE_SELECT_COLUMNS)
    .single();

  if (msgError || !messageRow) {
    return NextResponse.json({ error: msgError?.message || "Failed to create message" }, { status: 500 });
  }

  const message = mapQueryRowToMessage(messageRow);

  const { error: threadUpdateError } = await supabase
    .from("support_threads")
    .update({
      status: "open",
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);
  if (threadUpdateError) {
    return NextResponse.json({ error: threadUpdateError.message }, { status: 500 });
  }

  await notifyAdminsOfUserSupportMessage({
    messageId: message.id,
    threadId,
    body,
    senderRole: customerSenderRole(user.user_type),
    threadUserId: user.id,
  });

  return NextResponse.json({ message, thread_id: threadId });
}
