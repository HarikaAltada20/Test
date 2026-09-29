import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { addSequenceStep } from "@/lib/admin-email/sequence-store";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: {
    step_number?: number;
    subject?: string;
    body?: string;
    delay_days?: number;
    variants?: unknown[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await addSequenceStep(id, {
      step_number: body.step_number ?? 1,
      subject: body.subject ?? "",
      body: body.body ?? "",
      delay_days: body.delay_days ?? 2,
      variants: [],
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add step";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
