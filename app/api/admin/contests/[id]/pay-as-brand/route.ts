import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  createInitialPaymentDetails,
  deductFromDepositBalanceAsAdmin,
  getAdvertiserDepositBalanceAsAdmin,
  markPaymentAsCompleted,
  PaymentDetails,
} from "@/lib/payment-utils";
import { canCreateNewContestAsAdmin } from "@/lib/contest-utils";
import {
  getPlanFeaturesFromProductId,
  getUserPlanFeaturesAsAdmin,
} from "@/lib/subscription-utils";
import {
  assertClientPaymentMatchesExpected,
  ContestPaymentValidationError,
  resolveExpectedContestPayment,
} from "@/lib/contest-payment-validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { isAdmin, user: adminUser, error: adminError } =
      await verifyAdminAccess();
    if (!isAdmin || !adminUser) {
      return NextResponse.json(
        { error: adminError || "Admin access required" },
        { status: 403 },
      );
    }

    const { id: contestId } = await params;
    const body = await request.json();
    const { amount, commissionPercentage, isIncrease, isDecrease } = body;

    const supabase = createAdminClient();

    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .select(
        "id, advertiser_id, title, contest_type, contest_based_details, payment_details, subscription_info_of_user",
      )
      .eq("id", contestId)
      .maybeSingle();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: "Contest not found" },
        { status: 404 },
      );
    }

    const brandUserId = contest.advertiser_id;

    let expectedPayment;
    try {
      expectedPayment = await resolveExpectedContestPayment(contest, brandUserId, {
        isIncrease: Boolean(isIncrease),
        isDecrease: Boolean(isDecrease),
        planLookup: "admin",
      });
    } catch (error) {
      if (error instanceof ContestPaymentValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    assertClientPaymentMatchesExpected(
      amount,
      commissionPercentage,
      expectedPayment,
    );

    const { prizePoolInCents, commissionPercentage: serverCommission, totalAmountInCents } =
      expectedPayment;

    const existingPaymentDetails =
      contest.payment_details as PaymentDetails | null;
    const isInitialPayment =
      !existingPaymentDetails ||
      existingPaymentDetails.payment_status !== "completed";

    if (isInitialPayment) {
      const snapshotProductId = (
        contest.subscription_info_of_user as { product_id?: string } | null
      )?.product_id;
      const planFeatures =
        getPlanFeaturesFromProductId(snapshotProductId) ??
        (await getUserPlanFeaturesAsAdmin(brandUserId));

      if (!planFeatures) {
        return NextResponse.json(
          { error: "Failed to get brand plan details" },
          { status: 500 },
        );
      }

      const canCreate = await canCreateNewContestAsAdmin(
        brandUserId,
        planFeatures.maxActiveContests,
        contestId,
      );

      if (!canCreate.canCreate) {
        return NextResponse.json(
          {
            error:
              canCreate.error ||
              "Brand has reached their active campaign limit",
          },
          { status: 400 },
        );
      }
    }

    const balanceCheck = await getAdvertiserDepositBalanceAsAdmin(brandUserId);
    if (!balanceCheck.success) {
      return NextResponse.json(
        { error: "Failed to check brand wallet balance" },
        { status: 500 },
      );
    }

    if (balanceCheck.balance < totalAmountInCents) {
      return NextResponse.json(
        {
          error: "Brand needs to top up wallet.",
          details: {
            requiredCents: totalAmountInCents,
            availableCents: balanceCheck.balance,
            commissionPercentage: serverCommission,
          },
        },
        { status: 400 },
      );
    }

    const description = `Contest payment for "${contest.title}" (ID: ${contestId})`;
    const deductResult = await deductFromDepositBalanceAsAdmin(
      brandUserId,
      totalAmountInCents,
      description,
      {
        paymentMethod: "wallet",
        metadata: {
          paid_by_admin: true,
          admin_user_id: adminUser.id,
          contest_id: contestId,
        },
      },
    );

    if (!deductResult.success) {
      return NextResponse.json(
        {
          error: deductResult.error?.includes("Insufficient")
            ? "Brand needs to top up wallet."
            : deductResult.error || "Wallet payment failed",
        },
        { status: 400 },
      );
    }

    let paymentDetails = createInitialPaymentDetails(
      prizePoolInCents,
      serverCommission,
      totalAmountInCents,
      0,
      null,
    );
    paymentDetails = markPaymentAsCompleted(paymentDetails);

    const { error: updateError } = await supabase
      .from("contests")
      .update({ payment_details: paymentDetails })
      .eq("id", contestId);

    if (updateError) {
      console.error("Error storing payment details:", updateError);
      return NextResponse.json(
        { error: "Failed to store payment details" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      paymentMethod: "wallet",
      paymentDetails,
      amountFromWallet: totalAmountInCents / 100,
    });
  } catch (error) {
    console.error("Error in pay-as-brand:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
