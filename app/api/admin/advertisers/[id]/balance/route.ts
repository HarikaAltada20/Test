import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: adminError || "Admin access required" },
        { status: 403 },
      );
    }

    const { id: advertiserId } = await params;
    const supabase = createAdminClient();

    const { data: profile, error } = await supabase
      .from("advertiser_profiles")
      .select("id, available_deposit_balance")
      .eq("id", advertiserId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching advertiser balance:", error);
      return NextResponse.json(
        { error: "Failed to fetch balance" },
        { status: 500 },
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Advertiser not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      balance: profile.available_deposit_balance ?? 0,
    });
  } catch (error) {
    console.error("Error in advertiser balance:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
