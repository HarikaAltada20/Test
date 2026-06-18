import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  syncInboundEmailsFromBucket,
  syncRecentInboundEmails,
} from "@/lib/email/inbound-s3";

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const full = sp.get("full") === "1";
  const recent = sp.get("recent") === "1";

  try {
    if (recent) {
      const result = await syncRecentInboundEmails();
      return NextResponse.json({ ok: true, ...result });
    }

    const maxKeys = full
      ? Math.min(parseInt(sp.get("maxKeys") ?? "50", 10) || 50, 100)
      : Math.min(parseInt(sp.get("maxKeys") ?? "25", 10) || 25, 50);

    const result = await syncInboundEmailsFromBucket({
      maxKeys,
      maxObjects: full ? 2000 : 1000,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to sync inbound emails";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
