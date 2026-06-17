import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { calculateDailyMetrics } from "@/lib/admin-email/warm-up-service";

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let projectId: string | undefined;
  try {
    const body = await req.json() as { projectId?: string };
    projectId = body.projectId;
  } catch {
    // optional
  }

  try {
    const result = await calculateDailyMetrics(projectId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to calculate metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
