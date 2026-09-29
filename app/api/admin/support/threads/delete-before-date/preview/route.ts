import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { SUPPORT_RETENTION_DAYS } from "@/lib/constants/support";
import { countThreadsBeforeDate, retentionCutoffDate } from "@/lib/support/threads";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const beforeDays = parseInt(
    searchParams.get("before_days") || String(SUPPORT_RETENTION_DAYS),
    10,
  );
  const before = retentionCutoffDate(beforeDays);

  const supabase = createAdminClient();
  const count = await countThreadsBeforeDate(supabase, before);

  return NextResponse.json({
    before_days: beforeDays,
    before: before.toISOString(),
    count,
  });
}
