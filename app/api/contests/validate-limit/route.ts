import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canCreateNewContest } from "@/lib/contest-utils";

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
    const { maxActiveContests, contestId } = body;

    if (!maxActiveContests || typeof maxActiveContests !== 'number') {
      return NextResponse.json(
        { error: "Invalid request. maxActiveContests is required." },
        { status: 400 }
      );
    }

    // Check if user can create a new contest
    // If contestId is provided (for edit), exclude it from the active count
    const result = await canCreateNewContest(user.id, maxActiveContests, contestId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error validating contest limit:", error);
    return NextResponse.json(
      { error: error.message || "Failed to validate contest limit" },
      { status: 500 }
    );
  }
}

