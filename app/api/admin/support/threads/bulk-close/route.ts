import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

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
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("support_threads")
    .update({ status: "closed", updated_at: now })
    .in("id", thread_ids as string[])
    .is("deleted_at", null)
    .neq("status", "closed")
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    closed_count: data?.length ?? 0,
  });
}
