import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  parseBrandAnalyticsContext,
  resolveBrandActiveFilter,
} from "@/lib/brand-analytics-context";
import { getCachedBrandAnalyticsBundle } from "@/lib/brand-analytics-cache";
import { brandAnalyticsClientErrorMessage } from "@/lib/brand-analytics-errors";
import { buildBrandGraphResponse } from "@/lib/brand-analytics-response";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (userData?.user_type !== "advertiser") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = new URL(request.url).searchParams;
    const parsed = parseBrandAnalyticsContext(user.id, searchParams);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const bundle = await getCachedBrandAnalyticsBundle(parsed.ctx);
    const activeFilter = resolveBrandActiveFilter(searchParams);

    return NextResponse.json(
      buildBrandGraphResponse(bundle, activeFilter),
    );
  } catch (error) {
    console.error("Brand analytics graph error:", error);
    return NextResponse.json(
      { error: brandAnalyticsClientErrorMessage(error, "Failed to load analytics") },
      { status: 500 },
    );
  }
}
