import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { clearContestsCache } from "@/lib/cache-utils";
import {
  invalidateAdminCampaignListCache,
  invalidateAllCampaignListCache,
  invalidateCampaignListCacheForAdvertiser,
  invalidateOpportunitiesListCacheForUser,
} from "@/lib/campaign-list-cache";

export const dynamic = "force-dynamic";

/**
 * Clear in-process contest cache + scoped Redis campaign-list keys.
 * Auth required. Callers may only clear their own advertiser/opportunities keys.
 * Admins may clear admin keys, a specific advertiser, or all (scope=all).
 *
 * Query:
 *   scope=self (default) — caller’s advertiser + opportunities keys;
 *     admins get admin keys (+ optional ?advertiserId=)
 *   scope=admin — admin list keys only (admin required)
 *   scope=all — every campaign_list key (admin required)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = userRow?.user_type === "admin";
    const scopeRaw = (request.nextUrl.searchParams.get("scope") || "self")
      .trim()
      .toLowerCase();
    const scope =
      scopeRaw === "all" || scopeRaw === "admin" || scopeRaw === "self"
        ? scopeRaw
        : "self";

    if ((scope === "all" || scope === "admin") && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clearedCount = clearContestsCache();
    let listCacheCleared = 0;

    if (scope === "all") {
      listCacheCleared = await invalidateAllCampaignListCache();
    } else if (scope === "admin") {
      listCacheCleared = await invalidateAdminCampaignListCache();
    } else if (isAdmin) {
      const advertiserId = request.nextUrl.searchParams.get("advertiserId");
      const parts = await Promise.all([
        invalidateAdminCampaignListCache(),
        advertiserId
          ? invalidateCampaignListCacheForAdvertiser(advertiserId)
          : Promise.resolve(0),
        invalidateOpportunitiesListCacheForUser(user.id),
      ]);
      listCacheCleared = parts.reduce((a, b) => a + b, 0);
    } else {
      const parts = await Promise.all([
        invalidateCampaignListCacheForAdvertiser(user.id),
        invalidateOpportunitiesListCacheForUser(user.id),
      ]);
      listCacheCleared = parts.reduce((a, b) => a + b, 0);
    }

    console.log(
      `[/api/contests/clear-cache] user=${user.id} scope=${scope} Memory=${clearedCount} RedisList=${listCacheCleared}`,
    );

    return NextResponse.json({
      success: true,
      message: "Contest cache cleared successfully",
      clearedCount,
      listCacheCleared,
      scope,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to clear cache";
    console.error("[/api/contests/clear-cache] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
