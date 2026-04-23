import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/** Signs out all other Supabase sessions for this user (current browser stays signed in). */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase.auth.signOut({ scope: "others" });

    if (error) {
      console.error("[sessions/revoke-others]", error);
      return NextResponse.json(
        { error: error.message || "Could not sign out other sessions" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[sessions/revoke-others]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
