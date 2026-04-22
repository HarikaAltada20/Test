import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

/** Signs out everywhere (including this device). */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase.auth.signOut({ scope: "global" });

    if (error) {
      console.error("[sessions/revoke-all]", error);
      return NextResponse.json(
        { error: error.message || "Could not sign out" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { error: cleanupErr } = await admin
      .from("user_device_sessions")
      .delete()
      .eq("user_id", user.id);
    if (cleanupErr) {
      // Sign-out succeeded; retain success and just log cleanup miss.
      console.error("[sessions/revoke-all] cleanup:", cleanupErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[sessions/revoke-all]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
