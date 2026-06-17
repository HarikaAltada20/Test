import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { checkWarmUpHealth } from "@/lib/admin-email/warm-up-service";

export async function POST() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  try {
    const result = await checkWarmUpHealth();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to check health";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
