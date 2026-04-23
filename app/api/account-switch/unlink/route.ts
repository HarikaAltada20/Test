import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

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
    if (!isUuid(targetUserId)) {
      return NextResponse.json(
        { error: "target_user_id is invalid", code: "INVALID_TARGET" },
        { status: 400 },
      );
    }

    if (targetUserId === currentUser.id) {
      return NextResponse.json(
        { error: "Cannot unlink the active account from this list" },
        { status: 400 },
      );
    }

    const { data: unlinkResult, error: unlinkErr } = await adminSupabase.rpc(
      "account_switch_unlink_from_pool",
      {
        p_owner_user_id: currentUser.id,
        p_target_user_id: targetUserId,
      },
    );
    if (unlinkErr) {
      console.error("[account-switch/unlink] unlink rpc:", unlinkErr);
      return NextResponse.json({ error: "Failed to remove link" }, { status: 500 });
    }
    const rpcResult = (unlinkResult ?? null) as
      | { ok?: boolean; error?: string; removed_edges?: number }
      | null;
    if (!rpcResult?.ok) {
      if (rpcResult?.error === "NO_LINK") {
        return NextResponse.json(
          {
            error: "This account is not linked to your switcher",
            code: "NO_LINK",
          },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: rpcResult?.error || "Failed to remove link" },
        { status: 500 },
      );
    }

    await adminSupabase.rpc("log_action", {
      p_action: "account_link_removed",
      p_metadata: {
        unlinked_user_id: targetUserId,
        removed_pool_edges: rpcResult.removed_edges ?? 0,
      },
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
