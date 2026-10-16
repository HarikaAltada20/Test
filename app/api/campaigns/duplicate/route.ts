import { NextResponse } from "next/server";
import {
  campaignAccessErrorResponse,
  CampaignAccessError,
  getAccessActor,
  getServiceClient,
} from "@/lib/campaign-access-server";
import { duplicateCampaign, parseDuplicateRequest } from "@/lib/campaign-duplicate-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/campaigns/duplicate
 * { sourceContestId, targetAdvertiserId?, sections, title?, savedListIds?, includeManualInvites? }
 * Creates a new draft from an existing campaign. Brands may only copy their
 * own campaigns into their own account; admins may copy any campaign into any
 * brand. Only section keys come from the browser; every value is read from
 * the source campaign here.
 */
export async function POST(request: Request) {
  try {
    const actor = await getAccessActor();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new CampaignAccessError("Invalid request", 400);
    }
    const parsed = parseDuplicateRequest(body);
    const result = await duplicateCampaign(getServiceClient(), actor, parsed);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
