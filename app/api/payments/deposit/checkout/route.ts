import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  createWalletTopUpCheckoutSession,
  getCustomerInfo,
  logTransaction,
} from "@/lib/payment-utils";
import { WALLET_TOP_UP_MAX_AMOUNT, WALLET_TOP_UP_MIN_AMOUNT } from "@/constants/subscriptionPlans";

export async function POST(request: NextRequest) {
  try {
    const { amount } = await request.json();

    if (!amount || amount < WALLET_TOP_UP_MIN_AMOUNT) {
      return NextResponse.json(
        { error: `Minimum top-up amount is $${WALLET_TOP_UP_MIN_AMOUNT}` },
        { status: 400 },
      );
    }

    if (amount > WALLET_TOP_UP_MAX_AMOUNT) {
      return NextResponse.json(
        {
          error: `Maximum top-up amount is $${WALLET_TOP_UP_MAX_AMOUNT.toLocaleString()}`,
        },
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
        { error: "Only advertisers can make deposits" },
        { status: 403 },
      );
    }

    const amountInCents = Math.round(amount * 100);
    const checkoutSession = await createWalletTopUpCheckoutSession(
      user.id,
      amount,
    );

    if ("error" in checkoutSession) {
      return NextResponse.json(
        { error: checkoutSession.error },
        { status: 500 },
      );
    }

    const customerInfo = await getCustomerInfo(user.id);
    const customerId = customerInfo?.customerId;

    if (checkoutSession.paymentIntentId) {
      await logTransaction(
        user.id,
        "deposit",
        amountInCents,
        "pending",
        `Wallet top-up initiated - Payment Intent: ${checkoutSession.paymentIntentId}`,
        checkoutSession.paymentIntentId,
        "Processing payment on Stripe Checkout...",
        "stripe",
        undefined,
        undefined,
        undefined,
        customerId,
      );
    }

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.sessionId,
      paymentIntentId: checkoutSession.paymentIntentId,
    });
  } catch (error) {
    console.error("Error in deposit checkout endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
