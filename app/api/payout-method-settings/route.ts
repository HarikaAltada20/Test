import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Public API: returns which payout method types are paused.
 * Used by the earnings/billing UI to hide disabled methods and show a message.
 */
export async function GET() {
  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from("payout_method_type_settings")
    .select("method_type, is_paused");

  if (error) {
    console.error("payout-method-settings fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load payout method settings", pausedMethodTypes: [], enabledMethodTypes: ["crypto", "upi", "bank_transfer", "phantom"] },
      { status: 500 }
    );
  }

  const settings = rows || [];
  const pausedMethodTypes = settings.filter((r) => r.is_paused).map((r) => r.method_type);
  const allTypes = ["crypto", "upi", "bank_transfer", "phantom"];
  const enabledMethodTypes = allTypes.filter((t) => !pausedMethodTypes.includes(t));

  return NextResponse.json({
    pausedMethodTypes,
    enabledMethodTypes,
    settings: settings.map((r) => ({ method_type: r.method_type, is_paused: r.is_paused })),
  });
}
