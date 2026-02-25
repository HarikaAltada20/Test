import { NextRequest, NextResponse } from "next/server";
import { getGeoDataForIp } from "@/lib/geo-ip";

/**
 * GET/POST: returns geo_data for a given IP (for signup/registration).
 

 */
export async function GET(request: NextRequest) {
  const ip = request.nextUrl.searchParams.get("ip")?.trim() || null;
  const geo = await getGeoDataForIp(ip);
  return NextResponse.json({ geo_data: geo });
}

export async function POST(request: NextRequest) {
  let ip: string | null = null;
  try {
    const body = await request.json();
    ip = (body?.ip ?? body?.ip_address)?.trim() || null;
  } catch {
    // no body
  }
  const geo = await getGeoDataForIp(ip);
  return NextResponse.json({ geo_data: geo });
}
