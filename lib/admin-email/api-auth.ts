import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";

export async function requireAdminApi() {
  const { isAdmin, user, error } = await verifyAdminAccess();
  if (!isAdmin || !user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: error || "Admin required" },
        { status: 403 },
      ),
    };
  }
  return { user, response: null };
}
