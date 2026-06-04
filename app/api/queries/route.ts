import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supportDbForUser } from "@/lib/support/supabase-for-user";
import { normalizeSupportBody } from "@/lib/support/validation";
import {
  countUserThreadsToday,
} from "@/lib/support/threads";
import {
  SUPPORT_RATE_LIMIT_THREADS_PER_DAY,
} from "@/lib/constants/support";
import { customerSenderRole } from "@/lib/support/sender-role";
import { notifyAdminsOfUserSupportMessage } from "@/lib/support/admin-notifications";
import {
  MESSAGE_SELECT_COLUMNS,
  SUPPORT_MESSAGES_TABLE,
  mapQueryRowToMessage,
  messageInsertPayload,
} from "@/lib/support/queries-messages";

interface QueryRequestBody {
  email: string;
  query_text: string;
}

/** @deprecated Prefer POST /api/support/threads — kept for backward compatibility */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const body = (await req.json()) as QueryRequestBody;
    const { email, query_text } = body;
    const messageBody = normalizeSupportBody(query_text);

    if (!email || !messageBody) {
      return NextResponse.json(
        { success: false, error: "Missing email or query text" },
        { status: 400 },
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, user_type, email, support_chat_enabled")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    if (authUser && authUser.id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Email does not match signed-in user" },
        { status: 403 },
      );
    }

    if (user.support_chat_enabled === false) {
      return NextResponse.json(
        { success: false, error: "Support chat is disabled for your account" },
        { status: 403 },
      );
    }

    const db = supportDbForUser({
      id: user.id,
      email: user.email,
      user_type: user.user_type,
      support_chat_enabled: user.support_chat_enabled !== false,
    });

    const threadsToday = await countUserThreadsToday(db, user.id);
    if (threadsToday >= SUPPORT_RATE_LIMIT_THREADS_PER_DAY) {
      return NextResponse.json(
        { success: false, error: "Daily thread limit reached" },
        { status: 429 },
      );
    }

    const now = new Date().toISOString();
    const { data: thread, error: threadError } = await db
      .from("support_threads")
      .insert({
        user_id: user.id,
        user_type: user.user_type,
        status: "open",
        subject: messageBody.slice(0, 120),
        created_at: now,
        updated_at: now,
        last_message_at: now,
      })
      .select()
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { success: false, error: threadError?.message || "Failed to create thread" },
        { status: 500 },
      );
    }

    const { data: messageRow, error: insertError } = await db
      .from(SUPPORT_MESSAGES_TABLE)
      .insert(
        messageInsertPayload({
          thread_id: thread.id,
          sender_role: customerSenderRole(user.user_type),
          sender_user_id: user.id,
          body: messageBody,
        }),
      )
      .select(MESSAGE_SELECT_COLUMNS)
      .single();

    if (insertError || !messageRow) {
      return NextResponse.json(
        { success: false, error: insertError?.message || "Failed to create message" },
        { status: 500 },
      );
    }

    const message = mapQueryRowToMessage(messageRow);

    await notifyAdminsOfUserSupportMessage({
      messageId: message.id,
      threadId: thread.id,
      body: messageBody,
      senderRole: customerSenderRole(user.user_type),
      threadUserId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: { thread, message },
    });
  } catch (error: unknown) {
    console.error("❌ Query API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
