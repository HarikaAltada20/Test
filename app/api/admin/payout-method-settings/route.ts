import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

export async function GET() {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payout_method_type_settings")
    .select("method_type, is_paused, updated_at")
    .order("method_type");

  if (error) {
    console.error("admin payout-method-settings fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data || [] });
}

export async function PATCH(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { method_type, is_paused } = body;
  if (typeof method_type !== "string" || typeof is_paused !== "boolean") {
    return NextResponse.json(
      { error: "Body must include method_type (string) and is_paused (boolean)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("payout_method_type_settings")
    .upsert(
      { method_type, is_paused, updated_at: new Date().toISOString() },
      { onConflict: "method_type" }
    );

  if (error) {
    console.error("admin payout-method-settings update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
