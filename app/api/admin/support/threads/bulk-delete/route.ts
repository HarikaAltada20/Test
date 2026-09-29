import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { deleteThreads } from "@/lib/support/threads";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { thread_ids } = await req.json();
  if (!Array.isArray(thread_ids) || thread_ids.length === 0) {
    return NextResponse.json(
      { error: "thread_ids array is required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  try {
    const deleted_count = await deleteThreads(
      supabase,
      thread_ids as string[],
    );
    return NextResponse.json({ success: true, deleted_count });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
