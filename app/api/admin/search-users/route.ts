import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: adminError || "Admin access required" },
        { status: 403 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const searchTerm = query.trim();
    const searchPattern = `%${searchTerm}%`;

    // Search users by name, email, username, or ID
    // Exclude advertisers from the search results
    let queryBuilder = supabase
      .from("users")
      .select("id, email, full_name, username, user_type, coins")
      .neq("user_type", "advertiser");

    // Check if query looks like a UUID (for ID search)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(searchTerm)) {
      // Exact ID match
      queryBuilder = queryBuilder.eq("id", searchTerm);
    } else {
      // Search by email, name, or username using OR
      // Format: "column1.ilike.pattern,column2.ilike.pattern"
      queryBuilder = queryBuilder.or(
        `email.ilike.${searchPattern},full_name.ilike.${searchPattern},username.ilike.${searchPattern}`
      );
    }

    const { data: users, error: usersError } = await queryBuilder.limit(20);

    if (usersError) {
      console.error("Error searching users:", usersError);
      return NextResponse.json(
        { error: "Failed to search users" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      users: users || [],
    });
  } catch (error) {
    console.error("Error in user search:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
