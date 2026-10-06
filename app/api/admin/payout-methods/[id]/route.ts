import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { isSkydoStatus } from "@/lib/skydo-payout";
import {
  ADMIN_PAYOUT_SELECT,
  ADMIN_PAYOUT_SELECT_LEGACY,
  isMissingColumnError,
  normalizeAdminPayoutRow,
  type AdminPayoutMethodDetailResponse,
} from "@/lib/admin-payout-methods";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  let methodRes = await supabase
    .from("admin_payout_methods_view")
    .select(ADMIN_PAYOUT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (isMissingColumnError(methodRes.error)) {
    methodRes = await supabase
      .from("admin_payout_methods_view")
      .select(ADMIN_PAYOUT_SELECT_LEGACY)
      .eq("id", id)
      .maybeSingle();
  }

  if (methodRes.error) {
    return NextResponse.json({ error: methodRes.error.message }, { status: 500 });
  }
  if (!methodRes.data) {
    return NextResponse.json({ error: "Payout method not found" }, { status: 404 });
  }

  const method = normalizeAdminPayoutRow(
    methodRes.data as unknown as Record<string, unknown>
  );

  const [otherRes, withdrawalsRes] = await Promise.all([
    supabase
      .from("payout_methods")
      .select("id, method_type, details, friendly_name, is_default, skydo_status, created_at")
      .eq("user_id", method.user_id)
      .neq("id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("withdrawal_requests")
      .select("id, amount, currency, amount_type, status, created_at, processed_at")
      .eq("payout_method_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (otherRes.error) console.error("Payout method drawer: other methods error", otherRes.error);
  if (withdrawalsRes.error)
    console.error("Payout method drawer: withdrawals error", withdrawalsRes.error);

  const body: AdminPayoutMethodDetailResponse = {
    method,
    otherMethods: (otherRes.data ?? []) as AdminPayoutMethodDetailResponse["otherMethods"],
    recentWithdrawals: (withdrawalsRes.data ??
      []) as AdminPayoutMethodDetailResponse["recentWithdrawals"],
  };
  return NextResponse.json(body);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAdmin, user } = await verifyAdminAccess();
  if (!isAdmin || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { skydo_status, admin_notes } = body ?? {};

  const updates: Record<string, string | null> = {};

  if (skydo_status !== undefined) {
    if (!isSkydoStatus(skydo_status)) {
      return NextResponse.json(
        { error: "skydo_status must be email_pending, email_sent or verified" },
        { status: 400 }
      );
    }
    updates.skydo_status = skydo_status;
    updates.skydo_status_updated_at = new Date().toISOString();
    updates.skydo_status_updated_by = user.id;
  }

  if (admin_notes !== undefined) {
    if (admin_notes !== null && typeof admin_notes !== "string") {
      return NextResponse.json({ error: "admin_notes must be a string" }, { status: 400 });
    }
    updates.admin_notes = admin_notes ? admin_notes.slice(0, 5000) : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Provide skydo_status and/or admin_notes" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("payout_methods")
    .select("id, method_type")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Payout method not found" }, { status: 404 });
  }
  if (updates.skydo_status && existing.method_type !== "skydo") {
    return NextResponse.json(
      { error: "Status can only be set on Skydo payout methods" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("payout_methods")
    .update(updates)
    .eq("id", id)
    .select("id, skydo_status, skydo_status_updated_at, admin_notes")
    .single();

  if (error) {
    console.error("Admin payout method update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
