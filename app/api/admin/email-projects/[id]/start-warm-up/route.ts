import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { setProjectWarmUpEnabled } from "@/lib/admin-email/warm-up";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: { enabled?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // default enabled true
  }

  try {
    const status = await setProjectWarmUpEnabled(id, body.enabled !== false);
    return NextResponse.json({ status });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to start project warm-up";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
