import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { SUPPORT_RETENTION_DAYS } from "@/lib/constants/support";
import {
  retentionCutoffDate,
  softDeleteThreadsBeforeDate,
} from "@/lib/support/threads";

export const dynamic = "force-dynamic";

function resolveBeforeDate(body: {
  before_days?: number;
  before?: string;
}): Date {
  if (body.before) {
    return new Date(body.before);
  }
  const days =
    typeof body.before_days === "number"
      ? body.before_days
      : SUPPORT_RETENTION_DAYS;
  return retentionCutoffDate(days);
}

export async function POST(req: NextRequest) {
  const { isAdmin, user } = await verifyAdminAccess();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const before = resolveBeforeDate(body);

  const supabase = createAdminClient();
  try {
    const deleted_count = await softDeleteThreadsBeforeDate(
      supabase,
      before,
      user.id,
    );
    return NextResponse.json({ success: true, deleted_count });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
