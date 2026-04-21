import { createHash } from "crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

/** Records / updates this browser for “active sessions” (max 3 rows per user). */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!user || !session?.refresh_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const h = await headers();
    const ua = (h.get("user-agent") || "").slice(0, 512);
    const forwarded = h.get("x-forwarded-for");
    const ip =
      (forwarded ? forwarded.split(",")[0]?.trim() : null) ||
      h.get("x-real-ip") ||
      "";
    const now = new Date().toISOString();
    const refreshHash = hashRefreshToken(session.refresh_token);

    const { error: upsertErr } = await admin.from("user_device_sessions").upsert(
      {
        user_id: user.id,
        refresh_token_hash: refreshHash,
        user_agent: ua,
        ip_address: ip.slice(0, 128),
        last_seen_at: now,
      },
      { onConflict: "user_id,refresh_token_hash" },
    );

    if (upsertErr) {
      console.error("[sessions/touch] upsert:", upsertErr);
      return NextResponse.json({ error: "Failed to record session" }, { status: 500 });
    }

    const { data: rows, error: listErr } = await admin
      .from("user_device_sessions")
      .select("id, last_seen_at")
      .eq("user_id", user.id)
      .order("last_seen_at", { ascending: false });

    if (!listErr && rows && rows.length > 3) {
      const toRemove = rows.slice(3);
      for (const row of toRemove) {
        await admin.from("user_device_sessions").delete().eq("id", row.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[sessions/touch]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
