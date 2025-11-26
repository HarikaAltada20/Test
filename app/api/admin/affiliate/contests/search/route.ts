import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin)
      return NextResponse.json(
        { error: error || "Admin required" },
        { status: 403 }
      );

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ contests: [] });
    }

    const supabase = createAdminClient();
    const searchTerm = query.trim();

    // Search contests by title (case-insensitive partial match)
    // Use ilike with wildcard pattern for partial matching
    const searchPattern = `%${searchTerm}%`;

    // Search by title
    const { data: titleMatches, error: titleErr } = await supabase
      .from("contests")
      .select("id, title, start_date")
      .ilike("title", searchPattern)
      .order("start_date", { ascending: false, nullsFirst: false })
      .limit(20);

    if (titleErr) {
      console.error("Error searching contests by title:", titleErr);
      return NextResponse.json(
        { error: `Search failed: ${titleErr.message}` },
        { status: 500 }
      );
    }

    console.log(
      `Title search for "${searchTerm}" returned ${
        titleMatches?.length || 0
      } results`
    );

    // Debug: log sample data
    if (titleMatches && titleMatches.length > 0) {
      console.log("First match:", JSON.stringify(titleMatches[0], null, 2));
    } else {
      console.log(`No contests found matching title pattern: ${searchPattern}`);
      // Test query to see if we can fetch any contests at all
      const { data: testData, error: testErr } = await supabase
        .from("contests")
        .select("id, title, start_date")
        .limit(1);

      if (testErr) {
        console.error("Test query error:", testErr);
      } else {
        console.log(`Test query returned ${testData?.length || 0} contests`);
        if (testData && testData.length > 0) {
          console.log("Sample contest title:", testData[0].title);
        }
      }
    }

    const allMatches = [...(titleMatches || [])];

    // If search term looks like a full UUID, also try exact match by id
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(searchTerm)) {
      const { data: idMatch, error: idErr } = await supabase
        .from("contests")
        .select("id, title, start_date")
        .eq("id", searchTerm)
        .single();

      if (!idErr && idMatch) {
        // Add to results if not already included
        const existingIds = new Set(allMatches.map((c: any) => c.id));
        if (!existingIds.has(idMatch.id)) {
          allMatches.unshift(idMatch); // Add at the beginning since it's an exact match
        }
      }
    }

    // Limit to 20 and sort by start_date descending
    const contests = allMatches.slice(0, 20).sort((a: any, b: any) => {
      const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
      const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
      return dateB - dateA;
    });

    const formattedContests = contests.map((contest: any) => ({
      id: contest.id,
      title: contest.title || "Untitled",
      start_date: contest.start_date || null,
    }));

    console.log(`Returning ${formattedContests.length} formatted contests`);

    return NextResponse.json({ contests: formattedContests });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}
