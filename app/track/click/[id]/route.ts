import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getEmailTrackingBaseUrl } from "@/lib/email/admin-bulk-email";
import { resolveSafeRedirectUrl } from "@/lib/email/safe-redirect-url";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { id: trackingId } = await context.params;
  const targetUrl = req.nextUrl.searchParams.get("url");
  const appUrl = getEmailTrackingBaseUrl();

  if (!targetUrl) {
    return NextResponse.redirect(appUrl);
  }

  const decodedUrl = resolveSafeRedirectUrl(targetUrl, appUrl);

  const now = new Date().toISOString();

  try {
    const db = createAdminClient();
    const { data: tracking } = await db
      .from("admin_email_tracking")
      .select("id, campaign_id, user_id, open_count, click_count")
      .eq("tracking_id", trackingId)
      .maybeSingle();

    if (tracking) {
      const clickPatch: Record<string, unknown> = {
        click_count: (tracking.click_count ?? 0) + 1,
      };
      if ((tracking.click_count ?? 0) === 0) {
        clickPatch.clicked_at = now;
      }
      if ((tracking.open_count ?? 0) === 0) {
        clickPatch.open_count = 1;
        clickPatch.opened_at = now;
      }
      await db
        .from("admin_email_tracking")
        .update(clickPatch)
        .eq("tracking_id", trackingId);

      await db.from("admin_email_tracking_events").insert([
        {
          tracking_id: trackingId,
          event_type: "click",
          occurred_at: now,
        },
        ...((tracking.open_count ?? 0) === 0
          ? [
              {
                tracking_id: trackingId,
                event_type: "open",
                occurred_at: now,
              },
            ]
          : []),
      ]);

      const { data: recipient } = await db
        .from("admin_email_campaign_recipients")
        .select("email_delivery_status")
        .eq("campaign_id", tracking.campaign_id)
        .eq("user_id", tracking.user_id)
        .maybeSingle();

      const recipientPatch: Record<string, unknown> = {
        email_delivery_status: "clicked",
        clicked_at: now,
        updated_at: now,
      };
      if (
        recipient &&
        !["opened", "clicked"].includes(recipient.email_delivery_status)
      ) {
        recipientPatch.opened_at = now;
      }

      await db
        .from("admin_email_campaign_recipients")
        .update(recipientPatch)
        .eq("campaign_id", tracking.campaign_id)
        .eq("user_id", tracking.user_id);
    }
  } catch (err) {
    console.error("[track/click] failed:", err);
  }

  return NextResponse.redirect(decodedUrl);
}
