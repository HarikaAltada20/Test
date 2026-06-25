import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { resetDailyCounters } from "@/lib/admin-email/warm-up-service";

export async function POST() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  try {
    await resetDailyCounters();
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reset counters";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
