import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  MESSAGE_SELECT_COLUMNS,
  SUPPORT_MESSAGES_TABLE,
  mapQueryRowsToMessages,
} from "@/lib/support/queries-messages";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ threadId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await context.params;
  const supabase = createAdminClient();

  const { data: thread, error: threadError } = await supabase
    .from("support_threads")
    .select(
      `
      *,
      users!user_id (
        id, email, username, user_type, support_chat_enabled,
        support_chat_disabled_at
      )
    `,
    )
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    return NextResponse.json({ error: threadError.message }, { status: 500 });
  }
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const { data: messageRows, error: msgError } = await supabase
    .from(SUPPORT_MESSAGES_TABLE)
    .select(MESSAGE_SELECT_COLUMNS)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  return NextResponse.json({
    thread,
    messages: mapQueryRowsToMessages(messageRows),
  });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await context.params;
  const { status } = await req.json();

  if (!status || !["open", "replied", "closed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("support_threads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ thread: data });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await context.params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("support_threads")
    .delete()
    .eq("id", threadId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, deleted_count: 1 });
}
