import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { clearDailyChallengeCache } from "@/lib/cache-utils";

export const dynamic = "force-dynamic";

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function activateEventWithRetry(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await supabase.rpc("competition_set_sole_active", {
      p_event_id: eventId,
    });
    if (!error) return { ok: true };
    if (error.code !== "23505" || attempt === 1) {
      return { ok: false, message: error.message };
    }
  }
  return { ok: false, message: "Failed to activate event" };
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

    const supabase = createAdminClient();

    const { data: event, error: insertError } = await supabase
      .from("competition_event")
      .insert({
        name,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        timezone: "Asia/Kolkata",
        status: "active",
        is_active: false,
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

    const activationResult = await activateEventWithRetry(supabase, event.id);
    if (!activationResult.ok) {
      return NextResponse.json(
        {
          error:
            "Event was created but activation conflicted with another concurrent update. Please retry activation once.",
          details: activationResult.message,
          eventId: event.id,
        },
        { status: 409 },
      );
    }

    const { data: finalEvent, error: readFinalError } = await supabase
      .from("competition_event")
      .select("id,name,starts_at,ends_at,timezone,status,is_active")
      .eq("id", event.id)
      .single();
    if (readFinalError) throw readFinalError;

    const cleared = clearDailyChallengeCache();

    return NextResponse.json({
      success: true,
      event: finalEvent,
      cacheEntriesCleared: cleared,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[admin/competition/event] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
