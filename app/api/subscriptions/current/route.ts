import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getUserSubscription,
  getSubscriptionPlanById,
  hasUserEverHadPaidSubscription,
} from "@/lib/subscription-utils";

export async function GET(request: NextRequest) {
  try {
    const requestId = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    console.log("[API] GET /api/subscriptions/current:start", { requestId });
    const supabase = await createClient();
    
    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an advertiser
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (userError || userData?.user_type !== "advertiser") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Lifetime flag: has this user EVER had a paid plan before?
    const hasEverHadPaidSubscription = await hasUserEverHadPaidSubscription(
      user.id
    );

    // Get current subscription
    const subscription = await getUserSubscription(user.id);
    
    if (!subscription) {
      console.log("[API] /subscriptions/current:none", {
        requestId,
        userId: user.id,
      });
      return NextResponse.json({
        subscription: null,
        plan: null,
        hasEverHadPaidSubscription,
        message: "No subscription found",
      });
    }

    // Get plan details
    const plan = getSubscriptionPlanById(subscription.product_id);
    console.log("[API] /subscriptions/current:success", {
      requestId,
      hasPlan: Boolean(plan),
      subscriptionId: subscription.id,
    });
    
    return NextResponse.json({
      subscription,
      plan,
      hasEverHadPaidSubscription,
      message: "Subscription retrieved successfully",
    });

  } catch (error) {
    console.error("[API] /subscriptions/current:error", {
      message: (error as any)?.message || String(error),
      raw: error,
    });
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
} 