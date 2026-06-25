import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { getUniboxThreadDetail } from "@/lib/admin-email/unibox";

type RouteContext = { params: Promise<{ threadId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { threadId } = await context.params;

  try {
    const detail = await getUniboxThreadDetail(threadId);
    if (!detail) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    await createAdminClient()
      .from("admin_email_unibox_threads")
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq("id", threadId);

    return NextResponse.json(detail);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load thread";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { threadId } = await context.params;

  let body: {
    isRead?: boolean;
    isStarred?: boolean;
    isArchived?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, boolean | string> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.isRead === "boolean") updates.is_read = body.isRead;
  if (typeof body.isStarred === "boolean") updates.is_starred = body.isStarred;
  if (typeof body.isArchived === "boolean") updates.is_archived = body.isArchived;

  const db = createAdminClient();
  const { error } = await db
    .from("admin_email_unibox_threads")
    .update(updates)
    .eq("id", threadId)
    .eq("is_deleted", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { threadId } = await context.params;
  const now = new Date().toISOString();
  const db = createAdminClient();

  const { error: threadError } = await db
    .from("admin_email_unibox_threads")
    .update({ is_deleted: true, updated_at: now })
    .eq("id", threadId);

  if (threadError) {
    return NextResponse.json({ error: threadError.message }, { status: 500 });
  }

  await db
    .from("admin_email_unibox_messages")
    .update({ is_deleted: true })
    .eq("thread_id", threadId);

  return NextResponse.json({ ok: true });
}
