import {
  CampaignAccessError,
  campaignAccessErrorResponse,
  getServiceClient,
  getSignedInClient,
} from "@/lib/campaign-access-server";
import {
  afterReview,
  applicationResultResponse,
  parseReviewBody,
  type ReviewRow,
} from "@/lib/campaign-applications-server";
import { isUuid } from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; appId: string }> };

/** PATCH /api/contests/:id/applications/:appId — { decision: "approve" | "reject", reason? } */
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id, appId } = await params;
    if (!isUuid(id) || !isUuid(appId)) throw new CampaignAccessError("Application not found", 404);
    const { supabase } = await getSignedInClient();
    const { decision, reason } = parseReviewBody(await request.json().catch(() => ({})));

    const { data: app, error: appError } = await getServiceClient()
      .from("contest_applications")
      .select("id, contest_id")
      .eq("id", appId)
      .maybeSingle();
    if (appError) throw appError;
    if (!app || app.contest_id !== id) throw new CampaignAccessError("Application not found", 404);

    const { data, error } = await supabase.rpc("review_contest_application", {
      p_application_id: appId,
      p_decision: decision,
      p_reason: reason,
    });
    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as ReviewRow | undefined;
    if (row) await afterReview([row], reason);
    return applicationResultResponse(row?.result);
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
