import { NextResponse } from "next/server";
import { getAuthenticatedSupportUser } from "@/lib/support/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error, status } = await getAuthenticatedSupportUser();
  if (!user) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({
    enabled: user.support_chat_enabled,
  });
}
