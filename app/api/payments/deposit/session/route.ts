import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { stripe } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id is required" },
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

    const session = await stripe().checkout.sessions.retrieve(sessionId);

    if (session.metadata?.type !== "wallet_topup") {
      return NextResponse.json(
        { error: "Invalid checkout session type" },
        { status: 400 },
      );
    }

    if (session.metadata?.userId !== user.id) {
      return NextResponse.json(
        { error: "Checkout session does not belong to this account" },
        { status: 403 },
      );
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 },
      );
    }

    const amountInCents = session.amount_total ?? 0;
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    return NextResponse.json({
      success: true,
      amountInCents,
      sessionId: session.id,
      paymentIntentId,
    });
  } catch (error) {
    console.error("Error retrieving wallet top-up checkout session:", error);
    return NextResponse.json(
      { error: "Failed to retrieve checkout session" },
      { status: 500 },
    );
  }
}
