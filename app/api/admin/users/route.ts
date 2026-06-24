import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  listAdminUsersPaginated,
  listAllAdminUsers,
} from "@/lib/admin-users/list-users";

export async function GET(req: NextRequest) {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin)
      return NextResponse.json(
        { error: error || "Admin required" },
        { status: 403 },
      );

    const offsetParam = req.nextUrl.searchParams.get("offset");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const pageParam = req.nextUrl.searchParams.get("page");
    const legacyAll =
      req.nextUrl.searchParams.get("all") === "1" ||
      (!offsetParam && !limitParam && !pageParam);

    if (legacyAll) {
      const items = await listAllAdminUsers();
      return NextResponse.json({ items });
    }

    const limit = Math.min(
      Math.max(parseInt(limitParam ?? "25", 10) || 25, 1),
      1000,
    );
    const offset = pageParam
      ? (Math.max(parseInt(pageParam, 10) || 1, 1) - 1) * limit
      : Math.max(parseInt(offsetParam ?? "0", 10) || 0, 0);
    const includeCounts = req.nextUrl.searchParams.get("includeCounts") === "1";

    const result = await listAdminUsersPaginated({
      offset,
      limit,
      includeCounts,
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin)
      return NextResponse.json(
        { error: error || "Admin required" },
        { status: 403 },
      );

    const body = await req.json();
    const { userId, userType } = body as {
      userId: string;
      userType: string;
    };

    if (!userId || !userType) {
      return NextResponse.json(
        { error: "userId and userType are required" },
        { status: 400 },
      );
    }

    const validUserTypes = ["creator", "advertiser", "admin"];
    if (!validUserTypes.includes(userType)) {
      return NextResponse.json(
        {
          error: "Invalid userType. Must be one of: creator, advertiser, admin",
        },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({ user_type: userType })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating user type:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
