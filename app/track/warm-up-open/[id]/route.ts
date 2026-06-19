import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(_req: Request, context: RouteContext) {
  const { id: sendId } = await context.params;
  const now = new Date().toISOString();

  try {
    const db = createAdminClient();
    const { data: send } = await db
      .from("admin_email_warm_up_sends")
      .select("id, opened_at")
      .eq("id", sendId)
      .maybeSingle();

    if (send && !send.opened_at) {
      await db
        .from("admin_email_warm_up_sends")
        .update({ opened_at: now })
        .eq("id", send.id);
    }
  } catch (err) {
    console.error("[track/warm-up-open] failed:", err);
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
