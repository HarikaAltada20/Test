import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { startWarmUpAccount } from "@/lib/admin-email/warm-up";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    const account = await startWarmUpAccount(id);
    return NextResponse.json({ account });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start warm-up";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
