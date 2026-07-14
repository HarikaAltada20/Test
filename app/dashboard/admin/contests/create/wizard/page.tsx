import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import CreateContestPage from "../../../../contests/create/client";
import { createAdminClient } from "@/utils/supabase/admin";
import { PRODUCT_IDS } from "@/constants/subscriptionPlans";

export default async function AdminCreateContestWizardPage({
  searchParams,
}: {
  searchParams: Promise<{ advertiserId?: string; draft?: string; step?: string }>;
}) {
  const { isAdmin, error } = await verifyAdminAccess();

  if (!isAdmin) {
    console.log("Non-admin user attempted admin create wizard:", error);
    redirect("/dashboard");
  }

  const resolvedSearchParams = await searchParams;
  const advertiserId = resolvedSearchParams.advertiserId;

  if (!advertiserId) {
    redirect("/dashboard/admin/contests/create");
  }

  const admin = createAdminClient();

  const { data: advertiserProfile } = await admin
    .from("advertiser_profiles")
    .select("company_name, subscription_info")
    .eq("id", advertiserId)
    .maybeSingle();

  const { data: advertiser } = await admin
    .from("users")
    .select("id, user_type")
    .eq("id", advertiserId)
    .eq("user_type", "advertiser")
    .maybeSingle();

  if (!advertiser) {
    redirect("/dashboard/admin/contests/create");
  }

  const brandCompanyName = advertiserProfile?.company_name || null;
  const brandSubscriptionInfo = advertiserProfile?.subscription_info as
    | Record<string, unknown>
    | null
    | undefined;
  const initialBrandPlanProductId =
    (brandSubscriptionInfo?.product_id as string | undefined) ??
    PRODUCT_IDS.EXPLORER;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    redirect("/login");
  }

  return (
    <CreateContestPage
      user={user}
      isAdmin
      targetAdvertiserId={advertiserId}
      targetBrandCompanyName={brandCompanyName}
      initialBrandPlanProductId={initialBrandPlanProductId}
      initialBrandSubscriptionInfo={brandSubscriptionInfo ?? undefined}
    />
  );
}
