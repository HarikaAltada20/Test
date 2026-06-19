import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  creditDepositBalanceAsAdmin,
  PaymentDetails,
  processContestPaymentAsAdmin,
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

    const {
      prizePoolInCents,
      commissionPercentage: serverCommission,
      totalAmountInCents,
      changeType,
    } = expectedPayment;

    const existingPaymentDetails = contest.payment_details as
      | PaymentDetails
      | string
      | null;
    const parsedExistingPayment =
      typeof existingPaymentDetails === "string"
        ? (() => {
            try {
              return JSON.parse(existingPaymentDetails) as PaymentDetails;
            } catch {
              return null;
            }
          })()
        : existingPaymentDetails;
    const isInitialPayment =
      !parsedExistingPayment ||
      parsedExistingPayment.payment_status !== "completed";

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

    const description = `Contest payment for "${contest.title}" (ID: ${contestId})`;
    const adminPaymentMetadata = {
      paid_by_admin: true,
      admin_user_id: adminUser.id,
      contest_id: contestId,
    };

    const paymentResult = await processContestPaymentAsAdmin(
      brandUserId,
      prizePoolInCents,
      serverCommission,
      description,
      existingPaymentDetails,
      changeType,
      adminPaymentMetadata,
    );

    if (!paymentResult.success || !paymentResult.paymentDetails) {
      const err = paymentResult.error || "Wallet payment failed";
      return NextResponse.json(
        {
          error: err.includes("Insufficient")
            ? "Brand needs to top up wallet."
            : err,
          details: err.includes("Insufficient")
            ? {
                requiredCents: totalAmountInCents,
                commissionPercentage: serverCommission,
              }
            : undefined,
        },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabase
      .from("contests")
      .update({ payment_details: paymentResult.paymentDetails })
      .eq("id", contestId);

    if (updateError) {
      console.error("Error storing payment details:", updateError);

      const walletAmount = paymentResult.amountFromWallet ?? totalAmountInCents;
      const rollback = await creditDepositBalanceAsAdmin(
        brandUserId,
        walletAmount,
        `Rollback: failed to save payment for contest ${contestId}`,
        {
          ...adminPaymentMetadata,
          rollback_reason: "contest_payment_details_update_failed",
        },
      );

      if (!rollback.success) {
        console.error(
          "CRITICAL: pay-as-brand rollback failed after contest update error:",
          rollback.error,
        );
        return NextResponse.json(
          {
            error:
              "Payment was deducted but saving failed, and automatic rollback also failed. Contact support immediately.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { error: "Failed to store payment details. Wallet charge was reversed." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      paymentMethod: "wallet",
      paymentDetails: paymentResult.paymentDetails,
      amountFromWallet: (paymentResult.amountFromWallet ?? totalAmountInCents) / 100,
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
