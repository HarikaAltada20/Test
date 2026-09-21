import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";

export const runtime = "nodejs";
export const revalidate = 2_592_000;

const NATURAL_EARTH_VERSION = "v5.1.2";
const BOUNDARY_URLS = {
  country: `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_VERSION}/geojson/ne_110m_admin_0_countries.geojson`,
  state: `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_VERSION}/geojson/ne_50m_admin_1_states_provinces.geojson`,
} as const;

export async function GET(request: NextRequest) {
  const { isAdmin, error } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json(
      { error: error || "Admin required" },
      { status: 403 },
    );
  }

  const level = request.nextUrl.searchParams.get("level");
  if (level !== "country" && level !== "state") {
    return NextResponse.json(
      { error: "level must be country or state" },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const fetchOptions: RequestInit & { next: { revalidate: number } } = {
      signal: controller.signal,
      cache: "force-cache",
      next: { revalidate },
    };
    const response = await fetch(BOUNDARY_URLS[level], fetchOptions);
    if (!response.ok) {
      throw new Error(`Natural Earth returned ${response.status}`);
    }

    const geoJson = await response.json();
    return NextResponse.json(geoJson, {
      headers: {
        "Cache-Control":
          "private, max-age=3600, stale-while-revalidate=2592000",
      },
    });
  } catch (fetchError) {
    console.error("Unable to load map boundaries:", fetchError);
    return NextResponse.json(
      { error: "Map boundaries are temporarily unavailable" },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
