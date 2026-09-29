import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { sendTestWarmUpEmail } from "@/lib/admin-email/warm-up-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: { recipientEmail?: string; recipient_email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const recipientEmail = (
    body.recipientEmail ?? body.recipient_email
  )?.trim();
  if (!recipientEmail) {
    return NextResponse.json(
      { error: "recipientEmail is required" },
      { status: 400 },
    );
  }

  try {
    const result = await sendTestWarmUpEmail(id, recipientEmail);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
