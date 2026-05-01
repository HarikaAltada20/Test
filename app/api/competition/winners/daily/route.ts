import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getDailyWinnersHistory } from "@/lib/daily-challenge";

export const dynamic = "force-dynamic";

function parseDays(value: string | null, fallback = 30): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(60, Math.max(1, Math.floor(parsed)));
}

function parseSnapshotPeriod(value: string | null): "day" | "week" | "month" | null {
  if (value === "this_week" || value === "last_week" || value === "week") return "week";
  if (value === "this_month" || value === "last_month" || value === "month") return "month";
  if (value === "today" || value === "yesterday" || value === "day") return "day";
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const days = parseDays(request.nextUrl.searchParams.get("days"));
    const eventId = request.nextUrl.searchParams.get("event_id");
    const period = parseSnapshotPeriod(request.nextUrl.searchParams.get("period"));
    const winners = await getDailyWinnersHistory(days, eventId, period);
    return NextResponse.json({ winners });
  } catch (error) {
    console.error("[competition/winners/daily] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
