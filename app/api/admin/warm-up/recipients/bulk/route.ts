import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { bulkAddWarmUpRecipients } from "@/lib/admin-email/warm-up-service";

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: {
    projectId?: string;
    recipients?: {
      email: string;
      firstName?: string;
      lastName?: string;
      company?: string;
    }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.projectId || !body.recipients?.length) {
    return NextResponse.json(
      { error: "projectId and recipients are required" },
      { status: 400 },
    );
  }

  try {
    const recipients = await bulkAddWarmUpRecipients(
      body.projectId,
      body.recipients,
    );
    return NextResponse.json({ recipients });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to bulk add recipients";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
