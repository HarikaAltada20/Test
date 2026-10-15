import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { redactSecrets } from "@/lib/admin-user-search";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ userId: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read-only admin view of one user: the users row plus the matching
 * creator_profiles or advertiser_profiles row. Secret-looking keys (OAuth
 * tokens inside social account JSON) are redacted before leaving the server.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  const { isAdmin, error: adminError } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json(
      { error: adminError || "Admin access required" },
      { status: 403 }
    );
  }

  const { userId } = await context.params;
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (userError) {
    console.error("Error loading user details:", userError);
    return NextResponse.json(
      { error: "Failed to load user" },
      { status: 500 }
    );
  }
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profileTable =
    user.user_type === "creator"
      ? "creator_profiles"
      : user.user_type === "advertiser"
        ? "advertiser_profiles"
        : null;

  let profile: Record<string, unknown> | null = null;
  if (profileTable) {
    const { data, error } = await supabase
      .from(profileTable)
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error(`Error loading ${profileTable}:`, error);
      return NextResponse.json(
        { error: "Failed to load user profile" },
        { status: 500 }
      );
    }
    profile = data;
  }

  return NextResponse.json(
    {
      success: true,
      user: redactSecrets(user),
      profile: profile ? redactSecrets(profile) : null,
      profileType: profileTable,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
