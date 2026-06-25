import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(_req: Request, context: RouteContext) {
  const { id: trackingId } = await context.params;
  const now = new Date().toISOString();

  try {
    const db = createAdminClient();
    const { data: tracking } = await db
      .from("admin_email_tracking")
      .select("id, campaign_id, user_id, open_count")
      .eq("tracking_id", trackingId)
      .maybeSingle();

    if (tracking) {
      const openPatch: Record<string, unknown> = {
        open_count: (tracking.open_count ?? 0) + 1,
      };
      if ((tracking.open_count ?? 0) === 0) {
        openPatch.opened_at = now;
      }
      await db
        .from("admin_email_tracking")
        .update(openPatch)
        .eq("tracking_id", trackingId);

      await db.from("admin_email_tracking_events").insert({
        tracking_id: trackingId,
        event_type: "open",
        occurred_at: now,
      });

      const { data: recipient } = await db
        .from("admin_email_campaign_recipients")
        .select("email_delivery_status")
        .eq("campaign_id", tracking.campaign_id)
        .eq("user_id", tracking.user_id)
        .maybeSingle();

      if (
        recipient &&
        !["opened", "clicked"].includes(recipient.email_delivery_status)
      ) {
        await db
          .from("admin_email_campaign_recipients")
          .update({
            email_delivery_status: "opened",
            opened_at: now,
            updated_at: now,
          })
          .eq("campaign_id", tracking.campaign_id)
          .eq("user_id", tracking.user_id);
      }
    }
  } catch (err) {
    console.error("[track/open] failed:", err);
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
