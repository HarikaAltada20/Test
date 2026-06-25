import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { getWarmUpDashboard } from "@/lib/admin-email/warm-up";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const projectId = req.nextUrl.searchParams.get("project_id");
  const shouldSync = req.nextUrl.searchParams.get("sync") === "1";

  try {
    const data = await getWarmUpDashboard(projectId, { sync: shouldSync });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load warm-up dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
