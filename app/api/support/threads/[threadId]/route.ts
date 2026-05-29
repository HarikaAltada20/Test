import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupportUser } from "@/lib/support/auth";
import { supportDbForUser } from "@/lib/support/supabase-for-user";

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
    .is("deleted_at", null)
    .maybeSingle();

  if (threadError) {
    return NextResponse.json({ error: threadError.message }, { status: 500 });
  }
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const { data: messages, error: msgError } = await supabase
    .from("support_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  return NextResponse.json({ thread, messages: messages ?? [] });
}
