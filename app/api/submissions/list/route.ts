import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const CONTEST_COLUMNS =
  "id, title, contest_type, contest_format, contest_based_details, bonus_details, end_date, post_contest_status, thumbnail_url, platform, advertiser_id";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = request.nextUrl;
    const cursor = url.searchParams.get("cursor"); // created_at value for keyset pagination
    const cursorId = url.searchParams.get("cursor_id"); // tie-breaker
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || String(PAGE_SIZE), 10),
      100,
    );

    let query = supabase
      .from("submissions")
      .select("*", { count: "exact" })
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

    if (cursor && cursorId) {
      // Keyset pagination: rows where (created_at, id) < (cursor, cursorId)
      query = query.or(
        `created_at.lt.${cursor},and(created_at.eq.${cursor},id.lt.${cursorId})`,
      );
    }

    const { data: submissions, error: subError, count } = await query;

    if (subError) {
      console.error("Error fetching submissions:", subError.message);
      return NextResponse.json(
        { error: subError.message },
        { status: 500 },
      );
    }

    const rows = submissions || [];

    // Hydrate contest data
    const contestIds = [
      ...new Set(rows.map((s) => s.contest_id).filter(Boolean)),
    ];
    let contestsMap: Record<string, any> = {};

    if (contestIds.length > 0) {
      const { data: contests } = await supabase
        .from("contests")
        .select(CONTEST_COLUMNS)
        .in("id", contestIds);

      if (contests && contests.length > 0) {
        const advertiserIds = [
          ...new Set(contests.map((c) => c.advertiser_id).filter(Boolean)),
        ];
        let profilesMap: Record<string, any> = {};

        if (advertiserIds.length > 0) {
          const { data: profiles } = await supabase
            .from("advertiser_profiles")
            .select("id, company_name")
            .in("id", advertiserIds);

          if (profiles) {
            profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
          }
        }

        for (const c of contests) {
          contestsMap[c.id] = {
            ...c,
            advertiser_profiles: profilesMap[c.advertiser_id] || null,
          };
        }
      }
    }

    const formatted = rows.map((sub) => ({
      ...sub,
      contests: sub.contest_id ? contestsMap[sub.contest_id] || null : null,
      formatted_created_at: sub.created_at
        ? new Date(sub.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
        : "Date N/A",
    }));

    // Next cursor from last row
    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === limit && last
        ? { cursor: last.created_at, cursor_id: last.id }
        : null;

    return NextResponse.json({
      submissions: formatted,
      nextCursor,
      totalCount: count ?? null,
    });
  } catch (err) {
    console.error("Submissions list error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
