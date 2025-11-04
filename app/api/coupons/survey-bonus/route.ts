import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 Survey bonus API called");
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("❌ Unauthorized:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("✅ Authenticated user:", user.id);

    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("user_type, coins, total_lifetime_coins_earned, other_earnings")
      .eq("id", user.id)
      .single();

    if (userErr || !userRow) {
      console.log("❌ User not found:", userErr);
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    console.log("✅ User found:", userRow.user_type);

    // Survey bonus is only for creators
    if (userRow.user_type !== "creator") {
      console.log("❌ Not a creator");
      return NextResponse.json(
        { error: "Only creators can claim survey bonus" },
        { status: 403 }
      );
    }

    const cashCredited = 40; // $0.40 in cents
    console.log("💰 Crediting:", cashCredited, "cents");

    // Check redemption status with all required fields
    const { data: existingRedemption, error: checkErr } = await supabase
      .from("survey_redemptions")
      .select(
        "id, survey_button_clicked, survey_reward_claimed, survey_button_clicked_at, survey_reward_claimed_at"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkErr && checkErr.code !== "PGRST116") {
      console.error("❌ Error checking redemption:", checkErr);
      // Check if error is due to missing columns (migration not applied)
      if (
        checkErr.message?.includes("column") ||
        checkErr.message?.includes("does not exist")
      ) {
        return NextResponse.json(
          {
            error:
              "Database migration required. Please ensure survey redemption tracking migration has been applied.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Failed to check redemption status" },
        { status: 500 }
      );
    }

    // Validate conditions
    if (!existingRedemption) {
      console.log("❌ No survey redemption record found");
      return NextResponse.json(
        {
          error:
            "Please click the survey button from the app first to access the survey",
        },
        { status: 400 }
      );
    }

    // Check if migration fields exist (if they're null/undefined, migration might not be applied)
    const hasNewFields =
      existingRedemption.survey_button_clicked !== undefined ||
      existingRedemption.survey_reward_claimed !== undefined;

    if (!hasNewFields) {
      console.log(
        "⚠️ Old redemption record structure detected, using legacy logic"
      );
      // Legacy behavior: if record exists, assume already claimed
      return NextResponse.json({
        success: true,
        message: "Survey bonus already claimed",
        already_claimed: true,
      });
    }

    // Condition 1: Must have clicked the survey button from the app
    if (existingRedemption.survey_button_clicked === false) {
      console.log("❌ Survey button not clicked");
      return NextResponse.json(
        {
          error:
            "Please click the survey button from the app first to access the survey",
        },
        { status: 400 }
      );
    }

    // Condition 2: Must not have already claimed the reward
    // Check both the flag and the timestamp (timestamp survives even if flag is reset)
    if (
      existingRedemption.survey_reward_claimed === true ||
      existingRedemption.survey_reward_claimed_at
    ) {
      console.log("✅ Already redeemed (found claim flag or timestamp)");
      // If timestamp exists but flag is false, update the flag to sync
      if (
        existingRedemption.survey_reward_claimed_at &&
        !existingRedemption.survey_reward_claimed
      ) {
        await supabase
          .from("survey_redemptions")
          .update({ survey_reward_claimed: true })
          .eq("user_id", user.id);
      }
      return NextResponse.json({
        success: true,
        message: "Survey bonus already claimed",
        already_claimed: true,
      });
    }

    // Condition 3 (Optional): Check if button was clicked within 1 day
    if (existingRedemption.survey_button_clicked_at) {
      const clickTime = new Date(existingRedemption.survey_button_clicked_at);
      const now = new Date();
      const daysSinceClick =
        (now.getTime() - clickTime.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceClick > 1) {
        console.log(
          `❌ Survey button clicked ${daysSinceClick.toFixed(
            2
          )} days ago (limit: 1 day)`
        );
        return NextResponse.json(
          {
            error:
              "Survey reward claim has expired. Please take the survey again from the app.",
          },
          { status: 400 }
        );
      }
    }

    console.log("✅ All conditions met, processing redemption...");

    // Update the redemption record to mark as claimed
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("survey_redemptions")
      .update({
        survey_reward_claimed: true,
        survey_reward_claimed_at: now,
      })
      .eq("user_id", user.id);

    if (updateErr) {
      console.error("❌ Failed to update survey redemption:", updateErr);
      // Check if error is due to missing columns
      if (
        updateErr.message?.includes("column") ||
        updateErr.message?.includes("does not exist") ||
        updateErr.message?.includes("boolean")
      ) {
        return NextResponse.json(
          {
            error:
              "Database migration required. Please ensure survey redemption tracking migration has been applied.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Failed to process survey bonus: " + updateErr.message },
        { status: 500 }
      );
    }

    console.log("✅ Redemption recorded");

    // Credit the cash
    const description = `Survey completion bonus credited`;
    const remarks = "survey_completion_bonus";

    console.log("💳 Crediting cash via RPC...");
    const { data: creditRes, error: rpcErr } = await supabase.rpc(
      "credit_creator_cash_atomic",
      {
        p_user_id: user.id,
        p_amount_cents: cashCredited,
        p_description: description,
        p_remarks: remarks,
      }
    );

    if (rpcErr || !creditRes) {
      console.error(
        "❌ Failed to credit cash:",
        rpcErr,
        "creditRes:",
        creditRes
      );
      return NextResponse.json(
        {
          error:
            "Failed to credit survey bonus: " +
            (rpcErr?.message || "Unknown error"),
        },
        { status: 500 }
      );
    }

    console.log("✅ Success! Cash credited:", creditRes);

    // Also increment other_earnings in users table
    const { error: otherEarningsErr } = await supabase
      .from("users")
      .update({
        other_earnings: ((userRow as any).other_earnings || 0) + cashCredited,
      })
      .eq("id", user.id);
    if (otherEarningsErr) {
      console.error("❌ Failed to update other_earnings:", otherEarningsErr);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      cash_cents: cashCredited,
      message: "Survey bonus claimed successfully!",
    });
  } catch (e: any) {
    console.error("survey-bonus error", e);
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
