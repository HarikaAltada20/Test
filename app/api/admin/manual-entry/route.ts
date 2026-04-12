import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { creditUserWithdrawableBalance } from "@/lib/payment-utils";

interface ManualEntryRequest {
  userId: string;
  transactionType: "coins" | "cash";
  amount: number;
  cashCategory?: "contest_winnings" | "other_earnings" | "affiliate_earnings";
  transactionNote: string;
}

export async function POST(req: NextRequest) {
  try {
    // Verify admin access
    const adminAccessResult = await verifyAdminAccess();
    if (!adminAccessResult.isAdmin) {
      return NextResponse.json(
        { error: adminAccessResult.error || "Admin access required" },
        { status: 403 }
      );
    }

    const body: ManualEntryRequest = await req.json();
    const { userId, transactionType, amount, cashCategory, transactionNote } =
      body;

    // Validation
    if (!userId || !transactionType || !amount || !transactionNote) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (transactionType === "cash" && !cashCategory) {
      return NextResponse.json(
        { error: "Cash category is required for cash transactions" },
        { status: 400 }
      );
    }

    if (!transactionNote.trim()) {
      return NextResponse.json(
        { error: "Transaction note is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, user_type, email, full_name")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get admin user info for audit trail (reuse from first call)
    const adminUserId = adminAccessResult.user?.id || "unknown";

    if (transactionType === "coins") {
      // Handle Coins Entry
      // Get current coins balance
      const { data: currentUser, error: fetchError } = await supabase
        .from("users")
        .select("coins, total_lifetime_coins_earned")
        .eq("id", userId)
        .single();

      if (fetchError) {
        return NextResponse.json(
          { error: "Failed to fetch user data" },
          { status: 500 }
        );
      }

      const currentCoins = currentUser?.coins || 0;
      const currentLifetime = currentUser?.total_lifetime_coins_earned || 0;
      const newCoins = currentCoins + amount;
      const newLifetime = currentLifetime + amount;

      // Update user balances
      const { error: updateError } = await supabase
        .from("users")
        .update({
          coins: newCoins,
          total_lifetime_coins_earned: newLifetime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        console.error("Error updating coins:", updateError);
        return NextResponse.json(
          { error: "Failed to update coins balance" },
          { status: 500 }
        );
      }

      // Create coin transaction record
      const { error: transactionError } = await supabase
        .from("coin_transactions")
        .insert({
          user_id: userId,
          type: "bonus", // Using 'bonus' type for admin manual entries
          status: "success",
          coins: amount,
          description: transactionNote,
        });

      if (transactionError) {
        console.error("Error creating coin transaction:", transactionError);
        // Don't fail the request if transaction logging fails, but log it
      }

      return NextResponse.json({
        success: true,
        message: "Coins credited successfully",
        data: {
          userId,
          newCoinsBalance: newCoins,
          newLifetimeCoins: newLifetime,
        },
      });
    } else {
      // Handle Cash Entry
      // Check if user is a creator (cash is typically for creators)
      if (user.user_type !== "creator") {
        return NextResponse.json(
          {
            error:
              "Cash credits are only available for creator accounts. Please use coins for other user types.",
          },
          { status: 400 }
        );
      }

      // Get current withdrawable balance and total_money_won
      const { data: creatorProfile, error: profileError } = await supabase
        .from("creator_profiles")
        .select("withdrawable_balance, total_money_won")
        .eq("id", userId)
        .single();

      if (profileError || !creatorProfile) {
        console.error("Error fetching creator profile:", profileError);
        return NextResponse.json(
          { error: "Failed to fetch creator profile" },
          { status: 500 }
        );
      }

      const currentBalance = creatorProfile?.withdrawable_balance || 0;
      const newBalance = currentBalance + amount;

      if (cashCategory === "affiliate_earnings") {
        const creditRes = await creditUserWithdrawableBalance(
          userId,
          amount,
          transactionNote.trim(),
          {
            remarks: "Admin manual credit - affiliate_earnings",
            metadata: {
              category: "affiliate_earnings",
              manual_entry: true,
              admin_id: adminUserId,
            },
          }
        );
        if (!creditRes.success) {
          return NextResponse.json(
            { error: creditRes.error || "Failed to credit affiliate earnings" },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          message: "Cash credited successfully",
          data: {
            userId,
            newWithdrawableBalance: creditRes.newBalance,
            category: cashCategory,
          },
        });
      }

      // Prepare update object for creator_profiles
      const updateData: any = {
        withdrawable_balance: newBalance,
        updated_at: new Date().toISOString(),
      };

      // Handle category-specific updates
      if (cashCategory === "contest_winnings") {
        // For contest winnings, update total_money_won in creator_profiles
        const currentTotalWon = creatorProfile?.total_money_won || 0;
        const newTotalWon = currentTotalWon + amount;
        updateData.total_money_won = newTotalWon;
      } else if (cashCategory === "other_earnings") {
        // Bonuses, coupons, Discord codes, etc. — users.other_earnings only (not affiliate, not contest wins)
        // First, get current other_earnings from users table
        const { data: currentUser, error: userFetchError } = await supabase
          .from("users")
          .select("other_earnings")
          .eq("id", userId)
          .single();

        if (userFetchError) {
          console.error("Error fetching user other_earnings:", userFetchError);
          return NextResponse.json(
            { error: "Failed to fetch user data" },
            { status: 500 }
          );
        }

        const currentOtherEarnings = currentUser?.other_earnings || 0;
        const newOtherEarnings = currentOtherEarnings + amount;

        // Update users.other_earnings
        const { error: userUpdateError } = await supabase
          .from("users")
          .update({
            other_earnings: newOtherEarnings,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (userUpdateError) {
          console.error(
            "Error updating users.other_earnings:",
            userUpdateError
          );
          return NextResponse.json(
            { error: "Failed to update other_earnings" },
            { status: 500 }
          );
        }
      }

      // Update creator profile (withdrawable_balance always updated, total_money_won for contest_winnings)
      const { error: cashUpdateError } = await supabase
        .from("creator_profiles")
        .update(updateData)
        .eq("id", userId);

      if (cashUpdateError) {
        console.error("Error updating cash balance:", cashUpdateError);
        return NextResponse.json(
          { error: "Failed to update cash balance" },
          { status: 500 }
        );
      }

      // Create money transaction record
      const { error: transactionError } = await supabase
        .from("money_transactions")
        .insert({
          user_id: userId,
          type: "reward", // Using 'reward' type for admin manual entries
          status: "success",
          amount: amount, // Amount in cents
          currency: "USD",
          description: transactionNote,
          remarks: `Admin manual credit - ${cashCategory}`,
          metadata: {
            category: cashCategory,
            admin_id: adminUserId,
            manual_entry: true,
          },
        });

      if (transactionError) {
        console.error("Error creating money transaction:", transactionError);
        // Don't fail the request if transaction logging fails, but log it
      }

      // Prepare response data
      const responseData: any = {
        userId,
        newWithdrawableBalance: newBalance,
        category: cashCategory,
      };

      if (cashCategory === "contest_winnings") {
        responseData.newTotalMoneyWon = updateData.total_money_won;
      } else if (cashCategory === "other_earnings") {
        // Fetch updated other_earnings value for response
        const { data: updatedUser } = await supabase
          .from("users")
          .select("other_earnings")
          .eq("id", userId)
          .single();
        responseData.newOtherEarnings = updatedUser?.other_earnings || 0;
      }

      return NextResponse.json({
        success: true,
        message: "Cash credited successfully",
        data: responseData,
      });
    }
  } catch (error) {
    console.error("Error in manual entry:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
