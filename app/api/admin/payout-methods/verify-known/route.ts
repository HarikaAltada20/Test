import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { isMissingColumnError } from "@/lib/admin-payout-methods";

const MAX_IDS = 200;

/**
 * Verifies Skydo methods whose email is already verified on another account.
 * Re-checks on the server, so ids that no longer qualify are skipped, not verified.
 */
export async function POST(req: NextRequest) {
  const { isAdmin, user } = await verifyAdminAccess();
  if (!isAdmin || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { ids } = body ?? {};

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id: unknown) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be a non-empty string array" }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `You can verify at most ${MAX_IDS} payout methods at once` }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: eligible, error: checkError } = await supabase
    .from("admin_payout_methods_view")
    .select("id")
    .in("id", ids)
    .eq("method_type", "skydo")
    .eq("known_verified", true);

  if (isMissingColumnError(checkError)) {
    return NextResponse.json(
      {
        error: "This needs the latest database migration (20261015150000_skydo_known_email.sql).",
      },
      { status: 409 }
    );
  }
  if (checkError) {
    console.error("Verify known Skydo emails check error:", checkError);
    return NextResponse.json({ error: checkError.message }, { status: 500 });
  }

  const eligibleIds = (eligible ?? []).map((r) => r.id as string);
  if (eligibleIds.length === 0) {
    return NextResponse.json({
      ok: true,
      updated: 0,
      skipped: ids.length,
      ids: [],
    });
  }

  const { data, error } = await supabase
    .from("payout_methods")
    .update({
      skydo_status: "verified",
      skydo_status_updated_at: new Date().toISOString(),
      skydo_status_updated_by: user.id,
      skydo_verified_via: "known_email",
    })
    .in("id", eligibleIds)
    .eq("method_type", "skydo")
    .neq("skydo_status", "verified")
    .select("id");

  if (error) {
    console.error("Verify known Skydo emails update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updatedIds = (data ?? []).map((r) => r.id as string);
  return NextResponse.json({
    ok: true,
    updated: updatedIds.length,
    skipped: ids.length - updatedIds.length,
    ids: updatedIds,
  });
}
