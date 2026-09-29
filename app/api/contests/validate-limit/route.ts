import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canCreateNewContest, canCreateNewContestAsAdmin } from "@/lib/contest-utils";
import { verifyAdminAccess } from "@/utils/admin-auth";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { maxActiveContests, contestId, advertiserId } = body;

    if (!maxActiveContests || typeof maxActiveContests !== 'number') {
      return NextResponse.json(
        { error: "Invalid request. maxActiveContests is required." },
        { status: 400 }
      );
    }

    let targetUserId = user.id;
    if (advertiserId) {
      const { isAdmin } = await verifyAdminAccess();
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 }
        );
      }
      targetUserId = advertiserId;
    }

    // Check if user can create a new contest
    // If contestId is provided (for edit), exclude it from the active count
    const result = advertiserId
      ? await canCreateNewContestAsAdmin(
          targetUserId,
          maxActiveContests,
          contestId,
        )
      : await canCreateNewContest(targetUserId, maxActiveContests, contestId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error validating contest limit:", error);
    return NextResponse.json(
      { error: error.message || "Failed to validate contest limit" },
      { status: 500 }
    );
  }
}

