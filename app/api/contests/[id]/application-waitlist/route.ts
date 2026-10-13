import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  campaignAccessErrorResponse,
  getSignedInClient,
} from "@/lib/campaign-access-server";
import {
  WAITLIST_RESULT_MESSAGES,
  isUuid,
  isWaitlistResult,
  type WaitlistResult,
} from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const RESULT_STATUS: Partial<Record<WaitlistResult, number>> = {
  not_signed_in: 401,
  not_found: 404,
};

function resultResponse(raw: unknown, waiting: boolean) {
  const result: WaitlistResult = isWaitlistResult(raw) ? raw : "not_found";
  const status = RESULT_STATUS[result] ?? 200;
  const message = WAITLIST_RESULT_MESSAGES[result];
  return NextResponse.json(
    { result, waiting, message, ...(status >= 400 ? { error: message } : {}) },
    { status },
  );
}

/** GET /api/contests/:id/application-waitlist — is the signed-in creator waiting to be notified? */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const { supabase, userId } = await getSignedInClient();
    // Row-level security only returns the caller's own row.
    const { data, error } = await supabase
      .from("contest_application_waitlist")
      .select("contest_id")
      .eq("contest_id", id)
      .eq("user_id", userId)
      .maybeSingle();
    // Before the 20261020 migration the table doesn't exist: nobody is waiting.
    if (error) return NextResponse.json({ waiting: false });
    return NextResponse.json({ waiting: !!data });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/** POST /api/contests/:id/application-waitlist — notify me when applications reopen. */
export async function POST(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const { supabase } = await getSignedInClient();
    const { data, error } = await supabase.rpc("join_application_waitlist", { p_contest_id: id });
    if (error) throw error;
    return resultResponse(data, data === "joined" || data === "already_joined");
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/** DELETE /api/contests/:id/application-waitlist — stop waiting. */
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const { supabase } = await getSignedInClient();
    const { data, error } = await supabase.rpc("leave_application_waitlist", { p_contest_id: id });
    if (error) throw error;
    return resultResponse(data, false);
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
