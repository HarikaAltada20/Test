import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type Phase = "live" | "upcoming" | "past";

function classifyPhase(
  startsAt: string,
  endsAt: string,
  now: number,
): Phase {
  const end = new Date(endsAt).getTime();
  const start = new Date(startsAt).getTime();
  if (Number.isNaN(end) || Number.isNaN(start)) return "past";
  if (end < now) return "past";
  if (start > now) return "upcoming";
  return "live";
}

export async function GET() {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("competition_event")
      .select("id,name,starts_at,ends_at,timezone,status,is_active,created_at")
      .order("starts_at", { ascending: false });

    if (error) throw error;

    const now = Date.now();
    const events = (rows || []).map((r) => ({
      ...r,
      phase: classifyPhase(r.starts_at, r.ends_at, now),
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error("[admin/competition/events] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
