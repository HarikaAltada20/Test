import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { creditCreatorWithdrawableBalance } from "@/lib/payment-utils";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a creator
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (userErr || !userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    if (userRow.user_type !== "creator") {
      return NextResponse.json(
        { error: "Only creators can claim profile update bonus" },
        { status: 403 }
      );
    }

    // Check if user has already claimed the bonus
    const { data: profile, error: profileErr } = await supabase
      .from("creator_profiles")
      .select("has_claimed_profile_reward")
      .eq("id", user.id)
      .single();

    if (profileErr) {
      return NextResponse.json(
        { error: "Failed to check profile status" },
        { status: 500 }
      );
    }

    if (profile?.has_claimed_profile_reward) {
      return NextResponse.json({
        success: true,
        message: "Profile update bonus already claimed",
        already_claimed: true,
      });
    }

    // Credit the $0.50 bonus
    const bonusResult = await creditCreatorWithdrawableBalance(
      user.id,
      50, // $0.50 in cents
      "Profile update bonus",
      {
        remarks: "profile_update_bonus",
      }
    );

    if (!bonusResult.success) {
      return NextResponse.json(
        { error: bonusResult.error || "Failed to credit bonus" },
        { status: 500 }
      );
    }

    // Mark reward as claimed
    const { error: updateErr } = await supabase
      .from("creator_profiles")
      .update({ has_claimed_profile_reward: true })
      .eq("id", user.id);

    if (updateErr) {
      console.error("Failed to update has_claimed_profile_reward:", updateErr);
      // Don't fail the request since bonus was already credited
    }

    return NextResponse.json({
      success: true,
      cash_cents: 50,
      newBalance: bonusResult.newBalance,
      message: "Profile update bonus claimed successfully!",
    });
  } catch (e: any) {
    console.error("profile/claim-update-bonus error", e);
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
