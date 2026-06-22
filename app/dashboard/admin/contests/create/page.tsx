import React from "react";
import { redirect } from "next/navigation";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { AdminCreateForBrandClient } from "./BrandPickerClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function AdminCreateContestPage() {
  const { isAdmin, error } = await verifyAdminAccess();

  if (!isAdmin) {
    console.log("Non-admin user attempted admin create contest:", error);
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-4">
        <Link
          href="/dashboard/admin/contests"
          className={cn(
            "inline-flex items-center gap-2 text-sm font-medium text-muted-foreground",
            "transition-colors hover:text-foreground",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to campaigns
        </Link>

        <header
          className={cn(
            "space-y-2 pb-6 border-b border-gray-200/90 dark:border-white/10",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7F39EC]">
            Admin workflow
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
            Create campaign for brand
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground max-w-2xl">
            Operate on behalf of a brand account. Their subscription plan
            controls contest types, active limits, and commission — payment
            always comes from their wallet.
          </p>
        </header>
      </div>

      <AdminCreateForBrandClient />
    </div>
  );
}
