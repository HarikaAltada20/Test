import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  createCampaignSequence,
  loadCampaignSequence,
} from "@/lib/admin-email/sequence-store";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const data = await loadCampaignSequence(id);
  if (!data) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({
    sequence: data.sequence,
    steps: data.steps,
    projectId: data.projectId,
    status: data.status,
  });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: {
    name?: string;
    description?: string;
    steps?: Array<{
      step_number: number;
      subject: string;
      body: string;
      delay_days: number;
      variants?: Array<{
        variant_name: string;
        subject: string;
        body: string;
        variant_letter: string;
      }>;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.steps?.length) {
    return NextResponse.json({ error: "steps are required" }, { status: 400 });
  }

  try {
    const result = await createCampaignSequence(id, {
      name: body.name ?? "Email Sequence",
      description: body.description,
      steps: body.steps,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create sequence";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
