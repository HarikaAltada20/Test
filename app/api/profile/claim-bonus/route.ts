import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

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

    // Check if user is a creator and get current other_earnings
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("user_type, other_earnings")
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

    // Balance and claim flags can only be changed with the server-only client.
    const admin = createAdminClient();
    const cashCredited = 50; // $0.50 in cents
    const description = `Profile update bonus credited`;
    const remarks = "profile_update_bonus";

    // Mark the reward claimed first, only if it is still unclaimed, so two
    // requests at the same time cannot both credit the bonus.
    const { data: claimed, error: claimErr } = await admin
      .from("creator_profiles")
      .update({
        has_claimed_profile_reward: true,
        profile_reward_claimed_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .or("has_claimed_profile_reward.is.null,has_claimed_profile_reward.eq.false")
      .select("id");

    if (claimErr) {
      return NextResponse.json({ error: "Failed to claim profile update bonus" }, { status: 500 });
    }
    if (!claimed || claimed.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Profile update bonus already claimed",
        already_claimed: true,
      });
    }

    const { data: creditRes, error: rpcErr } = await admin.rpc(
      "credit_creator_cash_atomic",
      {
        p_user_id: user.id,
        p_amount_cents: cashCredited,
        p_description: description,
        p_remarks: remarks,
      }
    );

    if (rpcErr || !creditRes) {
      // Release the claim so the user can try again.
      await admin
        .from("creator_profiles")
        .update({ has_claimed_profile_reward: false, profile_reward_claimed_at: null })
        .eq("id", user.id);
      return NextResponse.json(
        {
          error:
            "Failed to credit profile update bonus: " +
            (rpcErr?.message || "Unknown error"),
        },
        { status: 500 }
      );
    }

    // Also increment other_earnings in users table
    const { error: otherEarningsErr } = await admin
      .from("users")
      .update({
        other_earnings: ((userRow as any).other_earnings || 0) + cashCredited,
      })
      .eq("id", user.id);

    if (otherEarningsErr) {
      console.warn(
        "Failed to update other_earnings:",
        otherEarningsErr.message
      );
      // Don't fail the request since bonus was already credited
    }

    return NextResponse.json({
      success: true,
      cash_cents: cashCredited,
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
