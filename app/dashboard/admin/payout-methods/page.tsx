import { Suspense } from "react";
import { verifyAdminAccess } from "@/utils/admin-auth";
import PayoutMethodsClient from "./payout-methods-client";

export const revalidate = 0;

export default async function AdminPayoutMethodsPage() {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return null;

  return (
    <Suspense fallback={null}>
      <PayoutMethodsClient />
    </Suspense>
  );
}
