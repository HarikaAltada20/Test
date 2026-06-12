import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { id: trackingId } = await context.params;
  const targetUrl = req.nextUrl.searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.redirect(
      process.env.NEXT_PUBLIC_APP_URL ?? "https://gameofcreators.com",
    );
  }

  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(targetUrl);
    new URL(decodedUrl);
  } catch {
    return NextResponse.redirect(
      process.env.NEXT_PUBLIC_APP_URL ?? "https://gameofcreators.com",
    );
  }

  const now = new Date().toISOString();

  try {
    const db = createAdminClient();
    const { data: tracking } = await db
      .from("admin_email_tracking")
      .select("id, campaign_id, user_id, click_count")
      .eq("tracking_id", trackingId)
      .maybeSingle();

    if (tracking) {
      const clickPatch: Record<string, unknown> = {
        click_count: (tracking.click_count ?? 0) + 1,
      };
      if ((tracking.click_count ?? 0) === 0) {
        clickPatch.clicked_at = now;
      }
      await db
        .from("admin_email_tracking")
        .update(clickPatch)
        .eq("tracking_id", trackingId);

      await db.from("admin_email_tracking_events").insert({
        tracking_id: trackingId,
        event_type: "click",
        occurred_at: now,
      });

      await db
        .from("admin_email_campaign_recipients")
        .update({
          email_delivery_status: "clicked",
          clicked_at: now,
          updated_at: now,
        })
        .eq("campaign_id", tracking.campaign_id)
        .eq("user_id", tracking.user_id);
    }
  } catch (err) {
    console.error("[track/click] failed:", err);
  }

  return NextResponse.redirect(decodedUrl);
}
