import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  campaignAccessErrorResponse,
  getCampaignPreview,
  getSignedInClient,
} from "@/lib/campaign-access-server";
import { isUuid } from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/contests/:id/preview — Restricted campaign preview, questions and my application. */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const { supabase } = await getSignedInClient();
    const preview = await getCampaignPreview(supabase, id);
    if (!preview) throw new CampaignAccessError("Campaign not found", 404);
    return NextResponse.json({ preview });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
