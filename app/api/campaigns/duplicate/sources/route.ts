import { NextResponse } from "next/server";
import {
  campaignAccessErrorResponse,
  getAccessActor,
  getServiceClient,
} from "@/lib/campaign-access-server";
import { searchDuplicateSources } from "@/lib/campaign-duplicate-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns/duplicate/sources?q=&advertiserId=&offset=
 * Campaigns the caller may copy: a brand's own campaigns, or (admins) any
 * campaign, optionally limited to one brand.
 */
export async function GET(request: Request) {
  try {
    const actor = await getAccessActor();
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get("offset") || 0);
    const result = await searchDuplicateSources(getServiceClient(), actor, {
      q: url.searchParams.get("q"),
      advertiserId: url.searchParams.get("advertiserId"),
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return NextResponse.json(result);
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
