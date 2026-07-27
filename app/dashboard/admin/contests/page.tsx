import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { ContestsListLoader } from "../../contests/ContestsListLoader";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

export const revalidate = 0;

export default async function AdminContestsPage() {
  const { isAdmin, error } = await verifyAdminAccess();

  if (!isAdmin) {
    console.log("Non-admin user attempted to access admin contests:", error);
    redirect("/dashboard");
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[76vh] w-full">
          <PageLoadingSpinner mode="light" />
        </div>
      }
    >
      <ContestsListLoader isAdminView />
    </Suspense>
  );
}
