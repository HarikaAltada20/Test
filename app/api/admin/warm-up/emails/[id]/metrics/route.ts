import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { getWarmUpMetricsHistory } from "@/lib/admin-email/warm-up-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);

  try {
    const metrics = await getWarmUpMetricsHistory(id, Math.min(days, 90));
    return NextResponse.json({ metrics });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
