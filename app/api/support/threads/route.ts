import { NextRequest, NextResponse } from "next/server";
import { supportDbForUser } from "@/lib/support/supabase-for-user";
import {
  SUPPORT_RATE_LIMIT_THREADS_PER_DAY,
} from "@/lib/constants/support";
import { getAuthenticatedSupportUser } from "@/lib/support/auth";
import {
  countUserThreadsToday,
} from "@/lib/support/threads";
import { normalizeSupportBody } from "@/lib/support/validation";
import { customerSenderRole } from "@/lib/support/sender-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error, status } = await getAuthenticatedSupportUser();
  if (!user) {
    return NextResponse.json({ error }, { status });
  }

  const supabase = supportDbForUser(user);
  const { data: threads, error: listError } = await supabase
    .from("support_threads")
    .select(
      "id, user_id, user_type, status, subject, created_at, updated_at, last_message_at",
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  return NextResponse.json({ threads: threads ?? [] });
}

export async function POST(req: NextRequest) {
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

  const threadsToday = await countUserThreadsToday(supabase, user.id);
  if (threadsToday >= SUPPORT_RATE_LIMIT_THREADS_PER_DAY) {
    return NextResponse.json(
      { error: "Daily thread limit reached" },
      { status: 429 },
    );
  }

  const now = new Date().toISOString();
  const { data: thread, error: threadError } = await supabase
    .from("support_threads")
    .insert({
      user_id: user.id,
      user_type: user.user_type,
      status: "open",
      subject: body.slice(0, 120),
      created_at: now,
      updated_at: now,
      last_message_at: now,
    })
    .select()
    .single();

  if (threadError || !thread) {
    return NextResponse.json(
      { error: threadError?.message || "Failed to create thread" },
      { status: 500 },
    );
  }

  const { data: message, error: msgError } = await supabase
    .from("support_messages")
    .insert({
      thread_id: thread.id,
      sender_role: customerSenderRole(user.user_type),
      sender_user_id: user.id,
      body,
    })
    .select()
    .single();

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  return NextResponse.json({ thread, message, continued: false });
}
