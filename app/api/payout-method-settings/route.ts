import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { DEFAULT_USD_INR_RATE, PAYOUT_FEE_METHOD_TYPES } from "@/lib/payout-fees";

/**
 * Read-only for authenticated users (creators + brands).
 * Returns which payout method types are paused/enabled, each method's processing
 * fee and the USD to INR rate so billing and earnings UI can show what the user
 * receives. Admin changes are in /api/admin/payout-method-settings.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allTypes: string[] = [...PAYOUT_FEE_METHOD_TYPES];
  const admin = createAdminClient();
  const [{ data: rows, error }, { data: global, error: globalError }] = await Promise.all([
    admin.from("payout_method_type_settings").select("method_type, is_paused, fee_bps"),
    admin.from("payout_settings").select("usd_inr_rate").maybeSingle(),
  ]);

  if (error || globalError) {
    console.error("payout-method-settings fetch error:", error ?? globalError);
    return NextResponse.json(
      {
        error: "Failed to load payout method settings",
        pausedMethodTypes: [],
        enabledMethodTypes: allTypes,
        methods: [],
        usdInrRate: DEFAULT_USD_INR_RATE,
      },
      { status: 500 }
    );
  }

  const settings = rows || [];
  const pausedMethodTypes = settings.filter((r) => r.is_paused).map((r) => r.method_type);
  const enabledMethodTypes = allTypes.filter((t) => !pausedMethodTypes.includes(t));

  return NextResponse.json({
    pausedMethodTypes,
    enabledMethodTypes,
    settings: settings.map((r) => ({ method_type: r.method_type, is_paused: r.is_paused })),
    methods: settings.map((r) => ({
      method_type: r.method_type,
      is_paused: r.is_paused,
      fee_bps: r.fee_bps ?? 0,
    })),
    usdInrRate: Number(global?.usd_inr_rate ?? DEFAULT_USD_INR_RATE),
  });
}
