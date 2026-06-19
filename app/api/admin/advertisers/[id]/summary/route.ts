import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  getPlanByProductId,
  getPlanByName,
  PRODUCT_IDS,
} from "@/constants/subscriptionPlans";

function countActiveContests(
  contests: Array<{ moderation_status: string; status: string | null }>,
) {
  return contests.filter((contest) => {
    if (
      contest.moderation_status === "pending_approval" ||
      contest.moderation_status === "approved"
    ) {
      return true;
    }
    if (contest.moderation_status === "published") {
      return contest.status === "upcoming" || contest.status === "active";
    }
    return false;
  }).length;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: adminError || "Admin access required" },
        { status: 403 },
      );
    }

    const { id: advertiserId } = await params;
    const supabase = createAdminClient();

    const [{ data: profile, error: profileError }, { data: userRow }] =
      await Promise.all([
        supabase
          .from("advertiser_profiles")
          .select("id, available_deposit_balance, subscription_info, company_name")
          .eq("id", advertiserId)
          .maybeSingle(),
        supabase
          .from("users")
          .select("id, email, full_name, user_type")
          .eq("id", advertiserId)
          .maybeSingle(),
      ]);

    if (profileError || !profile || !userRow || userRow.user_type !== "advertiser") {
      return NextResponse.json(
        { error: "Advertiser not found" },
        { status: 404 },
      );
    }

    const subscriptionInfo = profile.subscription_info as
      | {
          product_id?: string;
          subscription_id?: string;
        }
      | null
      | undefined;

    const productId = subscriptionInfo?.product_id ?? PRODUCT_IDS.EXPLORER;
    const plan =
      getPlanByProductId(productId) ?? getPlanByName("EXPLORER");

    if (!plan) {
      return NextResponse.json(
        { error: "Could not resolve brand plan" },
        { status: 500 },
      );
    }

    let subscriptionStatus = "active";
    const subscriptionId = subscriptionInfo?.subscription_id;
    if (
      subscriptionId &&
      subscriptionId !== "free-plan" &&
      subscriptionId !== "no-subscription"
    ) {
      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("id", subscriptionId)
        .eq("user_id", advertiserId)
        .maybeSingle();
      subscriptionStatus = subRow?.status ?? "unknown";
    } else if (!subscriptionId || subscriptionId === "no-subscription") {
      subscriptionStatus = "free";
    }

    const { data: contests } = await supabase
      .from("contests_with_status")
      .select("id, moderation_status, status")
      .eq("advertiser_id", advertiserId);

    const activeCount = countActiveContests(contests ?? []);
    const maxActive = plan.features.maxActiveContests;
    const canCreate = activeCount < maxActive;

    return NextResponse.json({
      success: true,
      advertiser: {
        id: advertiserId,
        email: userRow.email,
        full_name: userRow.full_name,
        company_name: profile.company_name ?? null,
        available_deposit_balance: profile.available_deposit_balance ?? 0,
      },
      subscriptionInfo: subscriptionInfo ?? {
        product_id: PRODUCT_IDS.EXPLORER,
        subscription_id: "no-subscription",
      },
      plan: {
        productId: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        status: subscriptionStatus,
        priceCents: plan.price,
      },
      features: {
        maxActiveContests: plan.features.maxActiveContests,
        minContestBudget: plan.features.minContestBudget,
        maxWinnersPerContest: plan.features.maxWinnersPerContest,
        commissionPercentage: plan.features.commissionPercentage,
        contestTypes: plan.features.contestTypes,
        analytics: plan.features.analytics,
        support: plan.features.support,
      },
      activeContests: {
        current: activeCount,
        max: maxActive,
        canCreate,
        message: canCreate
          ? undefined
          : `This brand has reached their ${plan.displayName} limit of ${maxActive} active campaigns.`,
      },
    });
  } catch (error) {
    console.error("Error in advertiser summary:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
