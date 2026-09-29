import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { stripe } from "@/lib/stripe";
import {
  createContestCheckoutSession,
  getCustomerInfo,
  logTransaction,
  PaymentDetails,
  processContestPaymentV2,
} from "@/lib/payment-utils";
import { canCreateNewContest } from "@/lib/contest-utils";
import {
  assertClientPaymentMatchesExpected,
  ContestPaymentValidationError,
  getSafeContestPaymentReturnPath,
  resolveExpectedContestPayment,
} from "@/lib/contest-payment-validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contestId,
      amount,
      paymentMethod,
      commissionPercentage,
      isIncrease,
      isDecrease,
      returnPath,
    } = body;

    if (!contestId) {
      return NextResponse.json({ error: "Invalid contest ID" }, { status: 400 });
    }

    if (!paymentMethod || !["stripe", "split"].includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Checkout is only available for Stripe or split payments" },
        { status: 400 },
      );
    }

    const safeReturnPath = getSafeContestPaymentReturnPath(returnPath);
    if (!safeReturnPath) {
      return NextResponse.json(
        { error: "Invalid return path" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("advertiser_profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Only advertisers can create contests" },
        { status: 403 },
      );
    }

    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .select(
        "id, advertiser_id, title, contest_type, contest_based_details, payment_details",
      )
      .eq("id", contestId)
      .eq("advertiser_id", user.id)
      .single();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: "Contest not found or access denied" },
        { status: 404 },
      );
    }

    let expectedPayment;
    try {
      expectedPayment = await resolveExpectedContestPayment(contest, user.id, {
        isIncrease: Boolean(isIncrease),
        isDecrease: Boolean(isDecrease),
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

    const { prizePoolInCents, commissionPercentage: serverCommission } =
      expectedPayment;

    const existingPaymentDetails =
      contest.payment_details as PaymentDetails | null;
    const budgetChangeType = expectedPayment.changeType;
    const isInitialPayment =
      !existingPaymentDetails ||
      existingPaymentDetails.payment_status !== "completed";

    if (isInitialPayment) {
      const { getUserPlanFeatures } = await import("@/lib/subscription-utils");
      const planFeatures = await getUserPlanFeatures(user.id);

      if (!planFeatures) {
        return NextResponse.json(
          { error: "Failed to get user plan details" },
          { status: 500 },
        );
      }

      const canCreate = await canCreateNewContest(
        user.id,
        planFeatures.maxActiveContests,
      );

      if (!canCreate.canCreate) {
        return NextResponse.json(
          {
            error: canCreate.error || "Active contest limit exceeded",
            details: {
              currentActiveContests: canCreate.currentCount,
              maxActiveContests: planFeatures.maxActiveContests,
              planName: "Current Plan",
            },
          },
          { status: 400 },
        );
      }
    }

    const description = `Contest payment for "${contest.title}" (ID: ${contestId})`;

    const paymentResult = await processContestPaymentV2(
      user.id,
      contestId,
      prizePoolInCents,
      serverCommission,
      description,
      paymentMethod !== "stripe",
      existingPaymentDetails || undefined,
      budgetChangeType,
      { checkoutMode: true },
    );

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error },
        { status: 400 },
      );
    }

    const stripeAmount = paymentResult.stripeAmount ?? 0;
    if (stripeAmount <= 0) {
      return NextResponse.json(
        {
          error: "No Stripe payment required. Use wallet payment instead.",
        },
        { status: 400 },
      );
    }

    const stripePaymentMethod =
      paymentResult.paymentMethod === "split" ? "split" : "stripe";

    const checkoutSession = await createContestCheckoutSession({
      userId: user.id,
      contestId,
      contestTitle: contest.title,
      stripeAmountInCents: stripeAmount,
      totalAmountInCents:
        paymentResult.totalAmount ?? expectedPayment.totalAmountInCents,
      walletAmountInCents: paymentResult.walletAmount ?? 0,
      originalWalletBalance: paymentResult.originalWalletBalance ?? 0,
      description,
      paymentMethod: stripePaymentMethod,
      returnPath: safeReturnPath,
    });

    if ("error" in checkoutSession) {
      return NextResponse.json(
        { error: checkoutSession.error },
        { status: 500 },
      );
    }

    let paymentIntentId = checkoutSession.paymentIntentId;
    if (!paymentIntentId && checkoutSession.sessionId) {
      const retrievedSession = await stripe().checkout.sessions.retrieve(
        checkoutSession.sessionId,
      );
      paymentIntentId =
        typeof retrievedSession.payment_intent === "string"
          ? retrievedSession.payment_intent
          : retrievedSession.payment_intent?.id ?? null;
    }

    if (paymentResult.paymentDetails && paymentIntentId) {
      const updatedDetails = {
        ...paymentResult.paymentDetails,
        payment_intent_ids: [paymentIntentId],
      };

      const { error: updateError } = await supabase
        .from("contests")
        .update({ payment_details: updatedDetails })
        .eq("id", contestId)
        .eq("advertiser_id", user.id);

      if (updateError) {
        console.error("Error storing contest payment details:", updateError);
        return NextResponse.json(
          { error: "Failed to store payment details" },
          { status: 500 },
        );
      }
    } else if (paymentResult.paymentDetails) {
      const { error: updateError } = await supabase
        .from("contests")
        .update({ payment_details: paymentResult.paymentDetails })
        .eq("id", contestId)
        .eq("advertiser_id", user.id);

      if (updateError) {
        console.error("Error storing contest payment details:", updateError);
        return NextResponse.json(
          { error: "Failed to store payment details" },
          { status: 500 },
        );
      }
    }

    if (paymentIntentId) {
      const enhancedDescription =
        stripePaymentMethod === "split"
          ? `${description} (Stripe Portion)`
          : `${description} (Stripe Payment)`;
      const remarks =
        stripePaymentMethod === "split"
          ? "Stripe portion of split payment"
          : "Stripe payment processing";

      await logTransaction(
        user.id,
        "contest_payment",
        stripeAmount,
        "pending",
        enhancedDescription,
        paymentIntentId,
        remarks,
        stripePaymentMethod,
      );
    }

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.sessionId,
      paymentIntentId,
    });
  } catch (error) {
    console.error("Error in contest checkout endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
