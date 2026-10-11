import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserSafe } from "@/utils/supabase/auth-server";
import { invalidateOpportunitiesListCacheForUser } from "@/lib/campaign-list-cache";
import {
  INVITE_RESULT_MESSAGES,
  isInviteRedeemResult,
  type InviteRedeemResult,
} from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/** POST /api/invite/:token — redeem an invite link for the signed-in creator. */
export async function POST(_request: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await getUserSafe(supabase);
    if (!user) {
      return NextResponse.json(
        { result: "not_signed_in", message: INVITE_RESULT_MESSAGES.not_signed_in },
        { status: 401 },
      );
    }

    const { data, error } = await supabase.rpc("redeem_contest_invite", {
      p_token: token,
    });
    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as
      | { contest_id: string | null; result: string }
      | undefined;
    const rawResult = row?.result;
    const result: InviteRedeemResult = isInviteRedeemResult(rawResult)
      ? rawResult
      : "not_found";

    if (result === "joined") {
      await invalidateOpportunitiesListCacheForUser(user.id);
    }

    return NextResponse.json({
      result,
      contestId: row?.contest_id ?? null,
      message: INVITE_RESULT_MESSAGES[result],
    });
  } catch (err) {
    console.error("[/api/invite] redeem failed", err);
    return NextResponse.json(
      { error: "Could not join this campaign. Please try again." },
      { status: 500 },
    );
  }
}
