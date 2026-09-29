import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { getWarmUpSends } from "@/lib/admin-email/warm-up-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10);

  try {
    const sends = await getWarmUpSends(id, Math.min(limit, 200));
    return NextResponse.json({ sends });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load sends";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
