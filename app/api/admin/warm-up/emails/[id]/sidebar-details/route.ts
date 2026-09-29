import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { getWarmUpSidebarDetails } from "@/lib/admin-email/warm-up-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    const details = await getWarmUpSidebarDetails(id);
    return NextResponse.json(details);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load details";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
