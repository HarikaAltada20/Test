import { NextResponse } from "next/server";
import {
  campaignAccessErrorResponse,
  getAccessActor,
  getServiceClient,
} from "@/lib/campaign-access-server";
import { buildDuplicatePreview } from "@/lib/campaign-duplicate-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns/duplicate/preview?sourceId=&targetAdvertiserId=
 * What can be copied from a campaign, plus warnings for the target brand.
 */
export async function GET(request: Request) {
  try {
    const actor = await getAccessActor();
    const url = new URL(request.url);
    const preview = await buildDuplicatePreview(
      getServiceClient(),
      actor,
      url.searchParams.get("sourceId"),
      url.searchParams.get("targetAdvertiserId"),
    );
    return NextResponse.json(preview);
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
