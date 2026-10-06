import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { isSkydoStatus } from "@/lib/skydo-payout";

const MAX_IDS = 200;

export async function POST(req: NextRequest) {
  const { isAdmin, user } = await verifyAdminAccess();
  if (!isAdmin || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { ids, skydo_status } = body ?? {};

  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((id: unknown) => typeof id === "string")
  ) {
    return NextResponse.json({ error: "ids must be a non-empty string array" }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: `You can update at most ${MAX_IDS} payout methods at once` },
      { status: 400 }
    );
  }
  if (!isSkydoStatus(skydo_status)) {
    return NextResponse.json(
      { error: "skydo_status must be email_pending, email_sent or verified" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payout_methods")
    .update({
      skydo_status,
      skydo_status_updated_at: new Date().toISOString(),
      skydo_status_updated_by: user.id,
    })
    .in("id", ids)
    .eq("method_type", "skydo")
    .select("id");

  if (error) {
    console.error("Admin payout methods bulk update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updated = data?.length ?? 0;
  return NextResponse.json({
    ok: true,
    updated,
    skipped: ids.length - updated,
  });
}
