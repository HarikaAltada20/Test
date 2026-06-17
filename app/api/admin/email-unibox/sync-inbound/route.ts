import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { syncInboundEmailsFromBucket } from "@/lib/email/inbound-s3";

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const full = sp.get("full") === "1";
  const maxKeys = full
    ? Math.min(parseInt(sp.get("maxKeys") ?? "50", 10) || 50, 100)
    : Math.min(parseInt(sp.get("maxKeys") ?? "15", 10) || 15, 30);

  try {
    const result = await syncInboundEmailsFromBucket({
      maxKeys,
      maxScan: full ? 200 : 80,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to sync inbound emails";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
