import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Read-only for authenticated users (creators + brands).
 * Returns which payout method types are paused/enabled so billing and earnings UI can show
 * availability. Admin toggles are in /api/admin/payout-method-settings.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("payout_method_type_settings")
    .select("method_type, is_paused");

  if (error) {
    console.error("payout-method-settings fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load payout method settings", pausedMethodTypes: [], enabledMethodTypes: ["crypto", "upi", "bank_transfer"] },
      { status: 500 }
    );
  }

  const settings = rows || [];
  const pausedMethodTypes = settings.filter((r) => r.is_paused).map((r) => r.method_type);
  const allTypes = ["crypto", "upi", "bank_transfer"];
  const enabledMethodTypes = allTypes.filter((t) => !pausedMethodTypes.includes(t));

  return NextResponse.json({
    pausedMethodTypes,
    enabledMethodTypes,
    settings: settings.map((r) => ({ method_type: r.method_type, is_paused: r.is_paused })),
  });
}
