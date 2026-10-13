import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  assertCanManageCampaignAccess,
  campaignAccessErrorResponse,
  getAccessActor,
  getServiceClient,
} from "@/lib/campaign-access-server";
import { isUuid } from "@/lib/campaign-access";
import { invalidateCampaignListCachesAfterMutation } from "@/lib/campaign-list-cache";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/contests/:id/applications-open { open: boolean }
 * The campaign's brand or an admin pauses or reopens applications on a
 * Restricted campaign. Changes only this one setting, so it also works on
 * live campaigns. Reopening notifies creators who asked to be told (database trigger).
 */
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const actor = await getAccessActor();
    const admin = getServiceClient();
    const contest = await assertCanManageCampaignAccess(admin, actor, id);
    if (contest.access_mode !== "restricted") {
      throw new CampaignAccessError("Only Restricted campaigns take applications", 400);
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body?.open !== "boolean") {
      throw new CampaignAccessError("open must be true or false", 400);
    }

    const { error } = await admin
      .from("contests")
      .update({ applications_open: body.open })
      .eq("id", id);
    if (error) throw error;

    await invalidateCampaignListCachesAfterMutation({ advertiserId: contest.advertiser_id });
    return NextResponse.json({ applicationsOpen: body.open });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
