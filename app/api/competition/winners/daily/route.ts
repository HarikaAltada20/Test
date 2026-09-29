import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getDailyWinnersHistoryPaginated } from "@/lib/daily-challenge";
import { buildWinnersHistoryFilters } from "@/lib/daily-challenge-history";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const filters = buildWinnersHistoryFilters(request.nextUrl.searchParams);
    const result = await getDailyWinnersHistoryPaginated({
      page: filters.page,
      limit: filters.limit,
      period: filters.period,
      category: filters.category,
      eventId: filters.eventId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      month: filters.month,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[competition/winners/daily] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
