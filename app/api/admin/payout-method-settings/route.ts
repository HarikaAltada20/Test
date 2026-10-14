import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { DEFAULT_USD_INR_RATE, MAX_FEE_BPS } from "@/lib/payout-fees";

export async function GET() {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const [{ data, error }, { data: global, error: globalError }] = await Promise.all([
    supabase
      .from("payout_method_type_settings")
      .select("method_type, is_paused, fee_bps, updated_at")
      .order("method_type"),
    supabase.from("payout_settings").select("usd_inr_rate, updated_at").maybeSingle(),
  ]);

  if (error || globalError) {
    const err = error ?? globalError;
    console.error("admin payout-method-settings fetch error:", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: data || [],
    usdInrRate: Number(global?.usd_inr_rate ?? DEFAULT_USD_INR_RATE),
    usdInrRateUpdatedAt: global?.updated_at ?? null,
  });
}

/** Body: { method_type, is_paused?, fee_bps? }. At least one of is_paused / fee_bps. */
export async function PATCH(req: NextRequest) {
  const { isAdmin, user } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { method_type, is_paused, fee_bps } = body;
  const hasPause = typeof is_paused === "boolean";
  const hasFee = fee_bps !== undefined;
  if (typeof method_type !== "string" || (!hasPause && !hasFee)) {
    return NextResponse.json(
      { error: "Body must include method_type (string) and is_paused (boolean) or fee_bps (integer)" },
      { status: 400 }
    );
  }
  if (hasFee && (!Number.isInteger(fee_bps) || fee_bps < 0 || fee_bps > MAX_FEE_BPS)) {
    return NextResponse.json(
      { error: `fee_bps must be a whole number from 0 to ${MAX_FEE_BPS}` },
      { status: 400 }
    );
  }

  const row: Record<string, unknown> = {
    method_type,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  };
  if (hasPause) row.is_paused = is_paused;
  if (hasFee) row.fee_bps = fee_bps;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payout_method_type_settings")
    .upsert(row, { onConflict: "method_type" })
    .select("method_type, is_paused, fee_bps, updated_at")
    .single();

  if (error) {
    console.error("admin payout-method-settings update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, setting: data });
}
