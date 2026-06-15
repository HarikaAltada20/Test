import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { syncInboundEmailsFromBucket } from "@/lib/email/inbound-s3";

export async function POST() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  try {
    const result = await syncInboundEmailsFromBucket({ maxKeys: 100 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to sync inbound emails";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
