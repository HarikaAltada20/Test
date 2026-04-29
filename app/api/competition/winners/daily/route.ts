import { NextRequest, NextResponse } from "next/server";
import { getDailyWinnersHistory } from "@/lib/daily-challenge";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const days = Math.min(60, Math.max(1, Number(request.nextUrl.searchParams.get("days") || 30)));
    const winners = await getDailyWinnersHistory(days);
    return NextResponse.json({ winners });
  } catch (error) {
    console.error("[competition/winners/daily] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
