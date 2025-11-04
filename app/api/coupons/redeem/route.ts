import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type CouponReward = {
  cash_cents?: number; // credit money wallet in cents
  coins?: number; // credit user coins
};

type CouponConfig = {
  audience?: "creator" | "advertiser" | "any";
  reward: CouponReward;
  remarks?: string; // stored in transactions for idempotency
  unique?: boolean; // redeemable once per user
};

function loadCoupons(): Record<string, CouponConfig> {
  try {
    const raw = process.env.COUPON_CONFIG_JSON;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object")
        return parsed as Record<string, CouponConfig>;
    }
  } catch (e) {
    console.error("Failed to parse COUPON_CONFIG_JSON", e);
  }
  // Defaults
  return {
    DISCORD10: {
      audience: "creator",
      reward: { cash_cents: 10 },
      remarks: "coupon:DISCORD10",
      unique: true,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const { code } = (await request.json().catch(() => ({}))) as {
      code?: string;
    };
    if (!code)
      return NextResponse.json({ error: "Code is required" }, { status: 400 });

    const normalized = code.trim().toUpperCase();
    const coupons = loadCoupons();
    const config = coupons[normalized];
    if (!config) {
      return NextResponse.json(
        { error: "Invalid or expired coupon" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("user_type, coins, total_lifetime_coins_earned, other_earnings")
      .eq("id", user.id)
      .single();
    if (userErr || !userRow)
      return NextResponse.json({ error: "User not found" }, { status: 400 });

    const audience = config.audience || "any";
    if (audience !== "any" && userRow.user_type !== audience) {
      return NextResponse.json(
        { error: "Not eligible for this coupon" },
        { status: 403 }
      );
    }

    // Idempotency via coupon_redemptions unique constraint
    if (config.unique !== false) {
      const { data: redemption, error: redemptionErr } = await supabase
        .from("coupon_redemptions")
        .insert({ user_id: user.id, code: normalized })
        .select("id")
        .single();
      if (redemptionErr) {
        // If unique violation, treat as already redeemed
        return NextResponse.json({
          success: true,
          message: "Coupon already redeemed",
        });
      }
    }

    // Apply rewards
    let cashCredited = 0;
    let coinsCredited = 0;

    if (config.reward.cash_cents && config.reward.cash_cents > 0) {
      cashCredited = config.reward.cash_cents;
      const description = `Coupon ${normalized} credited`;
      const remarks = config.remarks || `coupon:${normalized}`;
      if (userRow.user_type === "creator") {
        const { data: creditRes, error: rpcErr } = await supabase.rpc(
          "credit_creator_cash_atomic",
          {
            p_user_id: user.id,
            p_amount_cents: cashCredited,
            p_description: description,
            p_remarks: remarks,
          }
        );
        if (rpcErr || !creditRes)
          return NextResponse.json(
            { error: "Failed to credit cash" },
            { status: 500 }
          );
      } else {
        const { data: creditRes, error: rpcErr } = await supabase.rpc(
          "credit_advertiser_cash_atomic",
          {
            p_user_id: user.id,
            p_amount_cents: cashCredited,
            p_description: description,
            p_remarks: remarks,
          }
        );
        if (rpcErr || !creditRes)
          return NextResponse.json(
            { error: "Failed to credit cash" },
            { status: 500 }
          );
      }

      // Also increment other_earnings in users table
      const { error: otherEarningsErr } = await supabase
        .from("users")
        .update({
          other_earnings: ((userRow as any).other_earnings || 0) + cashCredited,
        })
        .eq("id", user.id);
      if (otherEarningsErr) {
        console.error("Failed to update other_earnings:", otherEarningsErr);
        // Don't fail the request, just log the error
      }
    }

    if (config.reward.coins && config.reward.coins > 0) {
      coinsCredited = config.reward.coins;
      const { error: userUpdateErr } = await supabase
        .from("users")
        .update({
          coins: (userRow.coins || 0) + coinsCredited,
          total_lifetime_coins_earned:
            (userRow.total_lifetime_coins_earned || 0) + coinsCredited,
        })
        .eq("id", user.id);
      if (userUpdateErr)
        return NextResponse.json(
          { error: "Failed to credit coins" },
          { status: 500 }
        );

      await supabase.from("coin_transactions").insert({
        user_id: user.id,
        type: "bonus",
        status: "success",
        coins: coinsCredited,
        description: `Coupon ${normalized}`,
      });
    }

    return NextResponse.json({
      success: true,
      cash_cents: cashCredited,
      coins: coinsCredited,
    });
  } catch (e: any) {
    console.error("coupons/redeem error", e);
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
