import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { MAX_USD_INR_RATE, MIN_USD_INR_RATE } from "@/lib/payout-fees";

/** Body: { usd_inr_rate: number }. Applies to new UPI and bank transfer requests only. */
export async function PATCH(req: NextRequest) {
  const { isAdmin, user } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rate = body?.usd_inr_rate;
  if (
    typeof rate !== "number" ||
    !Number.isFinite(rate) ||
    rate < MIN_USD_INR_RATE ||
    rate > MAX_USD_INR_RATE ||
    Math.round(rate * 10000) / 10000 !== rate
  ) {
    return NextResponse.json(
      { error: `usd_inr_rate must be from ${MIN_USD_INR_RATE} to ${MAX_USD_INR_RATE} with up to 4 decimals` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payout_settings")
    .upsert(
      { id: true, usd_inr_rate: rate, updated_at: new Date().toISOString(), updated_by: user?.id ?? null },
      { onConflict: "id" }
    )
    .select("usd_inr_rate, updated_at")
    .single();

  if (error) {
    console.error("admin payout-settings update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, usdInrRate: Number(data.usd_inr_rate), updatedAt: data.updated_at });
}
