import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { createWarmUpAccountFromSender } from "@/lib/admin-email/warm-up";

type RouteContext = { params: Promise<{ senderId: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { senderId } = await context.params;
  try {
    const account = await createWarmUpAccountFromSender(senderId);
    return NextResponse.json({ account });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create warm-up account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
