import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  assertCanManageCampaignAccess,
  campaignAccessErrorResponse,
  getAccessActor,
  getServiceClient,
} from "@/lib/campaign-access-server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; linkId: string }> };

/** DELETE /api/contests/:id/invite-links/:linkId — revoke; existing members keep access. */
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id, linkId } = await params;
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageCampaignAccess(admin, actor, id);

    const { data, error } = await admin
      .from("contest_invite_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", linkId)
      .eq("contest_id", id)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const { data: existing } = await admin
        .from("contest_invite_links")
        .select("id")
        .eq("id", linkId)
        .eq("contest_id", id)
        .maybeSingle();
      if (!existing) throw new CampaignAccessError("Invite link not found", 404);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
