import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user: currentUser }, error: authError } =
      await supabase.auth.getUser();

    if (authError || !currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUserData, error: currentUserError } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", currentUser.id)
      .single();

    if (currentUserError || currentUserData?.user_type !== "creator") {
      return NextResponse.json(
        { error: "Only creator accounts can manage linked accounts" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = body?.target_user_id as string | undefined;

    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json(
        { error: "target_user_id is required", code: "MISSING_TARGET" },
        { status: 400 },
      );
    }

    if (targetUserId === currentUser.id) {
      return NextResponse.json(
        { error: "Cannot unlink the active account from this list" },
        { status: 400 },
      );
    }

    const { data: forwardRow, error: forwardErr } = await adminSupabase
      .from("user_sessions_vault")
      .select("owner_user_id, target_user_id")
      .eq("owner_user_id", currentUser.id)
      .eq("target_user_id", targetUserId)
      .maybeSingle();

    if (forwardErr) {
      console.error("[account-switch/unlink] forward lookup:", forwardErr);
      return NextResponse.json(
        { error: "Failed to verify link" },
        { status: 500 },
      );
    }

    if (!forwardRow) {
      return NextResponse.json(
        {
          error: "This account is not linked to your switcher",
          code: "NO_LINK",
        },
        { status: 404 },
      );
    }

    const { error: delForward } = await adminSupabase
      .from("user_sessions_vault")
      .delete()
      .eq("owner_user_id", currentUser.id)
      .eq("target_user_id", targetUserId);

    if (delForward) {
      console.error("[account-switch/unlink] delete forward:", delForward);
      return NextResponse.json(
        { error: "Failed to remove link" },
        { status: 500 },
      );
    }

    const { error: delReverse } = await adminSupabase
      .from("user_sessions_vault")
      .delete()
      .eq("owner_user_id", targetUserId)
      .eq("target_user_id", currentUser.id);

    if (delReverse) {
      console.error("[account-switch/unlink] delete reverse:", delReverse);
    }

    await adminSupabase.rpc("log_action", {
      p_action: "account_link_removed",
      p_metadata: { unlinked_user_id: targetUserId },
      p_user_id: currentUser.id,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[account-switch/unlink]", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
