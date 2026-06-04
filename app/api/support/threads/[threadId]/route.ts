import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupportUser } from "@/lib/support/auth";
import { supportDbForUser } from "@/lib/support/supabase-for-user";
import {
  MESSAGE_SELECT_COLUMNS,
  SUPPORT_MESSAGES_TABLE,
  mapQueryRowsToMessages,
} from "@/lib/support/queries-messages";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ threadId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { threadId } = await context.params;
  const { user, error, status } = await getAuthenticatedSupportUser();
  if (!user) {
    return NextResponse.json({ error }, { status });
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
