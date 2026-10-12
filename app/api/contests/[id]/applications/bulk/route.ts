import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  assertCanManageCampaignAccess,
  campaignAccessErrorResponse,
  getAccessActor,
  getServiceClient,
  getSignedInClient,
} from "@/lib/campaign-access-server";
import {
  afterReview,
  parseReviewBody,
  type ReviewRow,
} from "@/lib/campaign-applications-server";
import { isUuid } from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BULK = 200;

/** POST /api/contests/:id/applications/bulk — { ids, decision, reason? } */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageCampaignAccess(admin, actor, id);
    const { supabase } = await getSignedInClient();

    const body = await request.json().catch(() => ({}));
    const { decision, reason } = parseReviewBody(body);
    const requested: string[] = Array.isArray(body?.ids)
      ? Array.from(new Set(body.ids.filter(isUuid)))
      : [];
    if (requested.length === 0) throw new CampaignAccessError("ids is required", 400);
    if (requested.length > MAX_BULK) {
      throw new CampaignAccessError(`At most ${MAX_BULK} applications at a time`, 400);
    }

    const { data: owned, error: ownedError } = await admin
      .from("contest_applications")
      .select("id")
      .eq("contest_id", id)
      .in("id", requested);
    if (ownedError) throw ownedError;
    const ids = (owned || []).map((r) => r.id);

    let rows: ReviewRow[] = [];
    if (ids.length > 0) {
      const { data, error } = await supabase.rpc("bulk_review_contest_applications", {
        p_application_ids: ids,
        p_decision: decision,
        p_reason: reason,
      });
      if (error) throw error;
      rows = (data || []) as ReviewRow[];
    }
    await afterReview(rows, reason);

    const done = decision === "approve" ? "approved" : "rejected";
    const updated = rows.filter((r) => r.result === done).length;
    return NextResponse.json({ updated, skipped: requested.length - updated });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
