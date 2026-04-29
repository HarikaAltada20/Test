import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createClient } from "@/utils/supabase/server";
import { clearDailyChallengeCache } from "@/lib/cache-utils";

export const dynamic = "force-dynamic";

function toNonNegativeInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

export async function POST(request: NextRequest) {
  try {
    const { isAdmin, user } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const viewsMinViews = toNonNegativeInt(body?.viewsMinViews, 1000);
    const reelsMinReels = toNonNegativeInt(body?.reelsMinReels, 3);
    const reelsMinViews = toNonNegativeInt(body?.reelsMinViews, 1000);
    const minViewsPerReel = toNonNegativeInt(body?.minViewsPerReel, 100);
    const promoteNextEligible = Boolean(body?.promoteNextEligible);

    const supabase = await createClient();
    const nowIso = new Date().toISOString();
    const { data: event } = await supabase
      .from("competition_event")
      .select("id")
      .eq("is_active", true)
      .eq("status", "active")
      .lte("starts_at", nowIso)
      .gte("ends_at", nowIso)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!event?.id) {
      return NextResponse.json({ error: "No active competition event found" }, { status: 400 });
    }

    const { data: configRow, error: configError } = await supabase
      .from("competition_eligibility_config")
      .insert({
        event_id: event.id,
        views_min_views: viewsMinViews,
        reels_min_reels: reelsMinReels,
        reels_min_views: reelsMinViews,
        min_views_per_reel_for_reels_lb: minViewsPerReel,
        promote_next_eligible: promoteNextEligible,
        created_by: user?.id ?? null,
      })
      .select(
        "views_min_views,reels_min_reels,reels_min_views,min_views_per_reel_for_reels_lb,promote_next_eligible,effective_from",
      )
      .single();

    if (configError) throw configError;

    const cleared = clearDailyChallengeCache();
    return NextResponse.json({
      success: true,
      config: {
        viewsMinViews: Number(configRow.views_min_views ?? 0),
        reelsMinReels: Number(configRow.reels_min_reels ?? 0),
        reelsMinViews: Number(configRow.reels_min_views ?? 0),
        minViewsPerReel: Number(configRow.min_views_per_reel_for_reels_lb ?? 0),
        promoteNextEligible: Boolean(configRow.promote_next_eligible ?? false),
        effectiveFrom: configRow.effective_from,
      },
      cacheEntriesCleared: cleared,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[admin/competition/config] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
