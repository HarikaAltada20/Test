import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { stripe } from "@/lib/stripe";

const CONTEST_PAYMENT_TYPES = new Set([
  "contest_payment",
  "contest_payment_split",
]);

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

    const sessionType =
      session.metadata?.type ||
      (typeof session.payment_intent === "object" &&
      session.payment_intent &&
      "metadata" in session.payment_intent
        ? (session.payment_intent as { metadata?: { type?: string } }).metadata
            ?.type
        : undefined);

    if (!sessionType || !CONTEST_PAYMENT_TYPES.has(sessionType)) {
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;

      if (paymentIntentId) {
        const paymentIntent =
          await stripe().paymentIntents.retrieve(paymentIntentId);
        const piType = paymentIntent.metadata?.type;
        if (!piType || !CONTEST_PAYMENT_TYPES.has(piType)) {
          return NextResponse.json(
            { error: "Invalid checkout session type" },
            { status: 400 },
          );
        }
      } else {
        return NextResponse.json(
          { error: "Invalid checkout session type" },
          { status: 400 },
        );
      }
    }

    if (session.metadata?.userId && session.metadata.userId !== user.id) {
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

    const contestId = session.metadata?.contestId;
    if (!contestId) {
      return NextResponse.json(
        { error: "Contest ID missing from checkout session" },
        { status: 400 },
      );
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    return NextResponse.json({
      success: true,
      contestId,
      amountInCents: session.amount_total ?? 0,
      sessionId: session.id,
      paymentIntentId,
    });
  } catch (error) {
    console.error("Error retrieving contest checkout session:", error);
    return NextResponse.json(
      { error: "Failed to retrieve checkout session" },
      { status: 500 },
    );
  }
}
