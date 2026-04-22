import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/** Lists recorded device sessions for the current user (max 3 retained server-side). */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: rows, error } = await supabase
      .from("user_device_sessions")
      .select("id, user_agent, ip_address, last_seen_at")
      .eq("user_id", user.id)
      .order("last_seen_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[sessions GET]", error);
      return NextResponse.json({ sessions: [] });
    }

    return NextResponse.json({ sessions: rows ?? [] });
  } catch (e) {
    console.error("[sessions GET]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
