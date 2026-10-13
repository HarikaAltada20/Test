import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  assertCanManageCampaignAccess,
  campaignAccessErrorResponse,
  getAccessActor,
  getServiceClient,
} from "@/lib/campaign-access-server";
import { isUuid } from "@/lib/campaign-access";
import {
  parseApplicantVisibility,
  validateApplicantVisibility,
} from "@/lib/campaign-applicant-profile";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/contests/:id/applicant-visibility. Brand or admin; everything is visible by default. */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageCampaignAccess(admin, actor, id);

    const { data, error } = await admin
      .from("contests")
      .select("applicant_visibility")
      .eq("id", id)
      .maybeSingle();
    // Before the migration runs the column doesn't exist; treat everything as visible.
    const visibility = parseApplicantVisibility(error ? null : data?.applicant_visibility);
    return NextResponse.json({ visibility, canEdit: actor.isAdmin });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/** PUT /api/contests/:id/applicant-visibility { visibility }. Admins only. */
export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const actor = await getAccessActor();
    if (!actor.isAdmin) {
      throw new CampaignAccessError("Only admins can change what brands see about applicants", 403);
    }
    const admin = getServiceClient();
    await assertCanManageCampaignAccess(admin, actor, id);

    const body = await request.json().catch(() => ({}));
    const parsed = validateApplicantVisibility(body?.visibility);
    if ("error" in parsed) throw new CampaignAccessError(parsed.error, 400);

    const { error } = await admin
      .from("contests")
      .update({ applicant_visibility: parsed.visibility })
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ visibility: parsed.visibility, canEdit: true });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
