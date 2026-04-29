import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createClient } from "@/utils/supabase/server";
import { clearDailyChallengeCache } from "@/lib/cache-utils";

export const dynamic = "force-dynamic";

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(request: NextRequest) {
  try {
    const { isAdmin, user } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const name =
      typeof body?.name === "string" && body.name.trim().length > 0
        ? body.name.trim().slice(0, 120)
        : "Daily Challenge";

    let startsAt = parseIsoDate(body?.startsAt);
    let endsAt = parseIsoDate(body?.endsAt);

    if (!startsAt || !endsAt) {
      const now = Date.now();
      startsAt = new Date(now - 24 * 60 * 60 * 1000);
      endsAt = new Date(now + 30 * 24 * 60 * 60 * 1000);
    }

    if (endsAt.getTime() <= startsAt.getTime()) {
      return NextResponse.json(
        { error: "endsAt must be after startsAt" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { error: deactivateError } = await supabase
      .from("competition_event")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("is_active", true);

    if (deactivateError) throw deactivateError;

    const { data: event, error: insertError } = await supabase
      .from("competition_event")
      .insert({
        name,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        timezone: "Asia/Kolkata",
        status: "active",
        is_active: true,
      })
      .select("id,name,starts_at,ends_at,timezone,status,is_active")
      .single();

    if (insertError) throw insertError;

    const { error: configError } = await supabase.from("competition_eligibility_config").insert({
      event_id: event.id,
      views_min_views: 1000,
      reels_min_reels: 3,
      reels_min_views: 1000,
      min_views_per_reel_for_reels_lb: 100,
      promote_next_eligible: false,
      created_by: user?.id ?? null,
    });

    if (configError) throw configError;

    const cleared = clearDailyChallengeCache();

    return NextResponse.json({
      success: true,
      event,
      cacheEntriesCleared: cleared,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[admin/competition/event] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
