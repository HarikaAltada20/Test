import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { normalizeSupportBody } from "@/lib/support/validation";
import {
  MESSAGE_SELECT_COLUMNS,
  SUPPORT_MESSAGES_TABLE,
  mapQueryRowToMessage,
} from "@/lib/support/queries-messages";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ threadId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const { isAdmin, user } = await verifyAdminAccess();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await context.params;
  const payload = await req.json();
  const body = normalizeSupportBody(payload?.body);
  const closeThread = payload?.close === true;
  if (!body) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("support_threads")
    .select("id, status")
    .eq("id", threadId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  if (existing.status === "closed") {
    return NextResponse.json(
      { error: "Thread is closed. Reopen it to send a reply." },
      { status: 400 },
    );
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "support_admin_reply",
    {
      p_thread_id: threadId,
      p_admin_user_id: user.id,
      p_body: body,
      p_close_thread: closeThread,
    },
  );

  if (rpcError) {
    const msg = rpcError.message || "";
    if (msg.includes("thread_closed")) {
      return NextResponse.json(
        { error: "Thread is closed. Reopen it to send a reply." },
        { status: 400 },
      );
    }
    if (msg.includes("thread_not_found") || rpcError.code === "P0002") {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    console.error("support_admin_reply error:", rpcError);
    return NextResponse.json(
      { error: "Failed to send reply. Notification may not have been created." },
      { status: 500 },
    );
  }

  const result = rpcResult as {
    message_id: string;
    notification_id: string;
    thread_id: string;
    status: string;
    last_message_at: string;
  };

  const { data: messageRow } = await supabase
    .from(SUPPORT_MESSAGES_TABLE)
    .select(MESSAGE_SELECT_COLUMNS)
    .eq("id", result.message_id)
    .single();

  const message = messageRow ? mapQueryRowToMessage(messageRow) : null;

  let finalStatus = result.status;
  if (closeThread && finalStatus !== "closed") {
    const { data: closedRow } = await supabase
      .from("support_threads")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", threadId)
      .select("status")
      .single();
    if (closedRow) finalStatus = closedRow.status;
  }

  return NextResponse.json({
    success: true,
    message,
    thread: {
      id: result.thread_id,
      status: finalStatus,
      last_message_at: result.last_message_at,
    },
    notification: {
      id: result.notification_id,
    },
  });
}
