import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

type AdvertiserResult = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  available_deposit_balance: number;
};

function mapUserRow(user: {
  id: string;
  email: string;
  full_name: string | null;
  advertiser_profiles:
    | { company_name?: string | null; available_deposit_balance?: number | null }
    | { company_name?: string | null; available_deposit_balance?: number | null }[]
    | null;
}): AdvertiserResult {
  const profile = Array.isArray(user.advertiser_profiles)
    ? user.advertiser_profiles[0]
    : user.advertiser_profiles;

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    company_name: profile?.company_name || null,
    available_deposit_balance: profile?.available_deposit_balance ?? 0,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: adminError || "Admin access required" },
        { status: 403 },
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const searchTerm = query.trim();
    const searchPattern = `%${searchTerm}%`;
    const results = new Map<string, AdvertiserResult>();

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    let queryBuilder = supabase
      .from("users")
      .select(
        "id, email, full_name, user_type, advertiser_profiles(company_name, available_deposit_balance)",
      )
      .eq("user_type", "advertiser");

    if (uuidRegex.test(searchTerm)) {
      queryBuilder = queryBuilder.eq("id", searchTerm);
    } else {
      queryBuilder = queryBuilder.or(
        `email.ilike.${searchPattern},full_name.ilike.${searchPattern}`,
      );
    }

    const { data: users, error: usersError } = await queryBuilder.limit(20);

    if (usersError) {
      console.error("Error searching advertisers:", usersError);
      return NextResponse.json(
        { error: "Failed to search advertisers" },
        { status: 500 },
      );
    }

    for (const user of users || []) {
      results.set(user.id, mapUserRow(user));
    }

    if (!uuidRegex.test(searchTerm)) {
      const { data: profileMatches } = await supabase
        .from("advertiser_profiles")
        .select(
          "id, company_name, available_deposit_balance, users!inner(id, email, full_name, user_type)",
        )
        .ilike("company_name", searchPattern)
        .eq("users.user_type", "advertiser")
        .limit(20);

      for (const profile of profileMatches || []) {
        const u = Array.isArray(profile.users)
          ? profile.users[0]
          : profile.users;
        if (!u || results.has(u.id)) continue;
        results.set(u.id, {
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          company_name: profile.company_name || null,
          available_deposit_balance: profile.available_deposit_balance ?? 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      advertisers: Array.from(results.values()).slice(0, 20),
    });
  } catch (error) {
    console.error("Error in advertiser search:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
